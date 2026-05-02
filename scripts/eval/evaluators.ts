import { generateText as plainGenerateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { Output } from "ai";
import { z } from "zod";
import type { EvaluationResult } from "langsmith/evaluation";

import { validateChartShape } from "@/lib/chart-validation";
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
  const result = validateChartShape(outputs.formattedData, outputs.chartType);
  return {
    key: "chart_shape",
    score: result.ok ? 1 : 0,
    comment: result.reason,
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
