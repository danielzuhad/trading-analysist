"use server";

import { redirect } from "next/navigation";
import { buildApiAuthHeaders } from "@/lib/api-auth";
import { loadWebEnv } from "@/lib/env";
import {
  buildClosePositionPayload,
  buildCreatePositionPayload,
  buildPositionRedirectPath,
  buildUpdatePositionPayload,
} from "@/lib/position-action-payload";
import { clearSessionCookie } from "@/lib/session";

async function redirectToLoginIfUnauthorized(response: {
  status: number;
}): Promise<void> {
  if (response.status === 401) {
    await clearSessionCookie();
    redirect("/login");
  }
}

export async function recordPositionAction(formData: FormData) {
  const symbol = readRequiredString(formData, "symbol");
  const timeframe = readRequiredString(formData, "timeframe");
  const { NEXT_PUBLIC_API_BASE_URL: apiBaseUrl } = loadWebEnv();

  if (!apiBaseUrl) {
    redirect(buildPositionRedirectPath({ symbol, timeframe, status: "api" }));
  }

  const payload = buildCreatePositionPayload(formData);
  const response = await submitPositionRequest(`${apiBaseUrl}/positions`, {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
      ...(await buildApiAuthHeaders()),
    },
    method: "POST",
  });

  await redirectToLoginIfUnauthorized(response);

  redirect(
    buildPositionRedirectPath({
      symbol,
      timeframe,
      status: response.ok ? "recorded" : "record-failed",
    }),
  );
}

export async function updatePositionAction(formData: FormData) {
  const symbol = readRequiredString(formData, "symbol");
  const timeframe = readRequiredString(formData, "timeframe");
  const positionId = readRequiredString(formData, "positionId");
  const { NEXT_PUBLIC_API_BASE_URL: apiBaseUrl } = loadWebEnv();

  if (!apiBaseUrl) {
    redirect(buildPositionRedirectPath({ symbol, timeframe, status: "api" }));
  }

  const payload = buildUpdatePositionPayload(formData);
  const response = await submitPositionRequest(
    `${apiBaseUrl}/positions/${positionId}`,
    {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...(await buildApiAuthHeaders()),
      },
      method: "PATCH",
    },
  );

  await redirectToLoginIfUnauthorized(response);

  redirect(
    buildPositionRedirectPath({
      symbol,
      timeframe,
      status: response.ok ? "updated" : "update-failed",
    }),
  );
}

export async function closePositionAction(formData: FormData) {
  const symbol = readRequiredString(formData, "symbol");
  const timeframe = readRequiredString(formData, "timeframe");
  const positionId = readRequiredString(formData, "positionId");
  const { NEXT_PUBLIC_API_BASE_URL: apiBaseUrl } = loadWebEnv();

  if (!apiBaseUrl) {
    redirect(buildPositionRedirectPath({ symbol, timeframe, status: "api" }));
  }

  const payload = buildClosePositionPayload(formData);
  const response = await submitPositionRequest(
    `${apiBaseUrl}/positions/${positionId}/close`,
    {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...(await buildApiAuthHeaders()),
      },
      method: "POST",
    },
  );

  await redirectToLoginIfUnauthorized(response);

  redirect(
    buildPositionRedirectPath({
      symbol,
      timeframe,
      status: response.ok ? "closed" : "close-failed",
    }),
  );
}

async function submitPositionRequest(
  input: string,
  init: RequestInit,
): Promise<Pick<Response, "ok" | "status">> {
  try {
    return await fetch(input, init);
  } catch {
    return {
      ok: false,
      status: 0,
    };
  }
}

function readRequiredString(formData: FormData, field: string) {
  const value = readOptionalString(formData, field);

  if (!value) {
    throw new Error(`Missing required form field: ${field}`);
  }

  return value;
}

function readOptionalString(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}
