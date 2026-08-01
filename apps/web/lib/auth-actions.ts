"use server";

import {
  loginInputSchema,
  loginResponseSchema,
} from "@trading-analyst/shared-types";
import { redirect } from "next/navigation";
import { buildApiAuthHeaders } from "@/lib/api-auth";
import { loadWebEnv } from "@/lib/env";
import {
  clearSessionCookie,
  getSessionToken,
  setSessionCookie,
  setSessionEmailCookie,
  setSessionRoleCookie,
} from "@/lib/session";

export type LoginActionResult = {
  message: string;
  status: "error";
};

export async function loginAction(
  _prevState: LoginActionResult | null,
  formData: FormData,
): Promise<LoginActionResult | null> {
  const { NEXT_PUBLIC_API_BASE_URL: apiBaseUrl } = loadWebEnv();

  if (!apiBaseUrl) {
    return { message: "API base URL is not configured.", status: "error" };
  }

  const parsedInput = loginInputSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsedInput.success) {
    return { message: "Enter a valid email and password.", status: "error" };
  }

  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}/auth/login`, {
      body: JSON.stringify(parsedInput.data),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  } catch {
    return { message: "Could not reach the API.", status: "error" };
  }

  if (!response.ok) {
    return {
      message:
        response.status === 401
          ? "Invalid email or password."
          : `Login failed (status ${response.status}).`,
      status: "error",
    };
  }

  const payload = loginResponseSchema.safeParse(await response.json());

  if (!payload.success) {
    return { message: "Login response was invalid.", status: "error" };
  }

  await setSessionCookie(payload.data.token);
  await setSessionEmailCookie(payload.data.user.email);
  await setSessionRoleCookie(payload.data.user.role);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const { NEXT_PUBLIC_API_BASE_URL: apiBaseUrl } = loadWebEnv();
  const sessionToken = await getSessionToken();

  if (apiBaseUrl && sessionToken) {
    try {
      await fetch(`${apiBaseUrl}/auth/logout`, {
        headers: await buildApiAuthHeaders(),
        method: "POST",
      });
    } catch {
      // The token still gets revoked eventually via expiry; don't block
      // sign-out on the API being reachable.
    }
  }

  await clearSessionCookie();
  redirect("/login");
}
