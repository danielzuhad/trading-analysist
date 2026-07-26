import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type {
  CreateUserInput,
  User,
  UserRole,
} from "@trading-analyst/shared-types";
import { userSchema } from "@trading-analyst/shared-types";
import { eq, sql } from "drizzle-orm";
import { getDb } from "./client.js";
import { apiTokens, users } from "./schema/index.js";

type StoredUserRow = typeof users.$inferSelect;

const SCRYPT_KEY_LENGTH = 64;

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString(
    "hex",
  );

  return `${salt}:${derivedKey}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, derivedKeyHex] = storedHash.split(":");

  if (!salt || !derivedKeyHex) {
    return false;
  }

  const expected = Buffer.from(derivedKeyHex, "hex");
  const actual = scryptSync(password, salt, SCRYPT_KEY_LENGTH);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hashToken(token: string): string {
  return scryptSync(token, "api-token", 32).toString("hex");
}

export function parseUser(row: StoredUserRow): User {
  return userSchema.parse({
    id: row.id,
    email: row.email,
    role: row.role,
    telegramChatId: row.telegramChatId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export async function createUser(
  input: CreateUserInput,
  connectionString?: string,
): Promise<User> {
  const db = getDb(connectionString);
  const passwordHash = hashPassword(input.password);
  const [row] = await db
    .insert(users)
    .values({
      email: input.email,
      passwordHash,
      role: input.role,
      telegramChatId: input.telegramChatId ?? null,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create user.");
  }

  return parseUser(row);
}

export async function getUserByEmail(
  email: string,
  connectionString?: string,
): Promise<User | null> {
  const db = getDb(connectionString);
  const row = await db.query.users.findFirst({
    where: eq(users.email, email.trim().toLowerCase()),
  });

  return row ? parseUser(row) : null;
}

export async function getUserById(
  userId: string,
  connectionString?: string,
): Promise<User | null> {
  const db = getDb(connectionString);
  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  return row ? parseUser(row) : null;
}

export async function listUsers(connectionString?: string): Promise<User[]> {
  const db = getDb(connectionString);
  const rows = await db.query.users.findMany({
    orderBy: (table, { asc }) => [asc(table.createdAt)],
  });

  return rows.map(parseUser);
}

export async function verifyUserPassword(
  email: string,
  password: string,
  connectionString?: string,
): Promise<User | null> {
  const db = getDb(connectionString);
  const row = await db.query.users.findFirst({
    where: eq(users.email, email.trim().toLowerCase()),
  });

  if (!row || !verifyPassword(password, row.passwordHash)) {
    return null;
  }

  return parseUser(row);
}

export async function createApiToken(
  userId: string,
  connectionString?: string,
): Promise<{ token: string; tokenId: string }> {
  const db = getDb(connectionString);
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const [row] = await db
    .insert(apiTokens)
    .values({ userId, tokenHash })
    .returning({ id: apiTokens.id });

  if (!row) {
    throw new Error("Failed to create API token.");
  }

  return { token, tokenId: row.id };
}

export async function revokeApiToken(
  tokenId: string,
  connectionString?: string,
): Promise<{ status: "revoked" | "not_found" }> {
  const db = getDb(connectionString);
  const updated = await db
    .update(apiTokens)
    .set({ revokedAt: sql`now()` })
    .where(eq(apiTokens.id, tokenId))
    .returning({ id: apiTokens.id });

  return { status: updated.length > 0 ? "revoked" : "not_found" };
}

export async function resolveApiToken(
  token: string,
  connectionString?: string,
): Promise<{ userId: string; role: UserRole } | null> {
  const db = getDb(connectionString);
  const tokenHash = hashToken(token);
  const row = await db.query.apiTokens.findFirst({
    where: eq(apiTokens.tokenHash, tokenHash),
  });

  if (!row || row.revokedAt) {
    return null;
  }

  const user = await getUserById(row.userId, connectionString);

  if (!user) {
    return null;
  }

  await db
    .update(apiTokens)
    .set({ lastUsedAt: sql`now()` })
    .where(eq(apiTokens.id, row.id));

  return { userId: user.id, role: user.role };
}

export type { User } from "@trading-analyst/shared-types";
