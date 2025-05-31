import { db } from "@vercel/postgres";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
// import { createClient } from "@supabase/supabase-js";

import { appConfig } from "@/lib/config";
import {
  getPromptTemplateAgentAnalysis,
  getPromptTemplateAgentSql,
} from "@/lib/promptTemplates";
import { formatMessage } from "@/lib/utils";
import { createStreamDataTransformer, StreamingTextResponse } from "ai";
import { HttpResponseOutputParser } from "langchain/output_parsers";

export const dynamic = "force-dynamic";

// Setup env variables
const { OPENAI_API_KEY } = process.env;

// Setup prompt
const TEMPLATE_AGENT_SQL = getPromptTemplateAgentSql();
const agentSqlPrompt = PromptTemplate.fromTemplate(TEMPLATE_AGENT_SQL);
const TEMPLATE_AGENT_ANALYSIS = getPromptTemplateAgentAnalysis();
const agentAnalysisPrompt = PromptTemplate.fromTemplate(
  TEMPLATE_AGENT_ANALYSIS
);

// Setup openai model
const { modelName, temperature, streaming, verbose } = appConfig.model;
const model = new ChatOpenAI({
  apiKey: OPENAI_API_KEY!,
  model: modelName,
  temperature,
  streaming,
  verbose,
});

export async function POST(req: Request) {
  try {
    // Handle messages
    const { messages } = await req.json();
    const formattedPreviousMessages = messages
      .slice(0, -1)
      .map(formatMessage)
      .join("\n");
    const currentMessageContent = messages[messages.length - 1].content;

    // Setup chain
    const parser = new HttpResponseOutputParser();
    const agentSqlChain = RunnableSequence.from([
      {
        question: (input) => input.question,
        chat_history: (input) => input.chat_history,
      },
      agentSqlPrompt,
      model,
      parser,
    ]);

    // Agent 1 - convert the response into SQL
    const stream = await agentSqlChain.stream({
      chat_history: formattedPreviousMessages,
      question: currentMessageContent,
    });

    // Connect database
    // const client = await db.connect();
    // client.release();
    // Retrieve data from database based on the generated sql
    // client.query();
    // const res = await client.query(sql.content);
    // await client.end();

    // Respond with the stream
    // Construct response message

    return new StreamingTextResponse(
      stream.pipeThrough(createStreamDataTransformer())
    );
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: error.status ?? 500 }
    );
  }
}
