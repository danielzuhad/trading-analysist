import { z } from "zod";
import { idSchema, isoDatetimeSchema, nonEmptyStringSchema } from "./common.js";
import { userRoleSchema } from "./primitives.js";

export const userSchema = z.object({
  id: idSchema,
  email: z.string().trim().toLowerCase().email(),
  role: userRoleSchema,
  telegramChatId: nonEmptyStringSchema.optional(),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
});

export type User = z.infer<typeof userSchema>;

export const createUserInputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(12),
  role: userRoleSchema.default("member"),
  telegramChatId: nonEmptyStringSchema.optional(),
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export const userResponseSchema = z.object({
  user: userSchema,
});

export type UserResponse = z.infer<typeof userResponseSchema>;

export const usersResponseSchema = z.object({
  count: z.number().int().nonnegative(),
  users: z.array(userSchema),
});

export type UsersResponse = z.infer<typeof usersResponseSchema>;

export const createApiTokenResponseSchema = z.object({
  token: nonEmptyStringSchema,
  tokenId: idSchema,
  userId: idSchema,
});

export type CreateApiTokenResponse = z.infer<
  typeof createApiTokenResponseSchema
>;

export const requestUserSchema = z.object({
  userId: idSchema,
  role: userRoleSchema,
});

export type RequestUser = z.infer<typeof requestUserSchema>;
