import { useMutation } from "@tanstack/react-query";
import type { AiConnectionUsage, AiConnectionUsageLimit, AiManagedConnectionSummary } from "@paperclipai/shared";
import { supportsAiConnectionUsage } from "@paperclipai/shared";
import { aiConnectionsApi } from "@/api/ai-connections";
import { Button } from "@/components/ui/button";
import { QuotaBar } from "@/components/QuotaBar";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { t, useTranslation } from "@/i18n";

const usageNumber = (value: number) => formatNumber(value, { maximumFractionDigits: 20 });
const amount = (value: number, unit: string | null) => unit === "USD"
  ? formatNumber(value, { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 20 })
  : `${usageNumber(value)}${unit ? ` ${unit}` : ""}`;

function limitLabel(window: AiConnectionUsageLimit) {
  const label = window.label.replace(/\b(\d+(?:\.\d+)?) hour limit\b/i, "$1h").replace(/\bweekly limit\b/i, t("connections.aiUsage.weekly"));
  if (window.windowDurationSeconds == null) return label;
  const hours = window.windowDurationSeconds / 3600;
  const period = hours === 168 ? t("connections.aiUsage.weekly") : `${usageNumber(hours)}h`;
  if (/\b(?:Primary|Secondary)$/.test(label)) return `${label} · ${period}`;
  if ((hours === 168 && /weekly/i.test(label)) || label.split(/[\s·()]+/).includes(period)) return label;
  return `${label} · ${period}`;
}

function limitValue(window: AiConnectionUsageLimit) {
  if (window.used === 0 && window.limit === 0) return t("connections.aiUsage.capOf", { amount: amount(window.limit, window.unit) });
  if (window.used != null && window.limit != null) return t("connections.aiUsage.usedOf", { used: amount(window.used, window.unit), limit: amount(window.limit, window.unit) });
  if (window.usedPercent != null) return t("connections.aiUsage.percentUsed", { percent: usageNumber(window.usedPercent) });
  if (window.used != null) return t("connections.aiUsage.usedAmount", { amount: amount(window.used, window.unit) });
  if (window.remainingPercent != null) return t("connections.aiUsage.percentLeft", { percent: usageNumber(window.remainingPercent) });
  return t("connections.aiUsage.notReported");
}

function limitDetails(window: AiConnectionUsageLimit) {
  const details: string[] = [];
  if (window.allowed === false) details.push(t("connections.aiUsage.blocked"));
  else if (window.limitReached === true) details.push(t("connections.aiUsage.limitReached"));
  if (window.allowed === true && (window.limitReached === true || window.usedPercent == null)) details.push(t("connections.aiUsage.usageAllowed"));
  if (window.used == null || window.limit == null) {
    if (window.remaining != null) details.push(t("connections.aiUsage.amountLeft", { amount: amount(window.remaining, window.unit) }));
    if (window.limit != null) details.push(t("connections.aiUsage.capOf", { amount: amount(window.limit, window.unit) }));
  }
  if (window.resetsAt) details.push(t("connections.aiUsage.resetsAt", { time: formatDateTime(window.resetsAt, { includeYear: false }) }));
  else if (window.resetInterval) details.push(t("connections.aiUsage.resetsIn", { interval: window.resetInterval }));
  return details.join(" · ");
}

function overageSummary(usage: AiConnectionUsage) {
  const overage = usage.overage!;
  const details = [overage.available === true ? t("connections.aiUsage.available")
    : overage.enabled === false ? t("connections.aiUsage.off")
    : overage.available === false ? (overage.enabled === true ? t("connections.aiUsage.onUnavailable") : t("connections.aiUsage.unavailable"))
    : overage.enabled === true ? t("connections.aiUsage.onAvailabilityUnknown") : t("connections.aiUsage.notReported")];
  if (overage.unlimited === true) details.push(t("connections.aiUsage.unlimited"));
  else if (overage.balance != null && (overage.balance !== 0 || overage.enabled !== false)) details.push(amount(overage.balance, overage.unit));
  if (overage.remaining != null && (overage.remaining !== 0 || overage.enabled !== false)
    && !usage.limits.some((window) => window.scope === "overage" && window.remaining === overage.remaining && window.unit === overage.unit)) {
    details.push(t("connections.aiUsage.amountLeft", { amount: amount(overage.remaining, overage.unit) }));
  }
  return details.join(" · ");
}

