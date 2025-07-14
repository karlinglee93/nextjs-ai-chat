"use client";

import { useChat } from "@ai-sdk/react";
import { useRef, useEffect, useState } from "react";
import { BarChart, LineChart, PieChart } from "@mui/x-charts";

import { appConfig } from "@/lib/config";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import UserBubble from "@/components/ui/bubble_user";
import AssistantBubble from "@/components/ui/bubble_assistant";

export function Chat() {
  const [curAssistantMessage, setCurAssistantMessage] = useState<null | {
    reasoning: string;
    sql: string | null;
    data: string;
    interpret: string;
    chartType: "bar" | "line" | "pie" | null;
    formattedData: any;
  }>(null);

  const { messages, input, handleInputChange, handleSubmit, setInput } =
    useChat({
      api: "api/chat",
      onError: (e) => {
        console.log(e);
      },
      onFinish: (message) => {
        setCurAssistantMessage(JSON.parse(message.content));
      },
    });
  const chatParent = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const domNode = chatParent.current;
    if (domNode) {
      domNode.scrollTop = domNode.scrollHeight;
    }
  });

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

  // console.log(messages.length);
  console.log(curAssistantMessage && curAssistantMessage.chartType);
  console.log(curAssistantMessage && curAssistantMessage.formattedData);

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
        <ul
          ref={chatParent}
          className="flex flex-col gap-4 p-4 max-w-3xl mx-auto"
        >
          {messages.map((m, i) =>
            m.role === "user" ? (
              <UserBubble key={i} text={m.content as string} />
            ) : (
              <AssistantBubble key={i} text={m.content as string} />
            )
          )}
          {curAssistantMessage && (
            <div>
              <p>Reasoning: {curAssistantMessage.reasoning}</p>
              <p>SQL: {curAssistantMessage.sql}</p>
              <p>Data: {JSON.stringify(curAssistantMessage.data)}</p>
              <p>Interpret: {curAssistantMessage.interpret}</p>
              <p>Chart Type: {curAssistantMessage.chartType}</p>
              <p>
                Chart Data: {JSON.stringify(curAssistantMessage.formattedData)}
              </p>
              {curAssistantMessage?.chartType === "bar" &&
                !!curAssistantMessage?.data &&
                !!curAssistantMessage?.formattedData && (
                  <BarChart
                    xAxis={[
                      { data: curAssistantMessage.formattedData.xAxis[0].data },
                    ]}
                    series={[
                      {
                        data: curAssistantMessage.formattedData.series[0].data,
                      },
                    ]}
                    height={300}
                  />
                )}
              {curAssistantMessage.chartType === "line" &&
                !!curAssistantMessage?.data &&
                !!curAssistantMessage?.formattedData && (
                  <LineChart
                    xAxis={[
                      { data: curAssistantMessage.formattedData.xAxis[0].data },
                    ]}
                    series={[
                      {
                        data: curAssistantMessage.formattedData.series[0].data,
                      },
                    ]}
                    height={300}
                  />
                )}
              {curAssistantMessage.chartType === "pie" &&
                !!curAssistantMessage?.data &&
                !!curAssistantMessage?.formattedData && (
                  <PieChart
                    series={[{ data: curAssistantMessage.formattedData.data }]}
                    width={200}
                    height={200}
                  />
                )}
            </div>
          )}
        </ul>
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
