import { cookies } from "next/headers";
import { cache } from "react";
import { SESSION_COOKIE_NAME } from "@/lib/session-constants";

export { SESSION_COOKIE_NAME } from "@/lib/session-constants";

const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const getSessionToken = cache(async (): Promise<string | undefined> => {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
});

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(SESSION_EMAIL_COOKIE_NAME);
}

const SESSION_EMAIL_COOKIE_NAME = "session_email";

export const getSessionEmail = cache(async (): Promise<string | undefined> => {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_EMAIL_COOKIE_NAME)?.value;
});

export async function setSessionEmailCookie(email: string): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_EMAIL_COOKIE_NAME, email, {
    httpOnly: false,
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
