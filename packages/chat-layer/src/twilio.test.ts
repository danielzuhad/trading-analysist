import { describe, expect, it, vi } from "vitest";
import {
  buildTwilioMessagingResponse,
  buildTwilioWebhookSignature,
  parseTwilioFormBody,
  sendTwilioMessage,
  validateTwilioWebhookSignature,
} from "./twilio.js";

describe("Twilio chat-layer helpers", () => {
  it("parses a URL-encoded Twilio webhook body", () => {
    expect(
      parseTwilioFormBody("Body=watchlist+4H&From=whatsapp%3A%2B628123"),
    ).toEqual({
      Body: "watchlist 4H",
      From: "whatsapp:+628123",
    });
  });

  it("builds and validates a Twilio webhook signature", () => {
    const authToken = "test-auth-token";
    const params = {
      Body: "watchlist 4H",
      From: "whatsapp:+628123",
      To: "whatsapp:+14155238886",
    };
    const url = "https://api.example.com/chat-layer/twilio/webhook";
    const signature = buildTwilioWebhookSignature({
      authToken,
      params,
      url,
    });

    expect(
      validateTwilioWebhookSignature({
        authToken,
        params,
        signature,
        url,
      }),
    ).toBe(true);
    expect(
      validateTwilioWebhookSignature({
        authToken,
        params: {
          ...params,
          Body: "asset btc 4H",
        },
        signature,
        url,
      }),
    ).toBe(false);
  });

  it("builds a TwiML response body", () => {
    expect(buildTwilioMessagingResponse("BTC < WATCH")).toContain(
      "BTC &lt; WATCH",
    );
  });

  it("sends a Twilio WhatsApp message through the REST API", async () => {
    const fetchFn = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          from: "whatsapp:+14155238886",
          sid: "SM123",
          status: "queued",
          to: "whatsapp:+628123456789",
        }),
        {
          status: 201,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    });

    const result = await sendTwilioMessage({
      accountSid: "AC123",
      authToken: "auth",
      body: "Test alert",
      fetchFn,
      from: "+14155238886",
      to: "+628123456789",
    });

    expect(result).toEqual({
      from: "whatsapp:+14155238886",
      sid: "SM123",
      status: "queued",
      to: "whatsapp:+628123456789",
    });
    expect(fetchFn).toHaveBeenCalledOnce();
    const firstCall = (fetchFn.mock.calls[0] ?? []) as unknown as [
      string,
      RequestInit | undefined,
    ];

    expect(firstCall?.[0]).toBe(
      "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json",
    );
    expect(firstCall?.[1]).toMatchObject({
      method: "POST",
    });
  });
});
