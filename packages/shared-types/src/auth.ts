import { z } from "zod";
import {
  idSchema,
  isoDatetimeSchema,
  metadataSchema,
  nonEmptyStringSchema,
} from "./common.js";

export const authRoleValues = ["admin", "member", "service"] as const;
export const authRoleSchema = z.enum(authRoleValues);
export type AuthRole = z.infer<typeof authRoleSchema>;

export const authSessionStatusValues = [
  "active",
  "expired",
  "revoked",
] as const;
export const authSessionStatusSchema = z.enum(authSessionStatusValues);
export type AuthSessionStatus = z.infer<typeof authSessionStatusSchema>;

export const authSessionSchema = z.object({
  id: idSchema,
  userId: idSchema,
  roles: z.array(authRoleSchema).min(1),
  scopes: z.array(nonEmptyStringSchema).default([]),
  status: authSessionStatusSchema,
  issuedAt: isoDatetimeSchema,
  expiresAt: isoDatetimeSchema,
  lastValidatedAt: isoDatetimeSchema.optional(),
  metadata: metadataSchema,
});

export const apiAuthContextSchema = z.object({
  userId: idSchema,
  sessionId: idSchema,
  roles: z.array(authRoleSchema).min(1),
  scopes: z.array(nonEmptyStringSchema).default([]),
  metadata: metadataSchema,
});

export type AuthSession = z.infer<typeof authSessionSchema>;
export type ApiAuthContext = z.infer<typeof apiAuthContextSchema>;
