import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { LanguageModel } from "ai";

import {
  proceedInterpretAgent,
  proceedRoutingAgent,
} from "@/lib/chat-pipeline";
import { validateChartShape } from "@/lib/chart-validation";
import { appConfig } from "@/lib/config";
import { debugRoutingAgent } from "@/lib/debug";
import { RoutingAgentResult, RoutingType } from "@/lib/definition";
import {
  queryStructuredData,
  queryVectorEmbeddingData,
} from "@/lib/utils";

type InterpretStream = ReturnType<typeof proceedInterpretAgent>;

export const ChatStateAnnotation = Annotation.Root({
  model: Annotation<LanguageModel>({ reducer: (_, x) => x }),
  question: Annotation<string>({ reducer: (_, x) => x, default: () => "" }),
  history: Annotation<string>({ reducer: (_, x) => x, default: () => "" }),

  routingAgentResult: Annotation<RoutingAgentResult | undefined>({
    reducer: (_, x) => x,
  }),
  queryResult: Annotation<string[]>({
    reducer: (_, x) => x,
    default: () => [],
  }),
  // Vercel AI SDK stream is non-serializable. Keep an explicit replace-reducer
  // and DO NOT attach a checkpointer to this graph.
  interpretStream: Annotation<InterpretStream | undefined>({
    reducer: (_, x) => x,
  }),

  chartAttempts: Annotation<number>({ reducer: (_, x) => x, default: () => 0 }),
  validationError: Annotation<string | undefined>({ reducer: (_, x) => x }),
});

type ChatState = typeof ChatStateAnnotation.State;
type ChatStateUpdate = typeof ChatStateAnnotation.Update;

const logQueryResult = (queryResult: string[]) => {
  console.debug("⌛️ DEBUGING Retrieved Data from Databases...");
  console.debug("🔧 Queried Database Results: ", queryResult);
  console.log("✅ DEBUGING Retrieved Data Completed.");
};

const formatInput = async (state: ChatState): Promise<ChatStateUpdate> => state;

const routingAgent = async (state: ChatState): Promise<ChatStateUpdate> => {
  const result = await proceedRoutingAgent(
    state.model,
    state.question,
    state.history
  );
  console.log("⌛️ DEBUGING Routing Agent...");
  debugRoutingAgent(result);
  console.log("✅ DEBUGING Routing Agent Completed.");
  return { routingAgentResult: result };
};

// No-op stub. Future: stream the routing reasoning to the UI before retrieval starts.
const emitReasoning = async (state: ChatState): Promise<ChatStateUpdate> => state;

const querySql = async (state: ChatState): Promise<ChatStateUpdate> => {
  const queryResult =
    (await queryStructuredData(state.routingAgentResult!.sql!)) ?? [];
  logQueryResult(queryResult);
  return { queryResult };
};

// No-op stub. The embed call currently lives inside queryVectorEmbeddingData;
// future PR can split it out into this node so the trace shows it explicitly.
const embedQuery = async (state: ChatState): Promise<ChatStateUpdate> => state;

const vectorSearch = async (state: ChatState): Promise<ChatStateUpdate> => {
  const queryResult =
    (await queryVectorEmbeddingData(state.routingAgentResult!.semanticQuery!)) ??
    [];
  logQueryResult(queryResult);
  return { queryResult };
};

const interpret = async (state: ChatState): Promise<ChatStateUpdate> => ({
  interpretStream: proceedInterpretAgent(
    state.model,
    state.routingAgentResult!,
    state.queryResult
  ),
});

// "other" branch skips the dedicated query nodes; log the empty queryResult here
// so debug output matches the original pipeline's call to getQueryResult.
const interpretOther = async (state: ChatState): Promise<ChatStateUpdate> => {
  logQueryResult(state.queryResult);
  return {
    interpretStream: proceedInterpretAgent(
      state.model,
      state.routingAgentResult!,
      state.queryResult
    ),
  };
};

