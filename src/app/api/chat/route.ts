import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { HttpResponseOutputParser } from "langchain/output_parsers";
import { db } from "@vercel/postgres";
import { LangChainAdapter } from "ai";
// import { HttpsProxyAgent } from "https-proxy-agent";

import { appConfig } from "@/lib/config";
import {
  getSqlGeneratorPromptTemplate,
  getDataAnalyzerPromptTemplate,
} from "@/lib/promptTemplates";
import { formatMessage } from "@/lib/utils";

// const proxyAgent = new HttpsProxyAgent("http://127.0.0.1:7890");

// 1. Setup env variables
const { OPENAI_API_KEY } = process.env;

// 2. Setup prompt
const { sqlGeneratorSystemMessage, sqlGeneratorHumanMessage } =
  getSqlGeneratorPromptTemplate();
const sqlGeneratorPromptTemplate = ChatPromptTemplate.fromMessages([
  sqlGeneratorSystemMessage,
  sqlGeneratorHumanMessage,
]);
const { dataAnalyzerSystemMessage } = getDataAnalyzerPromptTemplate();
const dataAnalyzerPromptTemplate = ChatPromptTemplate.fromMessages([
  dataAnalyzerSystemMessage,
]);

// 3. Setup openai model
const { modelName, temperature, streaming, verbose } = appConfig.model;
const model = new ChatOpenAI({
  apiKey: OPENAI_API_KEY!,
  model: modelName,
  temperature,
  streaming,
  verbose,
  timeout: 15000,
  // configuration: {
  //   httpAgent: proxyAgent,
  // },
});

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const formattedPreviousMessages = messages
      .slice(0, -1)
      .map(formatMessage)
      .join("\n");
    const currentMessageContent = messages[messages.length - 1].content;

    // Setup sql generator chain
    const parser = new JsonOutputParser();
    const sqlGeneratorChain = RunnableSequence.from([
      {
        question: (input) => input.question,
        chat_history: (input) => input.chat_history,
      },
      sqlGeneratorPromptTemplate,
      model,
      parser,
    ]);

    // Get response
    const sqlGeneratorResponse = await sqlGeneratorChain.invoke({
      chat_history: formattedPreviousMessages,
      question: currentMessageContent,
    });

    // Process the response
    let result = [];
    let canAnswer = sqlGeneratorResponse.can_answer;

    if (canAnswer) {
      const client = await db.connect();
      const queryResult = await client.query(sqlGeneratorResponse.sql);
      result = queryResult.rows;
      client.release();
    }

    // Setup data analyzer chain
    const dataAnalyzerChain = RunnableSequence.from([
      {
        reasoning: (input) => input.reasoning,
        sql: (input) => input.sql,
        data: (input) => input.data,
        chat_history: (input) => input.chat_history,
      },
      dataAnalyzerPromptTemplate,
      model,
      new HttpResponseOutputParser(),
    ]);

    console.log(`reasoning: ${sqlGeneratorResponse.reasoning}`);
    console.log(`sql: ${sqlGeneratorResponse.sql}`);
    console.log(`data: ${JSON.stringify(result)}`);

    const stream = await dataAnalyzerChain.stream({
      reasoning: sqlGeneratorResponse.reasoning,
      sql: sqlGeneratorResponse.sql,
      data: JSON.stringify(result),
      chat_history: formattedPreviousMessages,
    });

    return LangChainAdapter.toDataStreamResponse(
      stream.pipeThrough(new TextDecoderStream())
    );
  } catch (error) {
    console.log("error:", error);
    return Response.json(
      { error: error.message },
      { status: error.status ?? 500 }
    );
  }
}
