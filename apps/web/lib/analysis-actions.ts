"use server";

import type { SupportedTimeframe } from "@trading-analyst/shared-types";
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

export type RequestAnalysisResult = {
  message: string;
  status: "ok" | "error";
};

/**
 * Queues a manual re-analysis. The API answers 202 as soon as the job is
 * enqueued — the worker then runs the full cycle, so the fresh decision only
 * appears on a later refresh. The copy below has to say that; a success toast
 * that implies the page is already updated would be a lie.
 */
export async function requestAnalysisAction(
  assetId: string,
  timeframe: SupportedTimeframe,
  symbol: string,
): Promise<RequestAnalysisResult> {
  const { NEXT_PUBLIC_API_BASE_URL: apiBaseUrl } = loadWebEnv();

  if (!apiBaseUrl) {
    return { message: "API base URL is not configured.", status: "error" };
  }

  let response: Response;

  try {
    response = await fetch(
      `${apiBaseUrl}/assets/${encodeURIComponent(assetId)}/analyze`,
      {
        body: JSON.stringify({ timeframe }),
        headers: {
          "Content-Type": "application/json",
          ...(await buildApiAuthHeaders()),
        },
        method: "POST",
      },
    );
  } catch {
    return {
      message: "Could not reach the analysis endpoint.",
      status: "error",
    };
  }

  await redirectToLoginIfUnauthorized(response);

  if (response.status === 409) {
    return {
      message: `AI analysis is paused for ${symbol}. Turn it back on from the watchlist first.`,
      status: "error",
    };
  }

  if (response.status === 429) {
    return {
      message:
        "Too many manual analyses in a short window. Each one costs an AI call — try again in a few minutes.",
      status: "error",
    };
  }

  if (!response.ok) {
    return {
      message: `Failed to queue the analysis (status ${response.status}).`,
      status: "error",
    };
  }

  revalidatePath(`/assets/${symbol.toLowerCase()}`);

  return {
    message: `Analysis queued for ${symbol} ${timeframe}. Refresh in a moment to see the new decision.`,
    status: "ok",
  };
}
