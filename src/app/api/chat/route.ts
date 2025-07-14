import { generateObject, Output, streamText } from "ai";
import { openai } from "@ai-sdk/openai";

import { appConfig } from "@/lib/config";
import { formatMessage, queryDb } from "@/lib/utils";
import { getAgent1Schema, getAgent2Schema } from "@/lib/schema";
import { setupGlobalProxy } from "@/lib/proxy";
import {
  getAgent1SystemPrompt,
  getAgent2GeneralSystemPrompt,
  getAgent2TechnicalSystemPrompt,
} from "@/lib/prompt";

setupGlobalProxy();

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const formattedPreviousMessages = messages
      .slice(0, -1)
      .map(formatMessage)
      .join("\n");
    const currentMessageContent = messages[messages.length - 1].content;

    const model = openai(appConfig.model);
    // Agent 1 - SQL agent
    const { object: agent1Result } = await generateObject({
      model,
      temperature: 0,
      schema: getAgent1Schema(),
      system: getAgent1SystemPrompt(),
      prompt: `
        User question:
        ${currentMessageContent}

        Chat history:
        ${formattedPreviousMessages}

        Respond with the required JSON only.
      `,
    });

    const dbRows = [];
    if (agent1Result.type === "technical") {
      dbRows.push(...(await queryDb(agent1Result.sql!)));
    }

    // Agent 2 - Chart agent
    const agent2Result = streamText({
      model,
      temperature: 0,
      experimental_output: Output.object({
        schema: getAgent2Schema(),
      }),
      system: {
        general: getAgent2GeneralSystemPrompt(),
        technical: getAgent2TechnicalSystemPrompt(),
      }[agent1Result.type],
      prompt: `
        reasoning: ${agent1Result.reasoning}
        sql: ${agent1Result.sql}
        data: ${JSON.stringify(dbRows)}
        chartType: ${agent1Result.chartType}

        Respond with the required JSON only.
      `,
    });

    return agent2Result.toDataStreamResponse();
  } catch (error) {
    console.log("error:", error);
    return Response.json(
      { error: error.message },
      { status: error.status ?? 500 }
    );
  }
}
