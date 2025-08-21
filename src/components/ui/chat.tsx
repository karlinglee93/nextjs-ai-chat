"use client";

import { useChat } from "@ai-sdk/react";
import { useRef, useEffect } from "react";

import { appConfig } from "@/lib/config";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import UserBubble from "@/components/ui/bubble_user";
import AssistantBubble from "@/components/ui/bubble_assistant";
import Image from "next/image";

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit, setInput, status } =
    useChat({
      api: "api/chat",
      onError: (e) => {
        console.log(e);
      },
    });
  const chatParent = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const node = chatParent.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const listener = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const question = customEvent.detail;
      setInput(question);
      setTimeout(() => {
        handleSubmit(new Event("submit") as any);
      }, 50);
    };

    window.addEventListener("send-chat", listener);
    return () => {
      window.removeEventListener("send-chat", listener);
    };
  }, [handleSubmit, setInput]);

  return (
    <main className="flex flex-col h-screen bg-background">
      <header className="sticky top-0 z-10 w-full bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="flex items-center px-4 py-3 max-w-7xl mx-auto">
          <h1 className="text-lg font-medium text-gray-800">
            {appConfig.title}
          </h1>
        </div>
      </header>

      <section className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Image
              src="/chatbot.jpg"
              width={64}
              height={64}
              className="w-64 h-auto"
              alt="Welcome Chat"
            />
            <p className="mt-4 text-gray-500">Start your conversation here</p>
          </div>
        ) : (
          <ul
            ref={chatParent}
            className="flex flex-col space-y-2 px-4 py-2 max-w-[1000px] mx-auto overflow-y-auto"
          >
            {messages.map((m, i) => {
              const isLast = i === messages.length - 1;
              const streaming =
                isLast && m.role === "assistant" && status === "streaming";

              return m.role === "user" ? (
                <UserBubble key={i} text={m.content as string} />
              ) : (
                <AssistantBubble
                  key={i}
                  content={m.content as string}
                  streaming={streaming}
                />
              );
            })}
          </ul>
        )}
      </section>

      <form
        onSubmit={handleSubmit}
        className="sticky bottom-0 bg-background border-t w-full"
      >
        <div className="max-w-3xl mx-auto flex items-center p-4">
          <Input
            className="flex-1 min-h-[40px] rounded-lg px-4 py-2 text-sm border border-gray-300 bg-[#f7f7f8] shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Send a message..."
            value={input}
            onChange={handleInputChange}
          />
          <Button
            className="ml-2 px-4 py-2 rounded-xl text-sm"
            type="submit"
            disabled={!input.trim()}
          >
            Send
          </Button>
        </div>
      </form>
    </main>
  );
}
