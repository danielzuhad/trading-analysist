import { z } from "zod";

export const idSchema = z.string().trim().min(1);

export const isoDatetimeSchema = z.string().datetime({ offset: true });

export const nonEmptyStringSchema = z.string().trim().min(1);

export const nonNegativeNumberSchema = z.number().finite().min(0);

export const positiveNumberSchema = z.number().finite().positive();

export const percentageScoreSchema = z.number().finite().min(0).max(100);

export const currencyCodeSchema = z.string().trim().min(2).max(16);

export const metadataSchema = z.record(z.string(), z.unknown()).default({});

export const stringListSchema = z.array(nonEmptyStringSchema).default([]);

export type Metadata = z.infer<typeof metadataSchema>;
