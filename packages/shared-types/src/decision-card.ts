import { z } from "zod";
import { nonEmptyStringSchema } from "./common.js";
import { riskLevelSchema } from "./primitives.js";

export const decisionCardSchema = z.object({
  summary: nonEmptyStringSchema,
  keyReasons: z.array(nonEmptyStringSchema).min(1),
  actionPlan: z.array(nonEmptyStringSchema).min(1),
  executionMethod: nonEmptyStringSchema,
  invalidation: nonEmptyStringSchema,
  riskLevel: riskLevelSchema,
});

export type DecisionCard = z.infer<typeof decisionCardSchema>;
