import type {
  Asset,
  Position,
  SupportedTimeframe,
} from "@trading-analyst/shared-types";
import { cva } from "class-variance-authority";
import {
  DetailRow,
  InfoPill,
} from "@/components/dashboard/dashboard-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatPrice, formatRelativeTime } from "@/lib/dashboard-format";
import { manualPositionAnchorId } from "@/lib/position-action-payload";
import { cn } from "@/lib/utils";
import {
  closePositionAction,
  recordPositionAction,
  updatePositionAction,
} from "../actions";

const nativeSelectClassName =
  "min-h-10 w-full rounded-sm border border-input bg-secondary px-3 text-foreground tabular-nums focus:outline-2 focus:outline-primary focus:outline-offset-1";

const positionFieldLabelClassName =
  "grid gap-1.5 text-[0.74rem] font-semibold tracking-widest text-muted-foreground uppercase";

const positionInputClassName =
  "min-h-10 rounded-sm border-input bg-secondary tabular-nums tracking-normal normal-case focus-visible:border-input focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1";

const actionBannerVariants = cva(
  "m-0 rounded-sm border p-2.5 text-[0.9rem] font-semibold",
  {
    variants: {
      tone: {
        success: "border-up/30 bg-up-soft text-up",
        error: "border-down/30 bg-red-soft text-down",
        muted: "border-border bg-secondary text-muted-foreground",
      },
    },
  },
);

