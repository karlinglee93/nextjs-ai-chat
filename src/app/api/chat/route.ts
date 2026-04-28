import { openai } from "@ai-sdk/openai";
import { traceable } from "langsmith/traceable";
import { after } from "next/server";

import { appConfig } from "@/lib/config";
import { formatMessage } from "@/lib/utils";
import { setupGlobalProxy } from "@/lib/proxy";
import { langsmithClient, runChatPipelineCore } from "@/lib/chat-pipeline";

setupGlobalProxy();

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
        const { interpretStream } = await runChatPipelineCore({
          model,
          question: currentMessageContent,
          history: formattedPreviousMessages,
        });
        return interpretStream;
      },
      { name: "chat-pipeline", client: langsmithClient }
    );

    const interpretStream = await runChatPipeline();

    after(async () => {
      await langsmithClient.awaitPendingTraceBatches();
    });

    return interpretStream.toUIMessageStreamResponse();
  } catch (error) {
    console.log("error:", error);
    return Response.json(
      { error: error.message },
      { status: error.status ?? 500 }
    );
  }
}