const validate = async (state: ChatState): Promise<ChatStateUpdate> => {
  await state.interpretStream!.consumeStream();
  const obj = (await state.interpretStream!.output) as {
    chartType?: "bar" | "line" | "pie";
    formattedData?: unknown;
  };
  const result = validateChartShape(obj.formattedData, obj.chartType);
  if (result.ok) {
    console.debug("✅ Chart shape valid");
    return { validationError: undefined };
  }
  console.debug(
    "⚠️ Chart shape invalid:",
    result.reason,
    "attempts:",
    state.chartAttempts
  );
  return { validationError: result.reason };
};

const fix = async (state: ChatState): Promise<ChatStateUpdate> => {
  console.debug(
    `🔁 Retrying chart agent (attempt ${state.chartAttempts + 1}/${appConfig.chartMaxAttempts})`
  );
  return {
    interpretStream: proceedInterpretAgent(
      state.model,
      state.routingAgentResult!,
      state.queryResult,
      state.validationError
    ),
    chartAttempts: state.chartAttempts + 1,
  };
};

const fallback = async (state: ChatState): Promise<ChatStateUpdate> => {
  console.debug(
    `🛟 Falling back to text-only after ${state.chartAttempts} failed attempts`
  );
  return {
    interpretStream: proceedInterpretAgent(
      state.model,
      {
        ...state.routingAgentResult!,
        mode: RoutingType.OTHER,
        reasoning: `${state.routingAgentResult!.reasoning}\n\nNote: chart rendering failed validation ${state.chartAttempts} times. Summarize this data textually: ${JSON.stringify(state.queryResult).slice(0, 2000)}`,
      },
      []
    ),
  };
};

// Pure passthrough — must NOT call consumeStream() or await output here, because
// the eval (scripts/eval/run.ts) consumes the stream itself and expects the
// output promise to resolve there.
const stream = async (state: ChatState): Promise<ChatStateUpdate> => state;

const routeMode = (state: ChatState): "sql" | "vector" | "other" =>
  state.routingAgentResult!.mode;

const routeValidation = (
  state: ChatState
): "valid" | "invalid_retry" | "invalid_max" => {
  if (!state.validationError) return "valid";
  if (state.chartAttempts >= appConfig.chartMaxAttempts) return "invalid_max";
  return "invalid_retry";
};

const builder = new StateGraph(ChatStateAnnotation)
  .addNode("format_input", formatInput)
  .addNode("routing_agent", routingAgent)
  .addNode("emit_reasoning", emitReasoning)
  // SQL lane
  .addNode("query_sql", querySql)
  .addNode("interpret_sql", interpret)
  .addNode("validate", validate)
  .addNode("fix", fix)
  .addNode("fallback", fallback)
  // Vector lane
  .addNode("embed_query", embedQuery)
  .addNode("vector_search", vectorSearch)
  .addNode("interpret_vector", interpret)
  // Other lane
  .addNode("interpret_other", interpretOther)

  // NEW: collect + synthesize
  // .addNode("collect_task_result", collectTaskResult)  // reducer 写回 state
  // .addNode("synthesize", synthesize)
  .addNode("stream", stream)

  .addEdge(START, "format_input")
  .addEdge("format_input", "routing_agent")
  .addEdge("routing_agent", "emit_reasoning")
  
  .addConditionalEdges("emit_reasoning", routeMode, {
    sql: "query_sql",
    vector: "embed_query",
    other: "interpret_other",
  })
  // sql lane edges
  .addEdge("query_sql", "interpret_sql")
  .addEdge("interpret_sql", "validate")
  .addConditionalEdges("validate", routeValidation, {
    valid: "stream",
    invalid_retry: "fix",
    invalid_max: "fallback",
  })
  .addEdge("fix", "validate")
  .addEdge("fallback", "stream")


  .addEdge("embed_query", "vector_search")
  .addEdge("vector_search", "interpret_vector")
  .addEdge("interpret_vector", "stream")
  .addEdge("interpret_other", "stream")
  
  .addEdge("stream", END);

export const chatGraph = builder.compile();
