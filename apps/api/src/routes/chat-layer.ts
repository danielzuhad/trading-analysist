import {
  buildTwilioMessagingResponse,
  formatAssetOverviewMessage,
  formatChatLayerDisabledMessage,
  formatHelpMessage,
  formatInvalidCommandMessage,
  formatPositionClosedMessage,
  formatPositionRecordedMessage,
  formatUnknownCommandMessage,
  formatWatchlistMessage,
  parseChatCommand,
  parseTelegramUpdate,
  parseTwilioFormBody,
  parseTwilioInboundMessage,
  sendTelegramMessage,
  validateTelegramWebhookSecret,
  validateTwilioWebhookSignature,
} from "@trading-analyst/chat-layer";
import {
  type Asset,
  type ClosePositionInput,
  type CreatePositionInput,
  findDefaultCryptoAssetBySymbol,
  type Position,
  type SupportedTimeframe,
} from "@trading-analyst/shared-types";
import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  buildAssetOverviewResponse,
  buildWatchlistOverviewResponse,
  type OverviewDependencies,
  resolveWatchlistAssetsForOverview,
} from "../overview.js";

type ChatInboundMessage = {
  channel: "telegram" | "whatsapp";
  from: string;
  provider: "telegram" | "twilio";
  sourceMessageId?: string;
  text: string;
};

type TelegramDependencies = {
  allowedChatId?: string;
  botToken: string;
  sendMessage?: typeof sendTelegramMessage;
  webhookSecret: string;
};

type Dependencies = OverviewDependencies & {
  authToken?: string;
  chatUserId: string;
  telegram?: TelegramDependencies;
  closePosition: (
    positionId: string,
    input: ClosePositionInput,
  ) => Promise<Position | null>;
  createPosition: (input: CreatePositionInput) => Promise<Position>;
  getWatchlistAssetBySymbol?: (filters: {
    symbol: string;
    userId: string;
  }) => Promise<{ asset: Asset } | null>;
  listWatchlistAssets?: (userId: string) => Promise<Array<{ asset: Asset }>>;
  webhookUrl?: string;
};

async function resolveChatAsset(
  symbol: string,
  dependencies: Dependencies,
): Promise<Asset | undefined> {
  const seeded = findDefaultCryptoAssetBySymbol(symbol);

  if (seeded) {
    return seeded;
  }

  if (!dependencies.getWatchlistAssetBySymbol) {
    return undefined;
  }

  try {
    const entry = await dependencies.getWatchlistAssetBySymbol({
      symbol,
      userId: dependencies.chatUserId,
    });
    return entry?.asset;
  } catch {
    return undefined;
  }
}

export async function registerChatLayerRoutes(
  app: FastifyInstance,
  dependencies: Dependencies,
) {
  app.post("/chat-layer/twilio/webhook", async (request, reply) => {
    if (!dependencies.authToken) {
      return reply
        .code(503)
        .type("text/xml; charset=utf-8")
        .send(buildTwilioMessagingResponse(formatChatLayerDisabledMessage()));
    }

    const rawBody =
      typeof request.body === "string"
        ? request.body
        : String(request.body ?? "");
    const formParams = parseTwilioFormBody(rawBody);
    const signature = request.headers["x-twilio-signature"];

    if (
      typeof signature !== "string" ||
      !validateTwilioWebhookSignature({
        authToken: dependencies.authToken,
        params: formParams,
        signature,
        url: resolveWebhookUrl(request, dependencies.webhookUrl),
      })
    ) {
      return reply.code(401).send({
        error: "INVALID_TWILIO_SIGNATURE",
      });
    }

    const inboundMessage = parseTwilioInboundMessage(formParams);
    const responseText = await buildChatReply(
      {
        channel: "whatsapp",
        from: inboundMessage.from,
        provider: "twilio",
        ...(inboundMessage.messageSid
          ? { sourceMessageId: inboundMessage.messageSid }
          : {}),
        text: inboundMessage.body,
      },
      dependencies,
    );

    return reply
      .type("text/xml; charset=utf-8")
      .send(buildTwilioMessagingResponse(responseText));
  });

  app.post("/chat-layer/telegram/webhook", async (request, reply) => {
    const telegram = dependencies.telegram;

    if (!telegram) {
      return reply.code(503).send({
        error: "TELEGRAM_CHAT_LAYER_DISABLED",
        message: formatChatLayerDisabledMessage(),
      });
    }

    const secretHeader = request.headers["x-telegram-bot-api-secret-token"];

    if (
      !validateTelegramWebhookSecret(
        typeof secretHeader === "string" ? secretHeader : undefined,
        telegram.webhookSecret,
      )
    ) {
      return reply.code(401).send({
        error: "INVALID_TELEGRAM_WEBHOOK_SECRET",
      });
    }

    const inbound = parseTelegramUpdate(request.body);

    // Telegram expects 200 for every update, otherwise it keeps retrying.
    if (!inbound) {
      return reply.send({ ok: true, skipped: "unsupported_update" });
    }

    if (
      telegram.allowedChatId &&
      String(inbound.chatId) !== telegram.allowedChatId
    ) {
      return reply.send({ ok: true, skipped: "chat_not_allowed" });
    }

    const responseText = await buildChatReply(
      {
        channel: "telegram",
        from: inbound.from ?? String(inbound.chatId),
        provider: "telegram",
        ...(inbound.messageId !== undefined
          ? { sourceMessageId: String(inbound.messageId) }
          : {}),
        text: inbound.text,
      },
      dependencies,
    );
    const sendMessage = telegram.sendMessage ?? sendTelegramMessage;

    await sendMessage({
      botToken: telegram.botToken,
      chatId: inbound.chatId,
      text: responseText,
    });

    return reply.send({ ok: true });
  });
}

