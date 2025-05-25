// Chat with Personality
import {
  StreamingTextResponse,
  createStreamDataTransformer,
  Message as VercelChatMessage,
} from "ai";

import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { HttpResponseOutputParser } from "langchain/output_parsers";

export const dynamic = "force-dynamic";

/**
 * Format each message from chat history into string format.
 * Example: "user: Hello"
 */
const formatMessage = (message: VercelChatMessage) =>
  `${message.role}: ${message.content}`;

const TEMPLATE = `
You are a black people named Patchy. All responses
must be extremely verbose and in black dialect.

Current conversation:
{chat_history}
user: {input}
assistant:
`;

export async function POST(req: Request) {
  try {
    // 1. Get messages from request body
    const { messages } = await req.json();

    // 2. Extract chat history (all but last message)
    const formattedPreviousMessages = messages
      .slice(0, -1)
      .map(formatMessage)
      .join("\n");

    const currentMessageContent = messages.at(-1).content;

    // 3. Set up LangChain components
    const prompt = PromptTemplate.fromTemplate(TEMPLATE);

    const model = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
      model: "gpt-3.5-turbo",
      temperature: 0.8,
      streaming: true,
      verbose: true,
    });

    const parser = new HttpResponseOutputParser();

    const chain = prompt.pipe(model.bind({ stop: ["?"] })).pipe(parser);

    // 4. Stream the response
    const stream = await chain.stream({
      chat_history: formattedPreviousMessages,
      input: currentMessageContent,
    });

    // 5. Return stream to client
    return new StreamingTextResponse(
      stream.pipeThrough(createStreamDataTransformer())
    );
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
