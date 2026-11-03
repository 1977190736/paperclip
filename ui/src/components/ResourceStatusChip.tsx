import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { brandChipBadge, type BrandChipColor } from "@/lib/status-colors";
import { useTranslation } from "@/i18n";

/**
 * The load-bearing visual grammar for the built-in bundle status panel
 * (Reflection Coach — [PAP-13099], ux-spec §4). Each variant double-encodes
 * state as glyph + word + color so it never relies on color alone
 * (WCAG 1.4.1). Colors route through the shared `brandChipBadge` families — no
 * bespoke tints are minted here (ux-spec §10).
 *
 * A single resource shows at most one readiness chip and at most one drift
 * chip; when both a readiness problem and a drift state coexist, the caller
 * suppresses the drift chip until readiness is `ready` (ux-spec §4).
 */
export type ResourceStatusVariant =
  | "ready"
  | "needs_setup"
  | "missing"
  | "error"
  | "update_available"
  | "drifted"
  | "schedule_off"
  | "schedule_on"
  | "pending_approval"
  | "proposal_pending";

interface VariantSpec {
  color: BrandChipColor;
  glyph: string;
  labelKey: string;
  titleKey: string;
}

const VARIANTS: Record<ResourceStatusVariant, VariantSpec> = {
  ready: { color: "green", glyph: "●", labelKey: "comps3.resourceChip.ready.label", titleKey: "comps3.resourceChip.ready.title" },
  needs_setup: { color: "amber", glyph: "⚠", labelKey: "comps3.resourceChip.needsSetup.label", titleKey: "comps3.resourceChip.needsSetup.title" },
  missing: { color: "amber", glyph: "⚠", labelKey: "comps3.resourceChip.missing.label", titleKey: "comps3.resourceChip.missing.title" },
  error: { color: "red", glyph: "✕", labelKey: "comps3.resourceChip.error.label", titleKey: "comps3.resourceChip.error.title" },
  update_available: {
    color: "blue",
    glyph: "↑",
    labelKey: "comps3.resourceChip.updateAvailable.label",
    titleKey: "comps3.resourceChip.updateAvailable.title",
  },
  drifted: {
    color: "gray",
    glyph: "✎",
    labelKey: "comps3.resourceChip.drifted.label",
    titleKey: "comps3.resourceChip.drifted.title",
  },
  schedule_off: {
    color: "gray",
    glyph: "◌",
    labelKey: "comps3.resourceChip.scheduleOff.label",
    titleKey: "comps3.resourceChip.scheduleOff.title",
  },
  schedule_on: { color: "green", glyph: "●", labelKey: "comps3.resourceChip.scheduleOn.label", titleKey: "comps3.resourceChip.scheduleOn.title" },
  pending_approval: {
    color: "amber",
    glyph: "⚠",
    labelKey: "comps3.resourceChip.pendingApproval.label",
    titleKey: "comps3.resourceChip.pendingApproval.title",
  },
  proposal_pending: {
    color: "blue",
    glyph: "↑",
    labelKey: "comps3.resourceChip.proposalPending.label",
    titleKey: "comps3.resourceChip.proposalPending.title",
  },
};

export function ResourceStatusChip({
  variant,
  label,
  compact = false,
  className,
}: {
  variant: ResourceStatusVariant;
  /** Override the default label (e.g. "Weekly · Mon 09:00 UTC"). */
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const spec = VARIANTS[variant];
  return (
    <Badge
      variant="outline"
      className={cn(
        brandChipBadge[spec.color],
        "font-medium",
        compact && "px-1.5 py-0 text-(length:--text-nano)",
        className,
      )}
      title={t(spec.titleKey)}
    >
      <span aria-hidden="true">{spec.glyph}</span>
      {label ?? t(spec.labelKey)}
    </Badge>
  );
}