async function buildChatReply(
  inboundMessage: ChatInboundMessage,
  dependencies: Dependencies,
) {
  const command = parseChatCommand(inboundMessage.text);

  switch (command.kind) {
    case "help":
      return formatHelpMessage();
    case "invalid":
      return formatInvalidCommandMessage(command.message);
    case "unknown":
      return formatUnknownCommandMessage();
    case "watchlist": {
      const overviewAssets = await resolveWatchlistAssetsForOverview(
        dependencies.chatUserId,
        dependencies.listWatchlistAssets,
      );
      const watchlist = await buildWatchlistOverviewResponse(
        dependencies.chatUserId,
        command.timeframe,
        overviewAssets,
        dependencies,
      );

      return formatWatchlistMessage(watchlist);
    }
    case "asset": {
      const asset = await resolveChatAsset(command.symbol, dependencies);

      if (!asset) {
        return `Aset ${command.symbol} belum ada di watchlist. Tambahkan dulu lewat dashboard.`;
      }

      const overview = await buildAssetOverviewResponse(
        asset,
        dependencies.chatUserId,
        command.timeframe,
        dependencies,
      );

      return formatAssetOverviewMessage(overview);
    }
    case "position_open": {
      const asset = await resolveChatAsset(command.symbol, dependencies);

      if (!asset) {
        return `Aset ${command.symbol} belum ada di watchlist. Tambahkan dulu lewat dashboard.`;
      }

      const activePosition = await dependencies.getActivePositionForAsset({
        assetId: asset.id,
        userId: dependencies.chatUserId,
      });

      if (activePosition) {
        return `Posisi aktif ${asset.displaySymbol} sudah ada. Tutup dulu dari chat atau dashboard sebelum record posisi baru.`;
      }

      const position = await dependencies.createPosition({
        assetId: asset.id,
        direction: command.direction,
        entryPrice: command.entryPrice,
        latestState: await readLatestState(
          asset,
          command.timeframe,
          dependencies,
        ),
        metadata: {
          channel: inboundMessage.channel,
          provider: inboundMessage.provider,
          requestedTimeframe: command.timeframe,
          sourceFrom: inboundMessage.from,
          sourceMessageSid: inboundMessage.sourceMessageId,
        },
        ...(command.stopLoss !== undefined
          ? { stopLoss: command.stopLoss }
          : {}),
        quantity: command.quantity,
        status: "open",
        ...(command.thesis ? { thesis: command.thesis } : {}),
        takeProfitLevels: [],
        userId: dependencies.chatUserId,
      });

      return formatPositionRecordedMessage(position);
    }
    case "position_close": {
      const asset = await resolveChatAsset(command.symbol, dependencies);

      if (!asset) {
        return `Aset ${command.symbol} belum ada di watchlist. Tambahkan dulu lewat dashboard.`;
      }

      const activePosition = await dependencies.getActivePositionForAsset({
        assetId: asset.id,
        userId: dependencies.chatUserId,
      });

      if (!activePosition) {
        return `Belum ada posisi aktif ${asset.displaySymbol} untuk ditutup.`;
      }

      const closedPosition = await dependencies.closePosition(
        activePosition.id,
        {
          metadata: {
            channel: inboundMessage.channel,
            provider: inboundMessage.provider,
            sourceFrom: inboundMessage.from,
            sourceMessageSid: inboundMessage.sourceMessageId,
          },
          ...(command.note ? { notes: command.note } : {}),
          remainingQuantity: 0,
        },
      );

      if (!closedPosition) {
        return `Gagal menutup posisi ${asset.displaySymbol}.`;
      }

      return formatPositionClosedMessage(closedPosition);
    }
  }
}

async function readLatestState(
  asset: Asset,
  timeframe: SupportedTimeframe,
  dependencies: Dependencies,
) {
  const overview = await buildAssetOverviewResponse(
    asset,
    dependencies.chatUserId,
    timeframe,
    dependencies,
  );

  return overview.analysisSnapshot?.state;
}

function resolveWebhookUrl(
  request: FastifyRequest,
  configuredWebhookUrl?: string,
) {
  if (configuredWebhookUrl) {
    return configuredWebhookUrl;
  }

  const forwardedProtocol = request.headers["x-forwarded-proto"];
  const protocol =
    typeof forwardedProtocol === "string" && forwardedProtocol.length > 0
      ? forwardedProtocol
      : request.protocol;
  const host = request.headers.host ?? "localhost";

  return `${protocol}://${host}${request.url}`;
}
