import z from "zod";
import { getRoutingAgentSchema } from "./schema";

export enum RoutingType {
  SQL = "sql",
  VECTOR = "vector",
  OTHER = "other",
}

export type RoutingTypeValue = "sql" | "vector" | "other";

export type RoutingAgentResult = z.infer<
  ReturnType<typeof getRoutingAgentSchema>
>;

export type AssistantData = {
  reasoning: string;
  interpret: string;
  sql?: string | null;
  data?: any;
  chartType?: "bar" | "line" | "pie" | null;
  formattedData?: any;
};
