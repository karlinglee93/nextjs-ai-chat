"use client";

import { useChat, UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState } from "react";

import { appConfig } from "@/lib/config";

import { Input } from "@/components/input";
import { Button } from "@/components/button";
import UserBubble from "@/components/bubble_user";
import AssistantBubble from "@/components/bubble_assistant";
import Image from "next/image";
import LogoutButton from "./button_logout";

const getTextContent = (msg: UIMessage) =>
  msg.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { type: "text"; text: string }).text)
    .join("");

export function Chat() {
  const [inputValue, setInputValue] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "api/chat" }),
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
      const question = (e as CustomEvent<string>).detail;
      sendMessage({ text: question });
    };

    window.addEventListener("send-chat", listener);
    return () => {
      window.removeEventListener("send-chat", listener);
    };
  }, [sendMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    sendMessage({ text: inputValue });
    setInputValue("");
  };

  return (
    <main className="flex flex-col h-screen bg-background">
      <header className="sticky top-0 z-10 w-full bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="flex justify-between items-center px-4 py-3 max-w-7xl mx-auto">
          <h1 className="text-lg font-medium text-gray-800">
            {appConfig.title}
          </h1>
          <LogoutButton />
        </div>
      </header>

      <section className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Image
              src="/chatbot.png"
              width={64}
              height={64}
              className="w-64 h-auto"
              alt="Welcome Chat"
              priority
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
                <UserBubble key={i} text={getTextContent(m)} />
              ) : (
                <AssistantBubble
                  key={i}
                  content={getTextContent(m)}
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
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <Button
            className="ml-2 px-4 py-2 rounded-xl text-sm"
            type="submit"
            disabled={!inputValue.trim()}
          >
            Send
          </Button>
        </div>
      </form>
    </main>
  );
}
