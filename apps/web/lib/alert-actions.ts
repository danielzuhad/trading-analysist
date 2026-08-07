"use server";

import type { AlertResolution } from "@trading-analyst/shared-types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildApiAuthHeaders } from "./api-auth";
import { loadWebEnv } from "./env";
import { clearSessionCookie } from "./session";

// See the note in watchlist-actions.ts: redirect() throws a Next.js
// control-flow signal, so this must stay outside any try/catch wrapping fetch.
async function redirectToLoginIfUnauthorized(response: {
  status: number;
}): Promise<void> {
  if (response.status === 401) {
    await clearSessionCookie();
    redirect("/login");
  }
}

export type ResolveAlertResult = {
  message: string;
  status: "ok" | "error";
};

const resolutionMessages: Record<AlertResolution, string> = {
  acknowledged: "Alert acknowledged.",
  ignored: "Alert ignored.",
};

export async function resolveAlertAction(
  alertId: string,
  resolution: AlertResolution,
): Promise<ResolveAlertResult> {
  const { NEXT_PUBLIC_API_BASE_URL: apiBaseUrl } = loadWebEnv();

  if (!apiBaseUrl) {
    return { message: "API base URL is not configured.", status: "error" };
  }

  let response: Response;

  try {
    response = await fetch(
      `${apiBaseUrl}/alerts/${encodeURIComponent(alertId)}`,
      {
        body: JSON.stringify({ status: resolution }),
        headers: {
          "Content-Type": "application/json",
          ...(await buildApiAuthHeaders()),
        },
        method: "PATCH",
      },
    );
  } catch {
    return { message: "Could not reach the alerts endpoint.", status: "error" };
  }

  await redirectToLoginIfUnauthorized(response);

  if (response.status === 404) {
    return { message: "That alert no longer exists.", status: "error" };
  }

  if (!response.ok) {
    return {
      message: `Failed to update the alert (status ${response.status}).`,
      status: "error",
    };
  }

  revalidatePath("/");

  return { message: resolutionMessages[resolution], status: "ok" };
}
