import { generateText as plainGenerateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { Output } from "ai";
import { z } from "zod";
import type { EvaluationResult } from "langsmith/evaluation";

import { appConfig } from "@/lib/config";

type EvalArgs = {
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  referenceOutputs?: Record<string, any>;
};

const SKIP: EvaluationResult[] = [];

const judgeModel = openai(appConfig.model);

const judgeScoreSchema = z.object({
  score: z.number().min(0).max(1),
  reason: z.string(),
});

async function llmJudge(
  systemPrompt: string,
  userPrompt: string
): Promise<{ score: number; reason: string }> {
  const { output } = await plainGenerateText({
    model: judgeModel,
    output: Output.object({ schema: judgeScoreSchema }),
    system: systemPrompt,
    prompt: userPrompt,
  });
  return output as { score: number; reason: string };
}

export const routingModeEvaluator = ({
  outputs,
  referenceOutputs,
}: EvalArgs): EvaluationResult => {
  const expected = referenceOutputs?.expectedMode;
  const actual = outputs.mode;
  return {
    key: "routing_mode",
    score: expected && actual === expected ? 1 : 0,
    comment: `expected=${expected ?? "n/a"} actual=${actual ?? "n/a"}`,
  };
};

export const chartTypeEvaluator = ({
  outputs,
  referenceOutputs,
}: EvalArgs): EvaluationResult | EvaluationResult[] => {
  if (referenceOutputs?.expectedMode !== "sql") return SKIP;
  const expected = referenceOutputs.expectedChartType;
  const actual = outputs.chartType ?? null;
  return {
    key: "chart_type",
    score: expected && actual === expected ? 1 : 0,
    comment: `expected=${expected ?? "n/a"} actual=${actual ?? "n/a"}`,
  };
};

export const chartShapeEvaluator = ({
  outputs,
  referenceOutputs,
}: EvalArgs): EvaluationResult | EvaluationResult[] => {
  if (referenceOutputs?.expectedMode !== "sql") return SKIP;
  const fd = outputs.formattedData;
  const chartType = outputs.chartType;
  if (!fd || !chartType) {
    return { key: "chart_shape", score: 0, comment: "missing formattedData or chartType" };
  }

  // bar/line need xAxis[0].data and series[0].data populated (renderer accesses
  // them positionally, see bubble_assistant.tsx). pie needs data[] populated.
  const xAxisFilled =
    Array.isArray(fd.xAxis) &&
    fd.xAxis.length > 0 &&
    Array.isArray(fd.xAxis[0]?.data) &&
    fd.xAxis[0].data.length > 0;
  const seriesFilled =
    Array.isArray(fd.series) &&
    fd.series.length > 0 &&
    Array.isArray(fd.series[0]?.data) &&
    fd.series[0].data.length > 0;
  const dataFilled = Array.isArray(fd.data) && fd.data.length > 0;

  // Treat null and undefined ("omitted") as equivalent for absent fields.
  const xAxisAbsent = fd.xAxis == null;
  const seriesAbsent = fd.series == null;
  const dataAbsent = fd.data == null;

  let pass = false;
  if (chartType === "bar" || chartType === "line") {
    pass = xAxisFilled && seriesFilled && dataAbsent;
  } else if (chartType === "pie") {
    pass = dataFilled && xAxisAbsent && seriesAbsent;
  }

  const describe = (filled: boolean, absent: boolean) =>
    filled ? "filled" : absent ? "absent" : "malformed";

  return {
    key: "chart_shape",
    score: pass ? 1 : 0,
    comment: `chartType=${chartType} xAxis=${describe(xAxisFilled, xAxisAbsent)} series=${describe(seriesFilled, seriesAbsent)} data=${describe(dataFilled, dataAbsent)}`,
  };
};

export const sqlCorrectnessEvaluator = async ({
  inputs,
  outputs,
  referenceOutputs,
}: EvalArgs): Promise<EvaluationResult | EvaluationResult[]> => {
  if (referenceOutputs?.expectedMode !== "sql") return SKIP;
  if (!referenceOutputs.referenceSql || !outputs.sql) {
    return {
      key: "sql_correctness",
      score: 0,
      comment: "missing candidate or reference SQL",
    };
  }
  const { score, reason } = await llmJudge(
    "You are a SQL equivalence judge. Return score=1 if the candidate SQL would return semantically equivalent rows to the reference SQL for the user's question (ignoring column aliases, ordering when not requested, and trivial syntactic differences). Otherwise return score=0. Use 0.5 only for partial matches that get the right shape but wrong filtering or grouping.",
    `User question:\n${inputs.question}\n\nReference SQL:\n${referenceOutputs.referenceSql}\n\nCandidate SQL:\n${outputs.sql}`
  );
  return { key: "sql_correctness", score, comment: reason };
};

export const answerQualityEvaluator = async ({
  inputs,
  outputs,
  referenceOutputs,
}: EvalArgs): Promise<EvaluationResult | EvaluationResult[]> => {
  if (!outputs.answer) {
    return { key: "answer_quality", score: 0, comment: "no answer produced" };
  }
  const reference = referenceOutputs?.referenceAnswer
    ? `\n\nReference answer (gold):\n${referenceOutputs.referenceAnswer}`
    : "";
  const { score, reason } = await llmJudge(
    "You are an answer-quality judge for a TikTok sales analytics assistant. Score 0..1 how well the candidate answer addresses the user's question. 1 = directly and accurately addresses it; 0.5 = partially relevant but missing key parts; 0 = irrelevant or wrong. Be strict.",
    `User question:\n${inputs.question}\n\nCandidate answer:\n${outputs.answer}${reference}`
  );
  return { key: "answer_quality", score, comment: reason };
};
