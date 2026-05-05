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
  parseTwilioFormBody,
  parseTwilioInboundMessage,
  validateTwilioWebhookSignature,
} from "@trading-analyst/chat-layer";
import type {
  LatestAssetAnalysis,
  LatestMarketData,
} from "@trading-analyst/db";
import {
  type ClosePositionInput,
  type CreatePositionInput,
  findDefaultCryptoAsset,
  findDefaultCryptoAssetBySymbol,
  type IndicatorSnapshot,
  type Position,
  type SignalAggregationSnapshot,
  type SupportedTimeframe,
} from "@trading-analyst/shared-types";
import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  buildAssetOverviewResponse,
  buildWatchlistOverviewResponse,
} from "./dashboard.js";

const defaultChatUserId = "system:default";

type Dependencies = {
  authToken?: string;
  closePosition: (
    positionId: string,
    input: ClosePositionInput,
  ) => Promise<Position | null>;
  createPosition: (input: CreatePositionInput) => Promise<Position>;
  getActivePositionForAsset: (filters: {
    assetId: string;
    userId?: string;
  }) => Promise<Position | null>;
  getLatestAssetAnalysis: (
    assetId: string,
    timeframe: SupportedTimeframe,
  ) => Promise<LatestAssetAnalysis | null>;
  getLatestIndicatorSnapshot: (
    assetId: string,
    timeframe: SupportedTimeframe,
  ) => Promise<IndicatorSnapshot | null>;
  getLatestMarketData: (
    assetId: string,
    timeframe: SupportedTimeframe,
  ) => Promise<LatestMarketData | null>;
  getLatestSignalAggregationSnapshot: (
    assetId: string,
    timeframe: SupportedTimeframe,
  ) => Promise<SignalAggregationSnapshot | null>;
  webhookUrl?: string;
};

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
    const responseText = await buildChatReply(inboundMessage, dependencies);

    return reply
      .type("text/xml; charset=utf-8")
      .send(buildTwilioMessagingResponse(responseText));
  });
}

async function buildChatReply(
  inboundMessage: ReturnType<typeof parseTwilioInboundMessage>,
  dependencies: Dependencies,
) {
  const command = parseChatCommand(inboundMessage.body);

  switch (command.kind) {
    case "help":
      return formatHelpMessage();
    case "invalid":
      return formatInvalidCommandMessage(command.message);
    case "unknown":
      return formatUnknownCommandMessage();
    case "watchlist": {
      const watchlist = await buildWatchlistOverviewResponse(
        command.timeframe,
        dependencies,
      );

      return formatWatchlistMessage(watchlist);
    }
    case "asset": {
      const asset = findDefaultCryptoAssetBySymbol(command.symbol);

      if (!asset) {
        return `Aset ${command.symbol} belum ada di MVP watchlist.`;
      }

      const overview = await buildAssetOverviewResponse(
        asset,
        command.timeframe,
        dependencies,
      );

      return formatAssetOverviewMessage(overview);
    }
    case "position_open": {
      const asset = findDefaultCryptoAssetBySymbol(command.symbol);

      if (!asset) {
        return `Aset ${command.symbol} belum ada di MVP watchlist.`;
      }

      const activePosition = await dependencies.getActivePositionForAsset({
        assetId: asset.id,
      });

      if (activePosition) {
        return `Posisi aktif ${asset.displaySymbol} sudah ada. Tutup dulu dari chat atau dashboard sebelum record posisi baru.`;
      }

      const position = await dependencies.createPosition({
        assetId: asset.id,
        direction: command.direction,
        entryPrice: command.entryPrice,
        latestState: await readLatestState(
          asset.id,
          command.timeframe,
          dependencies,
        ),
        metadata: {
          channel: "whatsapp",
          provider: "twilio",
          requestedTimeframe: command.timeframe,
          sourceFrom: inboundMessage.from,
          sourceMessageSid: inboundMessage.messageSid,
        },
        ...(command.stopLoss !== undefined
          ? { stopLoss: command.stopLoss }
          : {}),
        quantity: command.quantity,
        status: "open",
        ...(command.thesis ? { thesis: command.thesis } : {}),
        takeProfitLevels: [],
        userId: defaultChatUserId,
      });

      return formatPositionRecordedMessage(position);
    }
    case "position_close": {
      const asset = findDefaultCryptoAssetBySymbol(command.symbol);

      if (!asset) {
        return `Aset ${command.symbol} belum ada di MVP watchlist.`;
      }

      const activePosition = await dependencies.getActivePositionForAsset({
        assetId: asset.id,
      });

      if (!activePosition) {
        return `Belum ada posisi aktif ${asset.displaySymbol} untuk ditutup.`;
      }

      const closedPosition = await dependencies.closePosition(
        activePosition.id,
        {
          metadata: {
            channel: "whatsapp",
            provider: "twilio",
            sourceFrom: inboundMessage.from,
            sourceMessageSid: inboundMessage.messageSid,
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
  assetId: string,
  timeframe: SupportedTimeframe,
  dependencies: Dependencies,
) {
  const asset = findDefaultCryptoAsset(assetId);

  if (!asset) {
    return undefined;
  }

  const overview = await buildAssetOverviewResponse(
    asset,
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
