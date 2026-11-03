import type { ToolCatalogEntry } from "@paperclipai/shared";
import { t } from "@/i18n";

export type ActionPermissionSummary = {
  allowedCount: number;
  askFirstCount: number;
  offCount: number;
};

export function summarizeActionPermissions(
  entries: ToolCatalogEntry[],
  enabledIds: Set<string>,
  askFirstIds: Set<string>,
): ActionPermissionSummary {
  let allowedCount = 0;
  let askFirstCount = 0;
  let offCount = 0;

  for (const entry of entries) {
    if (!enabledIds.has(entry.id)) {
      offCount += 1;
    } else if (askFirstIds.has(entry.id)) {
      askFirstCount += 1;
    } else {
      allowedCount += 1;
    }
  }

  return { allowedCount, askFirstCount, offCount };
}

function summaryCount(label: string, count: number): string {
  return `${label} ${count}${count === 1 ? t("apps.summary.actionUnit") : ""}`;
}

export function formatActionPermissionSummary(summary: ActionPermissionSummary): string {
  return [
    summaryCount(t("apps.summary.allowed"), summary.allowedCount),
    summaryCount(t("apps.summary.askFirst"), summary.askFirstCount),
    summaryCount(t("apps.summary.off"), summary.offCount),
  ].join(" · ");
}
