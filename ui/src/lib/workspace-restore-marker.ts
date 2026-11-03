import { safeWorkspaceRestorePath } from "@paperclipai/shared";
import { t } from "@/i18n";

export function workspaceRestoreMarkerDetail(input: {
  result: Record<string, unknown> | null | undefined;
  savedPlan: boolean;
  hasResponse: boolean;
}): string {
  const parts = [input.savedPlan
    ? t("libui.workspaceRestore.savedPlanKept")
    : t("libui.workspaceRestore.failed")];
  parts.push(t("libui.workspaceRestore.filesNeedRecovery"));
  if (!input.hasResponse && input.result?.finalResponseRecorded === false) {
    parts.push(t("libui.workspaceRestore.noFinalResponse"));
  }
  const relativePath = safeWorkspaceRestorePath(input.result?.workspaceRestorePath);
  if (relativePath) parts.push(t("libui.workspaceRestore.affectedPath", { path: relativePath }));
  return parts.join(" ");
}
