import { generateObject, Output, streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

import { appConfig } from "@/lib/config";
import { formatMessage, queryDb } from "@/lib/utils";
import { interpAgentSchema } from "@/lib/schema";
import { setupGlobalProxy } from "@/lib/proxy";

setupGlobalProxy();

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const formattedPreviousMessages = messages
      .slice(0, -1)
      .map(formatMessage)
      .join("\n");
    const currentMessageContent = messages[messages.length - 1].content;

    const model = openai(appConfig.model);
    const { object: sqlAgentResp } = await generateObject({
      model,
      schema: z.object({
        reasoning: z
          .string()
          .describe(
            "short natural-language explanation of how the AI thinks about the user's question, including its logic for deciding whether a SQL query can answer it. This should reflect the AI's thought process (string)"
          ),
        canSql: z
          .boolean()
          .describe(
            "true if the question can be answered with a SQL query, false otherwise (boolean)"
          ),
        sql: z
          .string()
          .nullable()
          .describe(
            "PostgreSQL query string if canSql is true, null if false (string or null)"
          ),
      }),
      system: `
        You are an AI assistant that analyzes natural-language questions and decides whether they can be answered using SQL over the \`tiktok_sales\` table.
        
        Allowed columns, along with their meanings:
        - douyin_id: Douyin account ID
        - name: User's name
        - bio: Account bio or description
        - region: User's region
        - gender: "F" or "M"
        - follower_count: Number of followers
        - video_count: Number of videos
        - duration: Livestream duration in seconds
        - average_views: Average viewers during livestream
        - total_likes: Total number of likes
        - total_danmaku_count: Total number of danmaku (chat comments)
        - danmaku_user_count: Number of users who sent danmaku
        - danmaku_content: Content of danmaku (chat messages)
        - total_sales_amount: Total sales amount during livestream
        - gift_senders_count: Number of gift senders
        - gift_income: Total income from gifts
        - top_donors: List of top donors
        - product_category: Category of promoted product

        Return a JSON object *exactly* matching this schema:
        {
          "reasoning": "AI's thought process about the question — how it interprets the user's question, and why SQL can or cannot be used",
          "canSql": true | false,
          "sql": "...valid **PostgreSQL** SQL query..." | null
        }

        Rules:
        1. If the dataset cannot answer the question, set "canSql": false and "sql": null, and use "reasoning" to briefly say **why not**.
        2. If it can, set "canSql": true, provide a valid SQL statement, and use "reasoning" to briefly say **why** the query answers the question.
        3. Keep reasoning ≤ 40 words.
        4. Output nothing outside the JSON block.
      `,
      prompt: `
        User question:
        ${currentMessageContent}

        Chat history:
        ${formattedPreviousMessages}

        Respond with the required JSON only.
      `,
    });

    const dbRows = [];
    if (sqlAgentResp.canSql) {
      dbRows.push(...(await queryDb(sqlAgentResp.sql!)));
    }

    const result = await streamText({
      model,
      experimental_output: Output.object({
        schema: interpAgentSchema,
      }),
      system: `
          You are a senior data-analytics assistant.

          ➊ Write "interpret" (≤40 words).
          ➋ Pick ONE best chart type:
            • Bar  – comparing categorical groups (xAxis = strings)
            • Line – showing numeric trend over a continuous x-axis (xAxis = numbers)
            • Pie  – parts-of-whole at one snapshot
            Set chartType to that single value.

          ➌ Build formattedData:
            • For bar  : 
                { xAxis:[{ data:["A","B"] }], series:[{ data:[4,2] }] }
            • For line : 
                { xAxis:[{ data:[1,2,3] }], series:[{ data:[5,6,7] }] }
            • For pie  : 
                { data:[{ id:0, value:10, label:"A" }, ...] }

          Return JSON only:
          {
            "reasoning": "<same as input reasoning>",
            "sql": "<same as input sql>",
            "data": "<same as input data>",
            "interpret": "...",
            "chartType": "bar" | "line" | "pie",
            "formattedData": { ... }
          }
          No extra keys, no markdown.
        `,
      prompt: `
          reasoning: ${sqlAgentResp.reasoning}
          sql: ${sqlAgentResp.sql}
          data: ${JSON.stringify(dbRows)}

          Respond with the required JSON only.
      `,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.log("error:", error);
    return Response.json(
      { error: error.message },
      { status: error.status ?? 500 }
    );
  }
}