export function ManualPositionCard({
  activePosition,
  asset,
  lastPrice,
  positionStatusMessage,
  positionStatusTone,
  timeframe,
}: {
  activePosition: Position | undefined;
  asset: Asset;
  lastPrice: number | undefined;
  positionStatusMessage: string | undefined;
  positionStatusTone: "success" | "error" | "muted";
  timeframe: SupportedTimeframe;
}) {
  return (
    <article
      className="grid gap-3.5 rounded-(--radius) border border-border bg-card p-4.5 scroll-mt-18 [&_h2]:m-0 [&_h2]:text-base"
      id={manualPositionAnchorId}
    >
      <div className="flex items-start justify-between gap-3">
        <h2>Manual Position</h2>
        <InfoPill>{activePosition ? "active" : "none"}</InfoPill>
      </div>

      {positionStatusMessage ? (
        <p
          className={actionBannerVariants({ tone: positionStatusTone })}
          role="status"
        >
          {positionStatusMessage}
        </p>
      ) : null}

      {activePosition ? (
        <div className="grid gap-4">
          <div className="grid gap-2">
            <DetailRow label="Direction" value={activePosition.direction} />
            <DetailRow label="Status" value={activePosition.status} />
            <DetailRow
              label="Average entry"
              value={formatPrice(activePosition.averageEntryPrice)}
            />
            <DetailRow
              label="Remaining qty"
              value={activePosition.remainingQuantity}
            />
            <DetailRow
              label="Stop loss"
              value={formatPrice(activePosition.stopLoss)}
            />
            <DetailRow
              label="Opened"
              value={formatRelativeTime(activePosition.openedAt)}
            />
          </div>

          <form
            className="grid grid-cols-2 gap-3 sm:grid-cols-1 [&>button]:col-span-full"
            action={updatePositionAction}
          >
            <input type="hidden" name="positionId" value={activePosition.id} />
            <input
              type="hidden"
              name="symbol"
              value={asset.symbol.toLowerCase()}
            />
            <input type="hidden" name="timeframe" value={timeframe} />
            <Label className={positionFieldLabelClassName}>
              Average Entry
              <Input
                className={positionInputClassName}
                name="averageEntryPrice"
                type="number"
                step="any"
                min="0"
                defaultValue={activePosition.averageEntryPrice}
                required
              />
            </Label>
            <Label className={positionFieldLabelClassName}>
              Remaining Quantity
              <Input
                className={positionInputClassName}
                name="remainingQuantity"
                type="number"
                step="any"
                min="0"
                defaultValue={activePosition.remainingQuantity}
                required
              />
            </Label>
            <Label className={positionFieldLabelClassName}>
              Status
              <select
                className={nativeSelectClassName}
                name="status"
                defaultValue={activePosition.status}
              >
                <option value="open">Open</option>
                <option value="partially_closed">Partially Closed</option>
              </select>
            </Label>
            <Label className={positionFieldLabelClassName}>
              Stop
              <Input
                className={positionInputClassName}
                name="stopLoss"
                type="number"
                step="any"
                min="0"
                defaultValue={activePosition.stopLoss ?? ""}
              />
            </Label>
            <Label className={cn(positionFieldLabelClassName, "col-span-full")}>
              Thesis
              <Input
                className={positionInputClassName}
                name="thesis"
                type="text"
                defaultValue={activePosition.thesis ?? ""}
              />
            </Label>
            <Label className={cn(positionFieldLabelClassName, "col-span-full")}>
              Notes
              <Textarea
                className={cn(
                  positionInputClassName,
                  "min-h-22 resize-y py-2.5",
                )}
                name="notes"
                rows={3}
                defaultValue={activePosition.notes ?? ""}
              />
            </Label>
            <Button type="submit" className="col-span-full min-h-10">
              Save Position Update
            </Button>
          </form>

          <form
            className="grid grid-cols-2 gap-3 border-t border-border pt-2 sm:grid-cols-1 [&>button]:col-span-full"
            action={closePositionAction}
          >
            <input type="hidden" name="positionId" value={activePosition.id} />
            <input
              type="hidden"
              name="symbol"
              value={asset.symbol.toLowerCase()}
            />
            <input type="hidden" name="timeframe" value={timeframe} />
            <Label className={positionFieldLabelClassName}>
              Realized PnL
              <Input
                className={positionInputClassName}
                name="realizedPnl"
                type="number"
                step="any"
                defaultValue={activePosition.realizedPnl ?? ""}
              />
            </Label>
            <Label className={positionFieldLabelClassName}>
              Realized PnL %
              <Input
                className={positionInputClassName}
                name="realizedPnlPercent"
                type="number"
                step="any"
                defaultValue={activePosition.realizedPnlPercent ?? ""}
              />
            </Label>
            <Label className={cn(positionFieldLabelClassName, "col-span-full")}>
              Close Notes
              <Textarea
                className={cn(
                  positionInputClassName,
                  "min-h-22 resize-y py-2.5",
                )}
                name="notes"
                rows={3}
                defaultValue={activePosition.notes ?? ""}
              />
            </Label>
            <Button
              variant="destructive"
              type="submit"
              className="col-span-full min-h-10 bg-red text-white hover:bg-red/90"
            >
              Close Position
            </Button>
          </form>
        </div>
      ) : (
        <form
          className="grid grid-cols-2 gap-3 sm:grid-cols-1 [&>button]:col-span-full"
          action={recordPositionAction}
        >
          <input type="hidden" name="assetId" value={asset.id} />
          <input
            type="hidden"
            name="symbol"
            value={asset.symbol.toLowerCase()}
          />
          <input type="hidden" name="timeframe" value={timeframe} />
          <Label className={positionFieldLabelClassName}>
            Direction
            <select
              className={nativeSelectClassName}
              name="direction"
              defaultValue="long"
            >
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </Label>
          <Label className={positionFieldLabelClassName}>
            Entry
            <Input
              className={positionInputClassName}
              name="entryPrice"
              type="number"
              step="any"
              min="0"
              defaultValue={lastPrice ?? ""}
              required
            />
          </Label>
          <Label className={positionFieldLabelClassName}>
            Quantity
            <Input
              className={positionInputClassName}
              name="quantity"
              type="number"
              step="any"
              min="0"
              required
            />
          </Label>
          <Label className={positionFieldLabelClassName}>
            Stop
            <Input
              className={positionInputClassName}
              name="stopLoss"
              type="number"
              step="any"
              min="0"
            />
          </Label>
          <Label className={cn(positionFieldLabelClassName, "col-span-full")}>
            Thesis
            <Input
              className={positionInputClassName}
              name="thesis"
              type="text"
            />
          </Label>
          <Button type="submit" className="col-span-full min-h-10">
            Record Position
          </Button>
        </form>
      )}
    </article>
  );
}
