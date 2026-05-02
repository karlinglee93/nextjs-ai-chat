import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { LanguageModel } from "ai";

import {
  proceedInterpretAgent,
  proceedRoutingAgent,
} from "@/lib/chat-pipeline";
import { debugRoutingAgent } from "@/lib/debug";
import { RoutingAgentResult } from "@/lib/definition";
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

// No-op stubs today. Future: chart-format Zod refine, bounded retry, table fallback.
const validate = async (state: ChatState): Promise<ChatStateUpdate> => state;
const fix = async (state: ChatState): Promise<ChatStateUpdate> => state;
const fallback = async (state: ChatState): Promise<ChatStateUpdate> => state;

// Pure passthrough — must NOT call consumeStream() or await output here, because
// the eval (scripts/eval/run.ts) consumes the stream itself and expects the
// output promise to resolve there.
const stream = async (state: ChatState): Promise<ChatStateUpdate> => state;

const routeMode = (state: ChatState): "sql" | "vector" | "other" =>
  state.routingAgentResult!.mode;

// Today this always returns "valid", so fix/fallback are unreachable.
// When real validation lands, only this function changes.
const routeValidation = (
  _state: ChatState
): "valid" | "invalid_retry" | "invalid_max" => "valid";

const builder = new StateGraph(ChatStateAnnotation)
  .addNode("format_input", formatInput)
  .addNode("routing_agent", routingAgent)
  .addNode("emit_reasoning", emitReasoning)
  .addNode("query_sql", querySql)
  .addNode("embed_query", embedQuery)
  .addNode("vector_search", vectorSearch)
  .addNode("interpret_sql", interpret)
  .addNode("interpret_vector", interpret)
  .addNode("interpret_other", interpretOther)
  .addNode("validate", validate)
  .addNode("fix", fix)
  .addNode("fallback", fallback)
  .addNode("stream", stream)
  .addEdge(START, "format_input")
  .addEdge("format_input", "routing_agent")
  .addEdge("routing_agent", "emit_reasoning")
  .addConditionalEdges("emit_reasoning", routeMode, {
    sql: "query_sql",
    vector: "embed_query",
    other: "interpret_other",
  })
  .addEdge("query_sql", "interpret_sql")
  .addEdge("embed_query", "vector_search")
  .addEdge("vector_search", "interpret_vector")
  .addEdge("interpret_sql", "validate")
  .addConditionalEdges("validate", routeValidation, {
    valid: "stream",
    invalid_retry: "fix",
    invalid_max: "fallback",
  })
  .addEdge("fix", "validate")
  .addEdge("fallback", "stream")
  .addEdge("interpret_vector", "stream")
  .addEdge("interpret_other", "stream")
  .addEdge("stream", END);

export const chatGraph = builder.compile();
