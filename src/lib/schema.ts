import { z } from "zod";

// Bar chart format
const barFormat = z.object({
  xAxis: z.tuple([
    z.object({ data: z.array(z.string()) }), // categorical labels
  ]),
  series: z.array(
    z.object({ data: z.array(z.number()) }) // numbers
  ),
});

// Line chart format
const lineFormat = z.object({
  xAxis: z.tuple([
    z.object({ data: z.array(z.number()) }), // numeric x-axis
  ]),
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
export const interpAgentSchema = z.object({
  reasoning: z.string().describe("same as input reasoning"),
  sql: z.string().nullable().describe("same as input sql"),
  data: z.string().describe("same as input data"),
  interpret: z.string().describe("short insight (≤40 words)"),
  chartType: z
    .enum(["bar", "line", "pie"])
    .describe("`bar`, `line`, or `pie`  (exactly one)"),
  formattedData: z.union([barFormat, lineFormat, pieFormat]).describe(`
      » bar  : { xAxis:[{ data:[string] }], series:[{ data:[number] }] }
      » line : { xAxis:[{ data:[number] }], series:[{ data:[number] }] }
      » pie  : { data:[{ id, value, label }] }
    `),
});
