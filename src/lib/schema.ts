import { z } from "zod";

/*
 * Agent1
 */
export const getAgent1Schema = () =>
  z.object({
    reasoning: z
      .string()
      .describe(
        "short natural-language explanation of how the AI thinks about the user's question, including its logic for deciding whether a SQL query can answer it. This should reflect the AI's thought process"
      ),
    type: z.enum(["general", "technical"]).describe(
      `"technical" if the question can be answered with a SQL query; 
       "general" if it's a broader or open-ended question not suitable for SQL
      `
    ),
    sql: z
      .string()
      .nullable()
      .describe(
        "PostgreSQL query string if type is 'technical', otherwise null"
      ),
    chartType: z
      .enum(["line", "bar", "pie", "auto"])
      .default("auto")
      .describe(
        `Desired chart type.
       • If the user's input explicitly requests "line", "bar", or "pie", return that value.  
       • Otherwise return "auto" (the downstream agent decides).`
      ),
  });

/*
 * Agent2
 */
// Bar chart format
const barFormat = z.object({
  xAxis: z.tuple([z.object({ data: z.array(z.string()) })]),
  series: z.array(z.object({ data: z.array(z.number()) })),
});

// Line chart format
const lineFormat = z.object({
  xAxis: z.tuple([z.object({ data: z.array(z.number()) })]),
  series: z.array(z.object({ data: z.array(z.number()) })),
});

// Pie chart format
const pieFormat = z.object({
  data: z.array(
    z.object({
      id: z.number(),
      value: z.number(),
      label: z.string(),
    })
  ),
});

// Master schema
export const getAgent2Schema = () =>
  z.object({
    reasoning: z.string().describe("same as input reasoning"),
    sql: z.string().nullable().describe("same as input sql"),
    data: z.string().describe("same as input data"),
    interpret: z.string().describe("short insight about the data (≤50 words)"),
    chartType: z
      .enum(["bar", "line", "pie"])
      .describe(
        "`bar`, `line`, or `pie`(if the user asked for a specific chart, use that, otherwise choose the single best chart type for displaying the data)"
      ),
    formattedData: z
      .union([barFormat, lineFormat, pieFormat])
      .describe(
        [
          "If bar  -> { xAxis:[{ data:[string] }], series:[{ data:[number] }] }",
          "If line -> { xAxis:[{ data:[number] }], series:[{ data:[number] }] }",
          "If pie  -> { data:[{ id, value, label }] }",
        ].join("\n")
      ),
  });
