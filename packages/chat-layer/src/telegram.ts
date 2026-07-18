import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";

export type TelegramInboundMessage = {
  chatId: number;
  from?: string;
  messageId?: number;
  text: string;
};

export type SendTelegramMessageOptions = {
  botToken: string;
  chatId: number | string;
  fetchFn?: typeof fetch;
  text: string;
};

export type SendTelegramMessageResult = {
  chatId: number;
  messageId: number;
  status: "sent";
};

type TelegramApiResponse = {
  description?: string;
  ok: boolean;
  result?: {
    chat?: { id?: number };
    message_id?: number;
  };
};

export type TelegramUpdatePayload = {
  message?: {
    chat?: { id?: number; type?: string };
    from?: { first_name?: string; id?: number; username?: string };
    message_id?: number;
    text?: string;
  };
  update_id?: number;
};

export function parseTelegramUpdate(
  payload: unknown,
): TelegramInboundMessage | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const update = payload as TelegramUpdatePayload;
  const message = update.message;

  if (
    !message ||
    typeof message.chat?.id !== "number" ||
    typeof message.text !== "string" ||
    message.text.trim().length === 0
  ) {
    return null;
  }

  const from = message.from?.username ?? message.from?.first_name;

  return {
    chatId: message.chat.id,
    ...(from ? { from } : {}),
    ...(typeof message.message_id === "number"
      ? { messageId: message.message_id }
      : {}),
    text: message.text.trim(),
  };
}

export function validateTelegramWebhookSecret(
  headerValue: string | undefined,
  expectedSecret: string,
): boolean {
  if (typeof headerValue !== "string" || headerValue.length === 0) {
    return false;
  }

  const receivedBuffer = Buffer.from(headerValue, "utf8");
  const expectedBuffer = Buffer.from(expectedSecret, "utf8");

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function sendTelegramMessage({
  botToken,
  chatId,
  fetchFn = fetch,
  text,
}: SendTelegramMessageOptions): Promise<SendTelegramMessageResult> {
  const endpoint = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const response = await fetchFn(endpoint, {
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const payload = (await response.json()) as TelegramApiResponse;

  if (!response.ok || !payload.ok) {
    throw createTelegramHttpError(response.status, payload.description);
  }

  const messageId = payload.result?.message_id;
  const resolvedChatId = payload.result?.chat?.id;

  if (typeof messageId !== "number" || typeof resolvedChatId !== "number") {
    throw new Error("Telegram did not return a message id.");
  }

  return {
    chatId: resolvedChatId,
    messageId,
    status: "sent",
  };
}

function createTelegramHttpError(statusCode: number, description?: string) {
  const error = new Error(
    `Telegram message request failed with status ${statusCode}${
      description ? `: ${description}` : "."
    }`,
  ) as Error & {
    details?: {
      responseBody: string;
      statusCode: number;
    };
  };

  error.details = {
    responseBody: description ?? "",
    statusCode,
  };

  return error;
}
