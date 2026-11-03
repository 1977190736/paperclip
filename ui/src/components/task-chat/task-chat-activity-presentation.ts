import {
  AlertTriangle,
  BookOpen,
  Bot,
  Box,
  Clock3,
  Database,
  FileCheck2,
  FilePenLine,
  FileText,
  GitBranch,
  Info,
  ListChecks,
  PackageCheck,
  Search,
  ShieldCheck,
  TerminalSquare,
  Users,
} from "lucide-react";
import type {
  TaskChatMaterializedResourceItem,
  TaskChatProtocolItem,
  TaskChatProviderActivityItem,
  TaskChatWorkspaceChangeItem,
  TaskChatWorkspaceFileItem,
} from "./task-chat-model";
import {
  humanizeToolName,
  isGenericToolName,
  mcpToolIdentity,
  toolActivityPresentation,
  type ToolIcon,
} from "./tool-taxonomy";
import { t } from "@/i18n";

export interface TaskChatActivityPresentation {
  icon: ToolIcon;
  runningLabel: string;
  completedLabel: string;
  failedLabel?: string;
  interruptedLabel?: string;
  detail?: string;
}

export function providerNoticeSeverity(item: TaskChatProviderActivityItem): "info" | "warning" | "error" {
  const severity = item.details.find((entry) => entry.label === "Severity")?.value;
  if (item.status === "failed" || severity === "error") return "error";
  return severity === "info" ? "info" : "warning";
}

function providerDetail(item: TaskChatProviderActivityItem, ...labels: string[]): string | undefined {
  return item.details.find((entry) => labels.includes(entry.label))?.value;
}

function meaningfulToolDetail(value: string | undefined): string | undefined {
  if (!value || isGenericToolName(value) || /^tool(?:\s+|_)call\b/i.test(value)) return undefined;
  return value;
}

