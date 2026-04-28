import "./load-env";

import { openai } from "@ai-sdk/openai";
import { evaluate } from "langsmith/evaluation";

import { appConfig } from "@/lib/config";
import {
  langsmithClient,
  runChatPipelineCore,
} from "@/lib/chat-pipeline";
import { setupGlobalProxy } from "@/lib/proxy";
import { evalExamples, type EvalExampleInputs } from "./dataset";
import {
  routingModeEvaluator,
  chartTypeEvaluator,
  chartShapeEvaluator,
  sqlCorrectnessEvaluator,
  answerQualityEvaluator,
} from "./evaluators";

setupGlobalProxy();

const DATASET_NAME = "nextjs-ai-chat-pipeline";

async function ensureDataset() {
  const exists = await langsmithClient.hasDataset({ datasetName: DATASET_NAME });
  if (exists) {
    console.log(`Dataset "${DATASET_NAME}" already exists, reusing.`);
    return;
  }
  console.log(`Creating dataset "${DATASET_NAME}"...`);
  await langsmithClient.createDataset(DATASET_NAME, {
    description: "Sample questions for the chat pipeline routing + interpret agents.",
  });
  await langsmithClient.createExamples(
    evalExamples.map((ex) => ({
      inputs: ex.inputs,
      outputs: ex.outputs,
      dataset_name: DATASET_NAME,
    }))
  );
  console.log(`Seeded ${evalExamples.length} examples.`);
}

async function target(inputs: Record<string, any>) {
  const { question } = inputs as EvalExampleInputs;
  const model = openai(appConfig.model);
  const { routingAgentResult, interpretStream } = await runChatPipelineCore({
    model,
    question,
  });

  // Drain the stream so the run completes and the structured output resolves.
  await interpretStream.consumeStream();
  const finalOutput = (await interpretStream.output) as {
    interpret?: string;
    chartType?: "bar" | "line" | "pie";
    formattedData?: {
      xAxis: Array<{ data: string[] }> | null;
      series: Array<{ data: number[] }> | null;
      data: Array<{ id: number; value: number; label: string }> | null;
    };
  };

  return {
    mode: routingAgentResult.mode,
    sql: routingAgentResult.sql ?? null,
    chartType: routingAgentResult.chartType ?? finalOutput.chartType ?? null,
    formattedData: finalOutput.formattedData ?? null,
    answer: finalOutput.interpret ?? "",
  };
}

async function main() {
  await ensureDataset();

  const result = await evaluate(target, {
    data: DATASET_NAME,
    evaluators: [
      routingModeEvaluator,
      chartTypeEvaluator,
      chartShapeEvaluator,
      sqlCorrectnessEvaluator,
      answerQualityEvaluator,
    ],
    experimentPrefix: "chat-pipeline-eval",
    client: langsmithClient,
    maxConcurrency: 4,
  });

  console.log("Eval finished. Experiment:", result.experimentName);
  await langsmithClient.awaitPendingTraceBatches();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
