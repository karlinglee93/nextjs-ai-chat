import { generateObject, LanguageModelV1, Output, streamText } from "ai";
import { openai } from "@ai-sdk/openai";

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

setupGlobalProxy();

const getQueryResult = async (
  routingAgentResult: RoutingAgentResult
): Promise<string[]> => {
  try {
    switch (routingAgentResult.mode) {
      case RoutingType.SQL:
        return await queryStructuredData(routingAgentResult.sql!);
      case RoutingType.VECTOR:
        return await queryVectorEmbeddingData(
          routingAgentResult.semanticQuery!
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
  model: LanguageModelV1,
  currentMessageContent: string,
  formattedPreviousMessages: string
) => {
  try {
    const { object: routingAgentResult } = await generateObject({
      model,
      temperature: 0,
      schema: getRoutingAgentSchema(),
      system: getRoutingAgentSystemPrompt(),
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
  model: LanguageModelV1,
  routingAgentResult: RoutingAgentResult,
  queryResult: string[]
) => {
  try {
    const interpretAgentResult = streamText({
      model,
      temperature: 0,
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

    console.debug("✅ Proceed Intrepret Agent Completed.");

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
    const currentMessageContent = messages[messages.length - 1].content;

    const model = openai(appConfig.model);

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
    const interpretAgentResult = await proceedInterpretAgent(
      model,
      routingAgentResult,
      queryResult
    );

    return interpretAgentResult.toDataStreamResponse();
  } catch (error) {
    console.log("error:", error);
    return Response.json(
      { error: error.message },
      { status: error.status ?? 500 }
    );
  }
}