export function providerActivityPresentation(item: TaskChatProviderActivityItem): TaskChatActivityPresentation {
  const detail = item.summary
    ?? providerDetail(item, "Query", "URL", "Target", "Name", "Reference", "Reason", "Summary");
  switch (item.family) {
    case "research": {
      const action = providerDetail(item, "Action")?.toLowerCase();
      if (action === "open_page") {
        return { icon: Search, runningLabel: t("taskChat.activity.research.openPage.running"), completedLabel: t("taskChat.activity.research.openPage.completed"), failedLabel: t("taskChat.activity.research.openPage.failed"), interruptedLabel: t("taskChat.activity.research.openPage.interrupted"), detail };
      }
      if (action === "find_in_page") {
        return { icon: Search, runningLabel: t("taskChat.activity.research.findInPage.running"), completedLabel: t("taskChat.activity.research.findInPage.completed"), failedLabel: t("taskChat.activity.research.findInPage.failed"), interruptedLabel: t("taskChat.activity.research.findInPage.interrupted"), detail };
      }
      return { icon: Search, runningLabel: t("taskChat.activity.research.default.running"), completedLabel: t("taskChat.activity.research.default.completed"), failedLabel: t("taskChat.activity.research.default.failed"), interruptedLabel: t("taskChat.activity.research.default.interrupted"), detail };
    }
    case "tool_execution": {
      const name = providerDetail(item, "Name");
      const target = providerDetail(item, "Target");
      const progress = providerDetail(item, "Progress");
      const tool = toolActivityPresentation({
        name,
        transport: providerDetail(item, "Transport"),
        namespace: providerDetail(item, "Namespace"),
        operation: providerDetail(item, "Operation"),
        target,
        progress,
      });
      const boundedActivity = meaningfulToolDetail(item.summary)
        ?? meaningfulToolDetail(progress)
        ?? meaningfulToolDetail(target);
      const activityIsIdentity = Boolean(
        boundedActivity && name && humanizeToolName(boundedActivity) === humanizeToolName(name),
      );
      const technicalName = name ? mcpToolIdentity(name)?.name ?? name : tool.displayName;
      const runningPrefix = t("taskChat.tools.runningPrefix");
      const bareRunningLabel = tool.runningLabel.startsWith(`${runningPrefix} `)
        ? tool.runningLabel.slice(runningPrefix.length + 1)
        : tool.runningLabel;
      const source = tool.sourceLabel
        ? `${tool.sourceLabel} · ${technicalName}`
        : name && !isGenericToolName(name) && humanizeToolName(name) !== bareRunningLabel
          ? name
          : undefined;
      return {
        icon: tool.icon,
        runningLabel: tool.runningLabel,
        completedLabel: tool.completedLabel,
        failedLabel: tool.failedLabel,
        interruptedLabel: tool.interruptedLabel,
        detail: [activityIsIdentity ? undefined : boundedActivity, source].filter(Boolean).join(" · ") || undefined,
      };
    }
    case "plan":
      return { icon: ListChecks, runningLabel: t("taskChat.activity.plan.running"), completedLabel: t("taskChat.activity.plan.completed"), failedLabel: t("taskChat.activity.plan.failed"), interruptedLabel: t("taskChat.activity.plan.interrupted"), detail };
    case "delegation": {
      const action = providerDetail(item, "Action")?.toLowerCase();
      if (action === "message") return { icon: Users, runningLabel: t("taskChat.activity.delegation.message.running"), completedLabel: t("taskChat.activity.delegation.message.completed"), failedLabel: t("taskChat.activity.delegation.message.failed"), interruptedLabel: t("taskChat.activity.delegation.message.interrupted"), detail };
      if (action === "resume") return { icon: Users, runningLabel: t("taskChat.activity.delegation.resume.running"), completedLabel: t("taskChat.activity.delegation.resume.completed"), failedLabel: t("taskChat.activity.delegation.resume.failed"), interruptedLabel: t("taskChat.activity.delegation.resume.interrupted"), detail };
      if (action === "close") return { icon: Users, runningLabel: t("taskChat.activity.delegation.close.running"), completedLabel: t("taskChat.activity.delegation.close.completed"), failedLabel: t("taskChat.activity.delegation.close.failed"), interruptedLabel: t("taskChat.activity.delegation.close.interrupted"), detail };
      if (action === "wait") return { icon: Users, runningLabel: t("taskChat.activity.delegation.wait.running"), completedLabel: t("taskChat.activity.delegation.wait.completed"), failedLabel: t("taskChat.activity.delegation.wait.failed"), interruptedLabel: t("taskChat.activity.delegation.wait.interrupted"), detail };
      return { icon: Users, runningLabel: t("taskChat.activity.delegation.default.running"), completedLabel: t("taskChat.activity.delegation.default.completed"), failedLabel: t("taskChat.activity.delegation.default.failed"), interruptedLabel: t("taskChat.activity.delegation.default.interrupted"), detail };
    }
    case "model_identity":
      return item.eventType === "model.route.changed"
        ? { icon: Bot, runningLabel: t("taskChat.activity.modelIdentity.switch.running"), completedLabel: t("taskChat.activity.modelIdentity.switch.completed"), failedLabel: t("taskChat.activity.modelIdentity.switch.failed"), interruptedLabel: t("taskChat.activity.modelIdentity.switch.interrupted"), detail }
        : { icon: Bot, runningLabel: t("taskChat.activity.modelIdentity.verify.running"), completedLabel: t("taskChat.activity.modelIdentity.verify.completed"), failedLabel: t("taskChat.activity.modelIdentity.verify.failed"), interruptedLabel: t("taskChat.activity.modelIdentity.verify.interrupted"), detail };
    case "context":
      return { icon: Database, runningLabel: t("taskChat.activity.context.running"), completedLabel: t("taskChat.activity.context.completed"), failedLabel: t("taskChat.activity.context.failed"), interruptedLabel: t("taskChat.activity.context.interrupted"), detail };
    case "artifact": {
      const viewed = item.eventType === "artifact.viewed";
      return viewed
        ? { icon: Box, runningLabel: t("taskChat.activity.artifact.view.running"), completedLabel: t("taskChat.activity.artifact.view.completed"), failedLabel: t("taskChat.activity.artifact.view.failed"), interruptedLabel: t("taskChat.activity.artifact.view.interrupted"), detail }
        : { icon: Box, runningLabel: t("taskChat.activity.artifact.generate.running"), completedLabel: t("taskChat.activity.artifact.generate.completed"), failedLabel: t("taskChat.activity.artifact.generate.failed"), interruptedLabel: t("taskChat.activity.artifact.generate.interrupted"), detail };
    }
    case "review": {
      const state = providerDetail(item, "State")?.toLowerCase();
      return state === "exited"
        ? { icon: FileCheck2, runningLabel: t("taskChat.activity.review.exit.running"), completedLabel: t("taskChat.activity.review.exit.completed"), failedLabel: t("taskChat.activity.review.exit.failed"), interruptedLabel: t("taskChat.activity.review.exit.interrupted"), detail }
        : { icon: FileCheck2, runningLabel: t("taskChat.activity.review.enter.running"), completedLabel: t("taskChat.activity.review.enter.completed"), failedLabel: t("taskChat.activity.review.enter.failed"), interruptedLabel: t("taskChat.activity.review.enter.interrupted"), detail };
    }
    case "hook":
      return { icon: GitBranch, runningLabel: t("taskChat.activity.hook.running"), completedLabel: t("taskChat.activity.hook.completed"), failedLabel: t("taskChat.activity.hook.failed"), interruptedLabel: t("taskChat.activity.hook.interrupted"), detail };
    case "memory":
      return { icon: BookOpen, runningLabel: t("taskChat.activity.memory.running"), completedLabel: t("taskChat.activity.memory.completed"), failedLabel: t("taskChat.activity.memory.failed"), interruptedLabel: t("taskChat.activity.memory.interrupted"), detail };
    case "safety":
      return { icon: ShieldCheck, runningLabel: t("taskChat.activity.safety.running"), completedLabel: t("taskChat.activity.safety.completed"), failedLabel: t("taskChat.activity.safety.failed"), interruptedLabel: t("taskChat.activity.safety.interrupted"), detail };
    case "terminal":
      return { icon: TerminalSquare, runningLabel: t("taskChat.activity.terminal.running"), completedLabel: t("taskChat.activity.terminal.completed"), failedLabel: t("taskChat.activity.terminal.failed"), interruptedLabel: t("taskChat.activity.terminal.interrupted"), detail };
    case "wait":
      return { icon: Clock3, runningLabel: t("taskChat.activity.wait.running"), completedLabel: t("taskChat.activity.wait.completed"), failedLabel: t("taskChat.activity.wait.failed"), interruptedLabel: t("taskChat.activity.wait.interrupted"), detail };
    case "provider_notice":
      return { icon: providerNoticeSeverity(item) === "info" ? Info : AlertTriangle, runningLabel: t("taskChat.activity.providerNotice.running"), completedLabel: t("taskChat.activity.providerNotice.completed"), failedLabel: t("taskChat.activity.providerNotice.failed"), interruptedLabel: t("taskChat.activity.providerNotice.interrupted"), detail };
  }
}