function usageError(usage: AiConnectionUsage) {
  switch (usage.errorCode) {
    case "authentication_required": return t("connections.aiUsage.errors.authentication_required");
    case "permission_denied": return t("connections.aiUsage.errors.permission_denied");
    case "rate_limited": return t("connections.aiUsage.errors.rate_limited");
    case "provider_unavailable": return t("connections.aiUsage.errors.provider_unavailable");
    case "invalid_response": return t("connections.aiUsage.errors.invalid_response");
    case "connection_unavailable": return t("connections.aiUsage.errors.connection_unavailable");
    case "unsupported": return t("connections.aiUsage.unavailable");
    default: return usage.message ?? t("connections.aiUsage.unavailable");
  }
}

export function AiConnectionUsagePanel({ account, observation, cachedOnly = false }: { account: AiManagedConnectionSummary; observation?: AiConnectionUsage; cachedOnly?: boolean }) {
  const { t } = useTranslation();
  const probe = useMutation({
    mutationFn: () => aiConnectionsApi.probeUsage(account.companyId, account.id, account.grantId),
  });
  const supported = supportsAiConnectionUsage(account.provider, account.method);
  const usage = cachedOnly ? observation : probe.isSuccess ? probe.data : undefined;
  return (
    <section aria-label={t("connections.aiUsage.accountLimits")} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{t("connections.aiUsage.usage")}</h3>
        {supported && !cachedOnly && <Button variant="outline" size="sm" disabled={probe.isPending || account.status !== "connected"} onClick={() => probe.mutate()}>
          {probe.isPending ? t("connections.aiUsage.checking") : usage?.status === "ok" ? t("connections.aiUsage.refresh") : t("connections.aiUsage.checkUsage")}
        </Button>}
      </div>
      {cachedOnly && !usage && <p className="text-xs text-muted-foreground">{t("connections.aiUsage.notObserved")}</p>}
      {!supported && <p className="text-xs text-muted-foreground">{t("connections.aiUsage.unavailableForMethod")}</p>}
      {probe.error && <p role="alert" className="text-sm text-destructive">{probe.error.message}</p>}
      {usage && usage.status !== "ok" && <p role={usage.status === "unsupported" ? "status" : "alert"} className="text-sm text-muted-foreground">{usageError(usage)}</p>}
      {usage?.status === "ok" && (
        <div className="space-y-3" aria-live="polite">
          {usage.limits.length === 0 && <p className="text-xs text-muted-foreground">{t("connections.aiUsage.usageNotReported")}</p>}
          {usage.limits.map((window) => {
            const details = limitDetails(window);
            return <div key={window.id} className="space-y-1.5">
              {window.usedPercent != null ? <QuotaBar label={limitLabel(window)} percentUsed={window.usedPercent} leftLabel={limitValue(window)} />
                : <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">{limitLabel(window)}</span>
                  <span className="font-mono">{limitValue(window)}</span>
                </div>}
              {details && <p className="text-xs text-muted-foreground">{details}</p>}
            </div>;
          })}
          {usage.overage && <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">{t("connections.aiUsage.overage")}</span>
            <span className="font-mono">{overageSummary(usage)}</span>
          </div>}
          <p className="text-xs text-muted-foreground">{t("connections.aiUsage.updated")} <time className="font-mono" dateTime={usage.checkedAt} title={formatDateTime(usage.checkedAt)}>{formatDateTime(usage.checkedAt, { includeYear: false })}</time>{usage.planType ? ` · ${usage.planType}` : ""}</p>
        </div>
      )}
    </section>
  );
}
