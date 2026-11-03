import type { ProviderQuotaResult } from "@paperclipai/shared";
import { formatDateTime } from "../lib/utils";
import { QuotaBar } from "./QuotaBar";
import { quotaUnavailableMessage } from "../lib/quota-refresh";
import { t } from "@/i18n";

export function AccountQuotaPanels({
  accounts,
  failed,
}: {
  accounts: ProviderQuotaResult[];
  failed?: boolean;
}) {
  return (
    <div className="space-y-4">
      {accounts.map((account) => (
        <section
          className="space-y-2"
          key={account.accountKey ?? account.provider}
        >
          <p className="text-sm font-medium">
            {account.accountLabel ?? t("tail1.quotas.subscriptionAccount")}
          </p>
          {(failed || !account.ok) && (
            <p className="text-sm text-muted-foreground">
              {account.errorFamily === "credentials_unavailable"
                ? t("tail1.quotas.connectSubscription")
                : quotaUnavailableMessage(account.windows.length > 0)}
            </p>
          )}
          {account.windows.map((window, index) => window.usedPercent == null ? (
            <div key={`${window.label}:${index}`} className="space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <span>{window.label}</span>
                <span className="font-mono text-muted-foreground">{window.valueLabel ?? t("tail1.quotas.usageNotReported")}</span>
              </div>
              {window.resetsAt && <p className="text-xs font-mono text-muted-foreground">{t("tail1.quotas.resets", { time: formatDateTime(window.resetsAt) })}</p>}
            </div>
          ) : (
            <QuotaBar
              key={`${window.label}:${index}`}
              className="font-mono"
              label={window.label}
              percentUsed={window.usedPercent}
              leftLabel={
                window.valueLabel ??
                (window.usedPercent === null
                  ? t("tail1.quotas.usageNotReported")
                  : t("tail1.quotas.percentUsed", { n: window.usedPercent }))
              }
              rightLabel={
                window.resetsAt
                  ? t("tail1.quotas.resets", { time: formatDateTime(window.resetsAt) })
                  : undefined
              }
            />
          ))}
          {account.capturedAt && (
            <p className="text-xs font-mono text-muted-foreground">
              {t("tail1.quotas.lastChecked", { time: formatDateTime(account.capturedAt) })}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
