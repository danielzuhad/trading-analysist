import { z } from "zod";
import {
  currencyCodeSchema,
  idSchema,
  metadataSchema,
  nonEmptyStringSchema,
} from "./common.js";
import { assetClassSchema } from "./primitives.js";

export const assetSchema = z.object({
  id: idSchema,
  symbol: nonEmptyStringSchema,
  displaySymbol: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  assetClass: assetClassSchema,
  market: nonEmptyStringSchema,
  exchange: nonEmptyStringSchema,
  instrumentType: nonEmptyStringSchema,
  baseCurrency: currencyCodeSchema.optional(),
  quoteCurrency: currencyCodeSchema.optional(),
  providerSymbol: nonEmptyStringSchema.optional(),
  isActive: z.boolean(),
  metadata: metadataSchema,
});

export type Asset = z.infer<typeof assetSchema>;