function workspaceChangePresentation(item: TaskChatWorkspaceChangeItem): TaskChatActivityPresentation {
  const count = item.totals.files || item.files.length;
  const detail = count > 0 ? (count === 1 ? t("taskChat.common.oneFile") : t("taskChat.common.nFiles", { n: count })) : undefined;
  return { icon: FilePenLine, runningLabel: t("taskChat.activity.workspaceChange.running"), completedLabel: t("taskChat.activity.workspaceChange.completed"), detail };
}

function workspaceFilePresentation(item: TaskChatWorkspaceFileItem): TaskChatActivityPresentation {
  return {
    icon: FileText,
    runningLabel: t("taskChat.activity.workspaceFile.running"),
    completedLabel: t("taskChat.activity.workspaceFile.completed"),
    detail: item.line == null ? item.path : `${item.path}:${item.line}`,
  };
}

function resourcePresentation(item: TaskChatMaterializedResourceItem): TaskChatActivityPresentation {
  return {
    icon: item.resourceKind === "document" ? FileText : PackageCheck,
    runningLabel: t("taskChat.activity.resource.running"),
    completedLabel: item.resourceKind === "document" ? t("taskChat.activity.resource.completedDocument") : t("taskChat.activity.resource.completedDeliverable"),
    detail: item.title,
  };
}

export function protocolActivityPresentation(item: TaskChatProtocolItem): TaskChatActivityPresentation | null {
  switch (item.surface) {
    case "provider_activity": return providerActivityPresentation(item);
    case "workspace_change": return workspaceChangePresentation(item);
    case "workspace_file": return workspaceFilePresentation(item);
    case "resource": return resourcePresentation(item);
    case "runtime_request":
    case "run_result":
    case "run_terminal":
      return null;
  }
}

export function protocolActivityIsRunning(item: TaskChatProtocolItem): boolean {
  if (item.surface === "provider_activity") return item.status === "running";
  if (item.surface === "workspace_change") return !item.complete;
  return false;
}

export function protocolActivityLabel(item: TaskChatProtocolItem, presentation: TaskChatActivityPresentation): string {
  if (item.surface !== "provider_activity") {
    return protocolActivityIsRunning(item) ? presentation.runningLabel : presentation.completedLabel;
  }
  if (item.status === "failed") return presentation.failedLabel ?? `${presentation.completedLabel} · ${t("taskChat.tools.failedSuffix")}`;
  if (item.status === "interrupted") return presentation.interruptedLabel ?? `${presentation.completedLabel} · ${t("taskChat.tools.interruptedSuffix")}`;
  return item.status === "running" ? presentation.runningLabel : presentation.completedLabel;
}
