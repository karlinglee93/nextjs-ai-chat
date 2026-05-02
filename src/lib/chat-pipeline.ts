import * as ai from "ai";
import { type LanguageModel, Output } from "ai";
import { Client } from "langsmith";
import { wrapAISDK } from "langsmith/experimental/vercel";

import { chatGraph } from "@/lib/chat-graph";
import {
  queryStructuredData,
  queryVectorEmbeddingData,
} from "@/lib/utils";
import {
  getRoutingAgentSchema,
  getChartAgentSchema,
  getVectorAgentSchema,
  getGeneralAgentSchema,
} from "@/lib/schema";
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

export const langsmithClient = new Client();

export const { generateText, streamText } = wrapAISDK(ai, {
  client: langsmithClient,
});

export const getQueryResult = async (
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
  queryResult: string[],
  validationError?: string
) => {
  const correction = validationError
    ? `

          Your previous response failed shape validation: ${validationError}.
          Re-emit the JSON, strictly obeying:
          - bar/line: xAxis=[{data:[strings]}], series=[{data:[numbers]}], data=null
          - pie:      data=[{id,value,label}], xAxis=null, series=null
        `
    : "";

  switch (routingAgentResult.mode) {
    case RoutingType.SQL:
      return `
          reasoning: ${routingAgentResult.reasoning}
          sql: ${routingAgentResult.sql}
          data: ${JSON.stringify(queryResult)}
          chartType: ${routingAgentResult.chartType}
${correction}
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

export const proceedRoutingAgent = async (
  model: LanguageModel,
  currentMessageContent: string,
  formattedPreviousMessages: string
) => {
  try {
    const { output: routingAgentResult } = await generateText({
      model,
      output: Output.object({ schema: getRoutingAgentSchema() }),
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

export const proceedInterpretAgent = (
  model: LanguageModel,
  routingAgentResult: RoutingAgentResult,
  queryResult: string[],
  validationError?: string
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
      prompt: getInterpretAgentPrompt(
        routingAgentResult,
        queryResult,
        validationError
      ),
    });

    console.debug("✅ Interpret Agent stream started.");

    return interpretAgentResult;
  } catch (error) {
    throw new Error(`❌ Failed to Process Interpret Agent: ${error}`);
  }
};

export async function runChatPipelineCore(args: {
  model: LanguageModel;
  question: string;
  history?: string;
}) {
  const finalState = await chatGraph.invoke({
    model: args.model,
    question: args.question,
    history: args.history ?? "",
  });

  return {
    routingAgentResult: finalState.routingAgentResult!,
    queryResult: finalState.queryResult,
    interpretStream: finalState.interpretStream!,
  };
}
