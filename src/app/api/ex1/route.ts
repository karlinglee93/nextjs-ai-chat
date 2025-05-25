// LangChain Chat
import { StreamingTextResponse, createStreamDataTransformer } from "ai";

import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { HttpResponseOutputParser } from "langchain/output_parsers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // Extract the 'messages' from the request body
    const { messages } = await req.json();
    const message = messages.at(-1).content;

    // Build the prompt template
    const prompt = PromptTemplate.fromTemplate("{message}");

    // Define the LLM model
    const model = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
      model: "gpt-3.5-turbo",
      temperature: 0.8,
      streaming: true,
    });

    // Output parser: serializes streamed messages
    const parser = new HttpResponseOutputParser();

    // Build LangChain pipeline: prompt → model → parser
    const chain = prompt.pipe(model).pipe(parser);

    // Stream the response
    const stream = await chain.stream({ message });

    const decoder = new TextDecoder();

    // Each chunk has the same interface as a chat message
    for await (const chunk of stream) {
      console.log(chunk?.content);
      if (chunk) {
        console.log(decoder.decode(chunk));
      }
    }

    // Return the stream to the client
    return new StreamingTextResponse(
      stream.pipeThrough(createStreamDataTransformer())
    );
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}
