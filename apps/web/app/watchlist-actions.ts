"use server";

import {
  type CryptoSearchResult,
  cryptoSearchResponseSchema,
} from "@trading-analyst/shared-types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildApiAuthHeaders } from "../api-auth";
import { loadWebEnv } from "../env";

export type SearchCryptoActionResult =
  | { results: CryptoSearchResult[]; status: "ok" }
  | { message: string; status: "error" };

export async function searchCryptoAction(
  query: string,
): Promise<SearchCryptoActionResult> {
  const { NEXT_PUBLIC_API_BASE_URL: apiBaseUrl } = loadWebEnv();
  const trimmed = query.trim();

  if (!apiBaseUrl) {
    return { message: "API base URL is not configured.", status: "error" };
  }

  if (trimmed.length < 2) {
    return { results: [], status: "ok" };
  }

  try {
    const response = await fetch(
      `${apiBaseUrl}/crypto-search?q=${encodeURIComponent(trimmed)}`,
      {
        cache: "no-store",
        headers: buildApiAuthHeaders(),
      },
    );

    if (!response.ok) {
      return {
        message:
          response.status === 503
            ? "Crypto search is not configured on the API."
            : `Search failed with status ${response.status}.`,
        status: "error",
      };
    }

    const payload = cryptoSearchResponseSchema.safeParse(await response.json());

    if (!payload.success) {
      return {
        message: "Search returned an invalid payload.",
        status: "error",
      };
    }

    return { results: payload.data.results, status: "ok" };
  } catch {
    return { message: "Could not reach the search endpoint.", status: "error" };
  }
}

export type WatchlistMutationResult = {
  message: string;
  status: "ok" | "error";
};

export async function addToWatchlistAction({
  coingeckoCoinId,
  imageUrl,
  name,
  symbol,
}: {
  coingeckoCoinId: string;
  imageUrl?: string | undefined;
  name: string;
  symbol: string;
}): Promise<WatchlistMutationResult> {
  const { NEXT_PUBLIC_API_BASE_URL: apiBaseUrl } = loadWebEnv();

  if (!apiBaseUrl) {
    return { message: "API base URL is not configured.", status: "error" };
  }

  try {
    const response = await fetch(`${apiBaseUrl}/watchlist`, {
      body: JSON.stringify({
        coingeckoCoinId,
        ...(imageUrl ? { imageUrl } : {}),
        name,
        symbol,
      }),
      headers: {
        "Content-Type": "application/json",
        ...buildApiAuthHeaders(),
      },
      method: "POST",
    });

    if (!response.ok) {
      return {
        message: `Failed to add ${symbol.toUpperCase()} (status ${response.status}).`,
        status: "error",
      };
    }

    revalidatePath("/");

    return {
      message: `${symbol.toUpperCase()} added to the watchlist. Analysis starts on the next worker run.`,
      status: "ok",
    };
  } catch {
    return {
      message: "Could not reach the watchlist endpoint.",
      status: "error",
    };
  }
}

export async function setWatchlistAiEnabledAction(
  assetId: string,
  aiEnabled: boolean,
): Promise<WatchlistMutationResult> {
  const { NEXT_PUBLIC_API_BASE_URL: apiBaseUrl } = loadWebEnv();

  if (!apiBaseUrl) {
    return { message: "API base URL is not configured.", status: "error" };
  }

  try {
    const response = await fetch(
      `${apiBaseUrl}/watchlist/${encodeURIComponent(assetId)}`,
      {
        body: JSON.stringify({ aiEnabled }),
        headers: {
          "Content-Type": "application/json",
          ...buildApiAuthHeaders(),
        },
        method: "PATCH",
      },
    );

    if (!response.ok) {
      return {
        message: `Failed to update AI analysis (status ${response.status}).`,
        status: "error",
      };
    }

    revalidatePath("/");

    return {
      message: aiEnabled
        ? "AI analysis enabled for this asset."
        : "AI analysis paused for this asset. Price data keeps updating.",
      status: "ok",
    };
  } catch {
    return {
      message: "Could not reach the watchlist endpoint.",
      status: "error",
    };
  }
}

export async function removeFromWatchlistAndRedirectAction(assetId: string) {
  const result = await removeFromWatchlistAction(assetId);

  if (result.status === "ok") {
    redirect("/");
  }
}

export async function removeFromWatchlistAction(
  assetId: string,
): Promise<WatchlistMutationResult> {
  const { NEXT_PUBLIC_API_BASE_URL: apiBaseUrl } = loadWebEnv();

  if (!apiBaseUrl) {
    return { message: "API base URL is not configured.", status: "error" };
  }

  try {
    const response = await fetch(
      `${apiBaseUrl}/watchlist/${encodeURIComponent(assetId)}`,
      {
        headers: buildApiAuthHeaders(),
        method: "DELETE",
      },
    );

    if (response.status === 409) {
      return {
        message:
          "This asset has an active position. Close the position before removing it.",
        status: "error",
      };
    }

    if (!response.ok) {
      return {
        message: `Failed to remove the asset (status ${response.status}).`,
        status: "error",
      };
    }

    revalidatePath("/");

    return { message: "Removed from the watchlist.", status: "ok" };
  } catch {
    return {
      message: "Could not reach the watchlist endpoint.",
      status: "error",
    };
  }
}
