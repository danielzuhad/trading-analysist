import { describe, expect, it, vi } from "vitest";
import {
  parseTelegramUpdate,
  sendTelegramMessage,
  validateTelegramWebhookSecret,
} from "./telegram.js";

describe("parseTelegramUpdate", () => {
  it("parses a text message update", () => {
    const inbound = parseTelegramUpdate({
      update_id: 10,
      message: {
        message_id: 55,
        chat: { id: 8786340516, type: "private" },
        from: { first_name: "Daniel", id: 8786340516, username: "daniel" },
        text: " watchlist 4H ",
      },
    });

    expect(inbound).toEqual({
      chatId: 8786340516,
      from: "daniel",
      messageId: 55,
      text: "watchlist 4H",
    });
  });

  it("returns null for non-text or malformed updates", () => {
    expect(parseTelegramUpdate(null)).toBeNull();
    expect(parseTelegramUpdate({})).toBeNull();
    expect(
      parseTelegramUpdate({
        message: { chat: { id: 1 }, text: "   " },
      }),
    ).toBeNull();
    expect(
      parseTelegramUpdate({
        message: { chat: { id: 1 }, photo: [] },
      }),
    ).toBeNull();
  });
});

describe("validateTelegramWebhookSecret", () => {
  it("accepts the exact secret and rejects everything else", () => {
    expect(validateTelegramWebhookSecret("secret-value", "secret-value")).toBe(
      true,
    );
    expect(validateTelegramWebhookSecret("wrong", "secret-value")).toBe(false);
    expect(validateTelegramWebhookSecret(undefined, "secret-value")).toBe(
      false,
    );
    expect(validateTelegramWebhookSecret("", "secret-value")).toBe(false);
  });
});

describe("sendTelegramMessage", () => {
  it("posts to the Telegram Bot API and returns the message id", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({
        ok: true,
        result: {
          chat: { id: 8786340516 },
          message_id: 99,
        },
      }),
    );

    const result = await sendTelegramMessage({
      botToken: "bot-token",
      chatId: 8786340516,
      fetchFn,
      text: "BTC/USD actionable setup",
    });

    expect(result).toEqual({
      chatId: 8786340516,
      messageId: 99,
      status: "sent",
    });
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.telegram.org/botbot-token/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          chat_id: 8786340516,
          text: "BTC/USD actionable setup",
        }),
      }),
    );
  });

  it("throws a descriptive error when the API rejects the request", async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ ok: false, description: "chat not found" }),
          { status: 400 },
        ),
    );

    await expect(
      sendTelegramMessage({
        botToken: "bot-token",
        chatId: 123,
        fetchFn,
        text: "test",
      }),
    ).rejects.toThrow("chat not found");
  });
});
