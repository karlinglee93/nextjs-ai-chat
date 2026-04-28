import * as ai from "ai";
import { type LanguageModel, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { Client } from "langsmith";
import { traceable } from "langsmith/traceable";
import { wrapAISDK } from "langsmith/experimental/vercel";
import { after } from "next/server";

import { appConfig } from "@/lib/config";
import {
  formatMessage,
  queryStructuredData,
  queryVectorEmbeddingData,
} from "@/lib/utils";
import {
  getRoutingAgentSchema,
  getChartAgentSchema,
  getVectorAgentSchema,
  getGeneralAgentSchema,
} from "@/lib/schema";
import { setupGlobalProxy } from "@/lib/proxy";
import {
  getRoutingAgentSystemPrompt,
  getGeneralAgentSystemPrompt,
  getChartAgentSystemPrompt,
  getVectorAgentSystemPrompt,
} from "@/lib/prompt";
import {
  RoutingAgentResult,
  RoutingType,
  RoutingTypeValue,
} from "@/lib/definition";
import { debugRoutingAgent } from "@/lib/debug";

const langsmithClient = new Client();
const { generateText, streamText } = wrapAISDK(ai, { client: langsmithClient });

setupGlobalProxy();

const getQueryResult = async (
  routingAgentResult: RoutingAgentResult
): Promise<string[]> => {
  try {
    switch (routingAgentResult.mode) {
      case RoutingType.SQL:
        return (await queryStructuredData(routingAgentResult.sql!)) ?? [];
      case RoutingType.VECTOR:
        return (
          (await queryVectorEmbeddingData(routingAgentResult.semanticQuery!)) ??
          []
        );
      default:
        return [];
    }
  } catch (error) {
    throw new Error(`❌ Failed to query database result: ${error}`);
  }
};

const getInterpretAgentPrompt = (
  routingAgentResult: RoutingAgentResult,
  queryResult: string[]
) => {
  switch (routingAgentResult.mode) {
    case RoutingType.SQL:
      return `
          reasoning: ${routingAgentResult.reasoning}
          sql: ${routingAgentResult.sql}
          data: ${JSON.stringify(queryResult)}
          chartType: ${routingAgentResult.chartType}

          Respond with the required JSON only.
        `;
    case RoutingType.VECTOR:
      return `
          reasoning: ${routingAgentResult.reasoning}
          data: ${JSON.stringify(queryResult)}

          Respond with the required JSON only.
        `;
    case RoutingType.OTHER:
      return `
          reasoning: ${routingAgentResult.reasoning}

          Respond with the required JSON only.
        `;

    default:
      throw new Error("Invalid mode when getting prompt.");
  }
};

const getInterpretAgentSchema = (mode: RoutingTypeValue) => {
  switch (mode) {
    case RoutingType.SQL:
      return getChartAgentSchema();
    case RoutingType.VECTOR:
      return getVectorAgentSchema();
    case RoutingType.OTHER:
      return getGeneralAgentSchema();
    default:
      throw new Error(
        `Invalid mode received: '${mode}'. Cannot determine schema.`
      );
  }
};

const proceedRoutingAgent = async (
  model: LanguageModel,
  currentMessageContent: string,
  formattedPreviousMessages: string
) => {
  try {
    const { output: routingAgentResult } = await generateText({
      model,
      output: Output.object({ schema: getRoutingAgentSchema() }),
      system: getRoutingAgentSystemPrompt(),
      temperature: 0,
      prompt: `
        User question:
        ${currentMessageContent}

        Chat history:
        ${formattedPreviousMessages}

        Respond with the required JSON only.
      `,
    });

    return routingAgentResult;
  } catch (error) {
    throw new Error(`❌ Failed to Process Routing Agent: ${error}`);
  }
};

const proceedInterpretAgent = async (
  model: LanguageModel,
  routingAgentResult: RoutingAgentResult,
  queryResult: string[]
) => {
  try {
    const interpretAgentResult = streamText({
      model,
      experimental_output: Output.object({
        schema: getInterpretAgentSchema(routingAgentResult.mode),
      }),
      system: {
        sql: getChartAgentSystemPrompt(),
        vector: getVectorAgentSystemPrompt(),
        other: getGeneralAgentSystemPrompt(),
      }[routingAgentResult.mode],
      prompt: getInterpretAgentPrompt(routingAgentResult, queryResult),
    });

    console.debug("✅ Interpret Agent stream started.");

    return interpretAgentResult;
  } catch (error) {
    throw new Error(`❌ Failed to Process Interpret Agent: ${error}`);
  }
};

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const formattedPreviousMessages = messages
      .slice(0, -1)
      .map(formatMessage)
      .join("\n");
    const lastMessage = messages[messages.length - 1];
    const currentMessageContent =
      lastMessage.parts
        ?.filter((p: { type: string }) => p.type === "text")
        .map((p: { text: string }) => p.text)
        .join("") ?? "";

    const model = openai(appConfig.model);

    const runChatPipeline = traceable(
      async () => {
        // Agent 1 - Routing Agent
        const routingAgentResult = await proceedRoutingAgent(
          model,
          currentMessageContent,
          formattedPreviousMessages
        );

        // Debug Routing Agent
        console.log("⌛️ DEBUGING Routing Agent...");
        debugRoutingAgent(routingAgentResult);
        console.log("✅ DEBUGING Routing Agent Completed.");

        const queryResult = await getQueryResult(routingAgentResult);

        // Debug Supabase Database Results
        console.debug("⌛️ DEBUGING Retrieved Data from Databases...");
        console.debug("🔧 Queried Database Results: ", queryResult);
        console.log("✅ DEBUGING Retrieved Data Completed.");

        // Agent 2 - Interpret Agent
        return proceedInterpretAgent(model, routingAgentResult, queryResult);
      },
      { name: "chat-pipeline", client: langsmithClient }
    );

    const interpretAgentResult = await runChatPipeline();

    after(async () => {
      await langsmithClient.awaitPendingTraceBatches();
    });

    return interpretAgentResult.toUIMessageStreamResponse();
  } catch (error) {
    console.log("error:", error);
    return Response.json(
      { error: error.message },
      { status: error.status ?? 500 }
    );
  }
}
