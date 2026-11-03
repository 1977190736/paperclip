import type { ProviderTraceMetadata } from "@paperclipai/shared";
import { Bug, CircleOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { t, useTranslation } from "@/i18n";

export function runRequestedProviderTrace(
  contextSnapshot: Record<string, unknown> | null | undefined,
) {
  if (!contextSnapshot) return false;
  const debug = contextSnapshot.debug;
  return (
    typeof debug === "object" &&
    debug !== null &&
    !Array.isArray(debug) &&
    (debug as Record<string, unknown>).providerTrace === "raw"
  );
}

export function ProviderTraceStatusBadge({
  trace,
  requested = false,
  showOff = false,
  className,
}: {
  trace?: ProviderTraceMetadata | null;
  requested?: boolean;
  showOff?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const status = trace?.status;
  const expired = trace
    ? new Date(trace.expiresAt).getTime() <= Date.now()
    : false;
  let label: string | null = null;
  let off = false;
  if (expired) {
    label = t("comps3.traceBadge.expired");
  } else if (status === "capturing") {
    label = t("comps3.traceBadge.capturing");
  } else if (status === "complete") {
    label = t("comps3.traceBadge.complete");
  } else if (status === "incomplete") {
    label = t("comps3.traceBadge.incomplete");
  } else if (status === "truncated") {
    label = t("comps3.traceBadge.truncated");
  } else if (status === "expired") {
    label = t("comps3.traceBadge.expired");
  } else if (status === "deleted") {
    label = t("comps3.traceBadge.deleted");
  } else if (requested) {
    label = t("comps3.traceBadge.requested");
  } else if (showOff) {
    label = t("comps3.traceBadge.off");
    off = true;
  }
  if (!label) return null;
  const warning =
    status === "incomplete" ||
    status === "truncated" ||
    status === "expired" ||
    status === "deleted" ||
    expired;
  const muted = off || status === "deleted" || expired;
  const Icon = off ? CircleOff : Bug;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-(length:--text-micro) font-medium",
        muted
          ? "border-border bg-background text-muted-foreground"
          : warning
            ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
            : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200",
        className,
      )}
      title={
        trace
          ? t("comps3.traceBadge.detail", {
              frames: trace.frameCount,
              bytes: trace.byteCount,
              time: new Date(trace.expiresAt).toLocaleString(),
            })
          : requested
            ? t("comps3.traceBadge.requestedDetail")
            : t("comps3.traceBadge.offDetail")
      }
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
