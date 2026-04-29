"use server";

import { redirect } from "next/navigation";
import { loadWebEnv } from "../../../env";

export async function recordPositionAction(formData: FormData) {
  const { NEXT_PUBLIC_API_BASE_URL: apiBaseUrl } = loadWebEnv();
  const symbol = readRequiredString(formData, "symbol");
  const timeframe = readRequiredString(formData, "timeframe");

  if (!apiBaseUrl) {
    redirect(`/assets/${symbol}?timeframe=${timeframe}&positionStatus=api`);
  }

  const payload = {
    assetId: readRequiredString(formData, "assetId"),
    direction: readRequiredString(formData, "direction"),
    entryPrice: readRequiredNumber(formData, "entryPrice"),
    quantity: readRequiredNumber(formData, "quantity"),
    ...(readOptionalNumber(formData, "stopLoss") !== undefined
      ? { stopLoss: readOptionalNumber(formData, "stopLoss") }
      : {}),
    ...(readOptionalString(formData, "thesis")
      ? { thesis: readOptionalString(formData, "thesis") }
      : {}),
  };

  const response = await fetch(`${apiBaseUrl}/positions`, {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  redirect(
    `/assets/${symbol}?timeframe=${timeframe}&positionStatus=${
      response.ok ? "recorded" : "failed"
    }`,
  );
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

function readRequiredNumber(formData: FormData, field: string) {
  const value = readOptionalNumber(formData, field);

  if (value === undefined) {
    throw new Error(`Missing required numeric form field: ${field}`);
  }

  return value;
}

function readOptionalNumber(formData: FormData, field: string) {
  const value = readOptionalString(formData, field);

  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric form field: ${field}`);
  }

  return parsed;
}
