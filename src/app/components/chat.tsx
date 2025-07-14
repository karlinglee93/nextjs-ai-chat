"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useChat } from "@ai-sdk/react";
import { useRef, useEffect, useState } from "react";
import { BarChart, LineChart, PieChart } from "@mui/x-charts";

import { appConfig } from "@/lib/config";

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
    <main className="flex flex-col w-full h-screen max-h-dvh bg-background">
      <header className="p-4 border-b w-full max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold">{appConfig.title}</h1>
      </header>

      <section className="p-4">
        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-3xl mx-auto items-center"
        >
          <Input
            className="flex-1 min-h-[40px]"
            placeholder="Type your question here..."
            type="text"
            value={input}
            onChange={handleInputChange}
          />
          <Button className="ml-2" type="submit">
            Submit
          </Button>
        </form>
      </section>

      <section className="container px-0 pb-10 flex flex-col flex-grow gap-4 mx-auto max-w-3xl">
        <ul
          ref={chatParent}
          className="h-1 p-4 flex-grow bg-muted/50 rounded-lg overflow-y-auto flex flex-col gap-4"
        >
          {messages.map((m, index) => (
            <>
              {m.role === "user" ? (
                <li key={index} className="flex flex-row">
                  <div className="rounded-xl p-4 bg-background shadow-md flex">
                    <p className="text-primary">{m.content}</p>
                  </div>
                </li>
              ) : (
                <li key={index} className="flex flex-row-reverse">
                  <div className="rounded-xl p-4 bg-background shadow-md flex w-3/4">
                    <p className="text-primary">
                      <span className="font-bold">{`${appConfig.assistantName}: `}</span>
                      {m.content}
                    </p>
                  </div>
                </li>
              )}
            </>
          ))}
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
              {curAssistantMessage.chartType === "bar" && (
                <BarChart
                  xAxis={[
                    { data: curAssistantMessage.formattedData.xAxis[0].data },
                  ]}
                  series={[
                    { data: curAssistantMessage.formattedData.series[0].data },
                  ]}
                  height={300}
                />
              )}
              {curAssistantMessage.chartType === "line" && (
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
              {curAssistantMessage.chartType === "pie" && (
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
    </main>
  );
}
