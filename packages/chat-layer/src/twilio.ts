import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";

export type TwilioFormParams = Record<string, string>;

export type TwilioInboundMessage = {
  body: string;
  from: string;
  messageSid?: string;
  numMedia: number;
  profileName?: string;
  rawParams: TwilioFormParams;
  to: string;
};

export type SendTwilioMessageOptions = {
  accountSid: string;
  authToken: string;
  body: string;
  fetchFn?: typeof fetch;
  from: string;
  statusCallbackUrl?: string;
  to: string;
};

export type SendTwilioMessageResult = {
  from: string;
  sid: string;
  status: string;
  to: string;
};

type TwilioMessageApiResponse = {
  from?: string;
  sid?: string;
  status?: string;
  to?: string;
};

export function buildTwilioMessagingResponse(body: string) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    `<Message>${escapeXml(body)}</Message>`,
    "</Response>",
  ].join("");
}

export function buildTwilioWebhookSignature({
  authToken,
  params,
  url,
}: {
  authToken: string;
  params: TwilioFormParams;
  url: string;
}) {
  const signaturePayload = [
    url,
    ...Object.keys(params)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => `${key}${params[key]}`),
  ].join("");

  return createHmac("sha1", authToken)
    .update(signaturePayload)
    .digest("base64");
}

export function normalizeTwilioWhatsAppAddress(value: string) {
  const trimmed = value.trim();

  if (trimmed.startsWith("whatsapp:")) {
    return trimmed;
  }

  return `whatsapp:${trimmed}`;
}

export function parseTwilioFormBody(body: string): TwilioFormParams {
  const params = new URLSearchParams(body);
  const parsed: TwilioFormParams = {};

  for (const [key, value] of params.entries()) {
    parsed[key] = value;
  }

  return parsed;
}

export function parseTwilioInboundMessage(
  params: TwilioFormParams,
): TwilioInboundMessage {
  const numMediaValue = Number(params.NumMedia ?? "0");

  return {
    body: params.Body?.trim() ?? "",
    from: params.From?.trim() ?? "",
    ...(params.MessageSid ? { messageSid: params.MessageSid } : {}),
    numMedia: Number.isFinite(numMediaValue) ? numMediaValue : 0,
    ...(params.ProfileName ? { profileName: params.ProfileName } : {}),
    rawParams: params,
    to: params.To?.trim() ?? "",
  };
}

export async function sendTwilioMessage({
  accountSid,
  authToken,
  body,
  fetchFn = fetch,
  from,
  statusCallbackUrl,
  to,
}: SendTwilioMessageOptions): Promise<SendTwilioMessageResult> {
  const normalizedFrom = normalizeTwilioWhatsAppAddress(from);
  const normalizedTo = normalizeTwilioWhatsAppAddress(to);
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const form = new URLSearchParams({
    Body: body,
    From: normalizedFrom,
    To: normalizedTo,
    ...(statusCallbackUrl ? { StatusCallback: statusCallbackUrl } : {}),
  });
  const response = await fetchFn(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (!response.ok) {
    throw await createTwilioHttpError(response);
  }

  const payload = (await response.json()) as TwilioMessageApiResponse;

  if (!payload.sid) {
    throw new Error("Twilio did not return a message SID.");
  }

  return {
    from: payload.from ?? normalizedFrom,
    sid: payload.sid,
    status: payload.status ?? "queued",
    to: payload.to ?? normalizedTo,
  };
}

export function validateTwilioWebhookSignature({
  authToken,
  params,
  signature,
  url,
}: {
  authToken: string;
  params: TwilioFormParams;
  signature: string;
  url: string;
}) {
  const expectedSignature = buildTwilioWebhookSignature({
    authToken,
    params,
    url,
  });
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const receivedBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

async function createTwilioHttpError(response: Response) {
  const responseBody = await response.text();
  const error = new Error(
    `Twilio message request failed with status ${response.status}.`,
  ) as Error & {
    details?: {
      responseBody: string;
      statusCode: number;
    };
  };

  error.details = {
    responseBody,
    statusCode: response.status,
  };

  return error;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
