import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { brandChipBadge } from "@/lib/status-colors";
import type { BuiltInAgentStatus } from "@/api/builtInAgents";
import { useTranslation } from "@/i18n";

/**
 * Derived lifecycle chip. Rendered for the amber attention states
 * (`needs_setup`, `pending_approval`). Kept separate from the real agent status
 * (`idle/active/…`) per ux-spec D1.
 */
export function BuiltInLifecycleChip({
  status,
  compact = false,
  className,
}: {
  status: BuiltInAgentStatus;
  compact?: boolean;
  className?: string;
}) {
  if (status !== "needs_setup" && status !== "pending_approval") return null;
  const { t } = useTranslation();
  const isPendingApproval = status === "pending_approval";
  return (
    <Badge
      variant="outline"
      className={cn(
        brandChipBadge.amber,
        compact && "px-1.5 py-0 text-(length:--text-nano)",
        className,
      )}
      title={
        isPendingApproval
          ? t("comps2.builtIn.approvalTitle")
          : t("comps2.builtIn.setupTitle")
      }
    >
      {isPendingApproval ? (compact ? t("comps2.builtIn.approvalShort") : t("comps2.builtIn.pendingApproval")) : compact ? t("comps2.builtIn.setupShort") : t("comps2.builtIn.needsSetup")}
    </Badge>
  );
}
