import { Brain, CirclePause, Gauge, Layers3 } from "lucide-react";
import type { TaskChatActivityPhaseItem } from "./task-chat-model";
import {
  toolActivityPresentation,
  type ToolFamily,
  type ToolIcon,
} from "./tool-taxonomy";
import { protocolActivityPresentation, providerNoticeSeverity } from "./task-chat-activity-presentation";
import { t } from "@/i18n";

type Activity = TaskChatActivityPhaseItem["items"][number];
const labelKeys: Record<ToolFamily, string> = {
  terminal: "taskChat.completed.terminal",
  grep: "taskChat.completed.searchedFiles",
  search: "taskChat.completed.searchedFiles",
  read: "taskChat.completed.readFiles",
  edit: "taskChat.completed.editedFiles",
  web: "taskChat.completed.searchedWeb",
  plan: "taskChat.completed.workedOnPlan",
  question: "taskChat.completed.requestedInput",
  agent: "taskChat.completed.workedWithAgents",
  safety: "taskChat.completed.reviewedSafety",
  image: "taskChat.completed.workedWithImages",
  wait: "taskChat.completed.waited",
  mcp: "taskChat.completed.usedConnectedTools",
  other: "taskChat.completed.usedTools",
};

/** Describe observed activities, never infer success from a finished group. */
export function completedActivitySummary(items: Activity[]) {
  const categories = new Map<
    string,
    { label: string; icon: ToolIcon; order: number }
  >();
  const add = (label: string, icon: ToolIcon, order = 0) => {
    const existing = categories.get(label);
    if (!existing || order < existing.order)
      categories.set(label, { label, icon, order });
  };
  const tools: Array<{
    family: ToolFamily;
    icon: ToolIcon;
    completed: boolean;
    order: number;
  }> = [];
  const notices: Array<{
    summary: string | undefined;
    severity: "info" | "warning" | "error";
    icon: ToolIcon;
    order: number;
  }> = [];
  for (const [order, item] of items.entries()) {
    if (item.kind === "tool") {
      const p = toolActivityPresentation({
        name: item.rawName ?? item.name,
        target: item.target,
      });
      tools.push({ ...p, order, completed: item.status === "completed" });
    } else if (item.kind === "protocol") {
      if (
        item.surface === "provider_activity" &&
        item.family === "tool_execution"
      ) {
        const value = (label: string) =>
          item.details.find((d) => d.label === label)?.value;
        const p = toolActivityPresentation({
          name: value("Name"),
          operation: value("Operation"),
          transport: value("Transport"),
          namespace: value("Namespace"),
          target: value("Target"),
        });
        tools.push({ ...p, order, completed: item.status === "completed" });
      } else {
        const p = protocolActivityPresentation(item);
        if (!p) continue;
        if (item.surface === "provider_activity" && item.family === "provider_notice") {
          // Reuse only the normalized notice text already available in the row.
          const summary = item.summary?.trim()
            || item.details.find((entry) => entry.label === "Summary")?.value.trim();
          notices.push({ summary, severity: providerNoticeSeverity(item), icon: p.icon, order });
          continue;
        }
        const family =
          item.surface === "provider_activity" ? item.family : item.surface;
        const label = t(
          (
            {
              research: "taskChat.completed.searchedWeb",
              plan: "taskChat.completed.workedOnPlan",
              delegation: "taskChat.completed.workedWithAgents",
              artifact: "taskChat.completed.workedWithArtifacts",
              context: "taskChat.completed.managedContext",
              memory: "taskChat.completed.checkedMemory",
              model_identity: "taskChat.completed.checkedModelSettings",
              review: "taskChat.completed.workedInReviewMode",
              hook: "taskChat.completed.ranHooks",
              safety: "taskChat.completed.reviewedSafety",
              terminal: "taskChat.completed.terminal",
              wait: "taskChat.completed.waited",
              workspace_change: "taskChat.completed.workedOnFiles",
              workspace_file: "taskChat.completed.referencedFiles",
              resource: "taskChat.completed.addedResources",
            } as Record<string, string>
          )[family] ?? "taskChat.completed.usedTools"
        );
        add(label, p.icon, order);
      }
    }
  }
  if (notices.length) {
    const strongest = notices.find((notice) => notice.severity === "error")
      ?? notices.find((notice) => notice.severity === "warning")
      ?? notices[0]!;
    const label = notices.length === 1
      ? strongest.summary || t("taskChat.completed.receivedProviderUpdate")
      : strongest.severity === "error"
        ? t("taskChat.completed.providerErrorReported")
        : strongest.severity === "warning"
          ? t("taskChat.completed.providerWarningReported")
          : t("taskChat.completed.receivedProviderUpdates");
    // One notice category leaves room for actual work. Keep warnings and errors
    // visible when the compact label truncates other activity categories.
    add(label, strongest.icon, strongest.severity === "info" ? notices[0]!.order : -1);
  }
  const completedFamilies = new Set(
    tools.filter((tool) => tool.completed).map((tool) => tool.family),
  );
  // Merge repeated families and retries. Terminal is an action, not an exit-status claim.
  for (const tool of tools) {
    const succeeded = completedFamilies.has(tool.family);
    const label =
      tool.family === "read" && !succeeded
        ? t("taskChat.completed.checkedFiles")
        : tool.family === "edit" && !succeeded
          ? t("taskChat.completed.workedOnFiles")
          : t(labelKeys[tool.family]);
    add(label, tool.icon, tool.order);
  }
  if (!categories.size) {
    if (items.some((item) => item.kind === "thinking"))
      add(t("taskChat.completed.thoughtThroughTask"), Brain);
    else if (items.some((item) => item.kind === "marker"))
      add(t("taskChat.completed.activityStopped"), CirclePause);
    else add(t("taskChat.completed.recordedUsage"), Gauge);
  }
  const values = [...categories.values()].sort((a, b) => a.order - b.order);
  const join = (parts: string[]) =>
    parts
      .map((p, i) => (i ? p.charAt(0).toLowerCase() + p.slice(1) : p))
      .join(", ");
  const fullLabel = join(values.map((v) => v.label));
  return {
    label:
      values.length > 3
        ? `${join(values.slice(0, 2).map((v) => v.label))}${t("taskChat.completed.andMore")}`
        : fullLabel,
    fullLabel,
    icon: values.length === 1 ? values[0].icon : Layers3,
  };
}
