// RAG Pattern Chat with JSON Object/File
import {
  Message as VercelChatMessage,
  StreamingTextResponse,
  createStreamDataTransformer,
} from "ai";

import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { HttpResponseOutputParser } from "langchain/output_parsers";
import { JSONLoader } from "langchain/document_loaders/fs/json";
import { RunnableSequence } from "@langchain/core/runnables";
import { formatDocumentsAsString } from "langchain/util/document";
import { CharacterTextSplitter } from "langchain/text_splitter";

import { getPromptTemplate } from "@/lib/promptTemplates";
import { appConfig } from "@/lib/config";

const loader = new JSONLoader("public/data/output.json", [
  "/douyin_id",
  "/name",
  "/region",
  "/gender",
  "/total_sales_amount",
  "/product_name",
  "/product_category",
]);

export const dynamic = "force-dynamic";

/**
 * Basic memory formatter that stringifies and passes
 * message history directly into the model.
 */
const formatMessage = (message: VercelChatMessage) => {
  return `*${message.role}: ${message.content}*`;
};

const TEMPLATE = getPromptTemplate(appConfig.assistantName);

export async function POST(req: Request) {
  try {
    // Extract the messages from the body of the request
    const { messages } = await req.json();

    const formattedPreviousMessages = messages
      .slice(0, -1)
      .map(formatMessage)
      .join("\n");

    const currentMessageContent = messages[messages.length - 1].content;

    const docs = await loader.load();

    const prompt = PromptTemplate.fromTemplate(TEMPLATE);

    const { modelName, temperature, streaming, verbose } = appConfig.model;
    const model = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
      model: modelName,
      temperature,
      streaming,
      verbose,
    });

    /**
     * Chat models stream message chunks rather than bytes, so this
     * output parser handles serialization and encoding.
     */
    const parser = new HttpResponseOutputParser();

    const chain = RunnableSequence.from([
      {
        question: (input) => input.question,
        chat_history: (input) => input.chat_history,
        context: () => formatDocumentsAsString(docs),
      },
      prompt,
      model,
      parser,
    ]);

    // Convert the response into a friendly text-stream
    const stream = await chain.stream({
      chat_history: formattedPreviousMessages,
      question: currentMessageContent,
    });

    // Respond with the stream
    return new StreamingTextResponse(
      stream.pipeThrough(createStreamDataTransformer())
    );
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
