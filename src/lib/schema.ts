import { z } from "zod";

/*
 * Agent1 - Routing Agent
 */
export const getRoutingAgentSchema = () =>
  z.object({
    mode: z.enum(["sql", "vector", "other"]),
    reasoning: z.string().describe(`
      If mode = sql, explain why SQL can answer the query.
      If mode = vector, explain why a vector similarity search can answer the query.
      If mode = other, explain why neither SQL nor vector similarity search can answer the query.
      Always include the reasoning process used to make this determination.
    `),
    sql: z.string().nullable().optional().describe("PostgreSQL query string"),
    chartType: z
      .enum(["line", "bar", "pie", null])
      .default(null)
      .optional()
      .describe(
        `Desired chart type.
          • If the user's input explicitly requests "line", "bar", or "pie", return that value.  
          • Otherwise return null.`
      ),
    semanticQuery: z
      .string()
      .nullable()
      .optional()
      .describe("Semantic query content"),
  });

/*
 * Agent2 - Interpret Agent
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
export const getChartAgentSchema = () =>
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

export const getVectorAgentSchema = () =>
  z.object({
    reasoning: z.string().describe("same as input reasoning"),
    formattedData: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          bioSnippet: z.string().max(120),
          similarity: z.number().describe("similarity score, e.g., 0.82"),
          reason: z.string().describe("short explanation grounded in bio"),
        })
      )
      .describe("derived from input data"),
    interpret: z.string().describe("short insight about the data (≤120 words)"),
  });

export const getGeneralAgentSchema = () =>
  z.object({
    reasoning: z.string().describe("same as input reasoning"),
    interpret: z.string().describe("short insight about the data (≤120 words)"),
  });
