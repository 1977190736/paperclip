import { useMemo } from "react";
import {
  humanizeConnectionDisplayName,
  type Agent,
  type ToolCallEvent,
  type ToolConnectionLifecycleEvent,
} from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/timeAgo";
import { appTabHref } from "../app-tabs";
import { t, useTranslation } from "@/i18n";
import type { ActivityPanelProps } from "./types";

export function ActivityPanel(props: ActivityPanelProps) {
  return <RecentActivity {...props} />;
}

type TimelineRow = {
  key: string;
  createdAt: Date | string;
  primary: string;
  dotClass: string;
  /** Secondary "while working on PAP-…" issue link, tool-call rows only. */
  issue?: { identifier: string } | null;
  /** Deep-link rendered after the timestamp, lifecycle rows only. */
  link?: { to: string; label: string } | null;
};

function RecentActivity({
  events,
  lifecycleEvents,
  issues,
  actionRequests,
  loading,
  agents,
  connectionId,
  appName,
  userLabelById,
}: ActivityPanelProps) {
  const { t } = useTranslation();
  const nameById = useMemo(() => new Map(agents.map((a) => [a.id, a.name])), [agents]);
  const rows = useMemo<TimelineRow[]>(() => {
    const callRows: TimelineRow[] = events
      .filter((e) => HUMANIZED_EVENTS.has(e.eventType))
      .map((event) => {
        const row = humanizeEvent(
          event,
          nameById.get(event.agentId ?? "") ?? null,
          event.actionRequestId ? actionRequests[event.actionRequestId] : undefined,
          isTestEvent(event) ? resolveActorLabel(event.actorId, userLabelById) : null,
        );
        return {
          key: `call:${event.id}`,
          createdAt: event.createdAt,
          primary: row.primary,
          dotClass: dotColor(event),
          issue: event.issueId ? issues[event.issueId] ?? null : null,
        };
      });

    const permissionsHref = appTabHref(connectionId, "permissions");
    const lifecycleRows: TimelineRow[] = lifecycleEvents.map((event) => ({
      key: `lifecycle:${event.id}`,
      createdAt: event.createdAt,
      primary: humanizeLifecycleEvent(event, appName, nameById.get(event.agentId ?? "") ?? null),
      dotClass: lifecycleDotColor(event),
      link: { to: permissionsHref, label: lifecycleLinkLabel(event) },
    }));

    return [...callRows, ...lifecycleRows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [events, lifecycleEvents, issues, actionRequests, nameById, connectionId, appName, userLabelById]);

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t("apps.detail.activity.title")}</h2>
      </div>
      {loading ? (
        <div className="space-y-2 py-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-5 text-sm text-muted-foreground">{t("apps.detail.activity.empty")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.key} className="flex items-start gap-3 py-3 text-sm">
              <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", row.dotClass)} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-foreground">{row.primary}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {row.issue ? (
                    <>
                      {t("apps.detail.activity.whileWorkingOn")}{" "}
                      <Link
                        to={`/issues/${row.issue.identifier}`}
                        className="font-medium text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {row.issue.identifier}
                      </Link>
                      {" · "}
                    </>
                  ) : null}
                  {timeAgo(row.createdAt)}
                  {row.link ? (
                    <>
                      {" · "}
                      <Link
                        to={row.link.to}
                        className="font-medium text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {row.link.label}
                      </Link>
                    </>
                  ) : null}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const HUMANIZED_EVENTS = new Set<ToolCallEvent["eventType"]>([
  "call_completed",
  "call_failed",
  "call_denied",
  "approval_requested",
  "approval_resolved",
]);

/**
 * A row is a prosumer Test-tab call (vs. a real heartbeat-driven agent run) when
 * the gateway tagged the audit event `metadata.source === "test"` (PAP-11349).
 */
export function isTestEvent(event: ToolCallEvent): boolean {
  return (event.metadata as { source?: unknown } | null)?.source === "test";
}

/** Display name for the human who ran a Test-tab call, from the company directory. */
export function resolveActorLabel(
  actorId: string | null,
  userLabelById: Map<string, string> | undefined,
): string {
  if (actorId) {
    const label = userLabelById?.get(actorId);
    if (label) return label;
    if (actorId === "local-board") return t("apps.gateways.owner.board");
  }
  return t("apps.detail.activity.someone");
}

export function humanizeEvent(
  event: ToolCallEvent,
  agentName: string | null,
  actionRequest?: ActivityPanelProps["actionRequests"][string],
  /** When set, this row is a Test-tab call run by the named user; prefix accordingly. */
  testRunnerLabel?: string | null,
): { primary: string } {
  // For Test-tab calls, surface "<User> tested as <Agent>" so prosumer test runs are
  // distinguishable from real heartbeat agent activity in the audit trail (PAP-11415).
  const who = testRunnerLabel
    ? t("apps.detail.activity.testedAs", { runner: testRunnerLabel, name: agentName ?? t("apps.detail.activity.anAgentLower") })
    : agentName ?? t("apps.detail.activity.anAgent");
  const action = event.toolName ? humanizeConnectionDisplayName(event.toolName) : t("apps.detail.activity.anAction");
  switch (event.eventType) {
    case "call_completed":
      return {
        primary: event.outcome === "success"
          ? t("apps.detail.activity.usedAction", { who, action })
          : t("apps.detail.activity.ranNotFinished", { who, action }),
      };
    case "call_failed":
      return { primary: t("apps.detail.activity.didntWork", { action, who: testRunnerLabel ? who : agentName ?? t("apps.detail.activity.anAgentLower") }) };
    case "call_denied":
      return {
        primary: testRunnerLabel
          ? t("apps.detail.activity.turnOffDenied", { who, action })
          : t("apps.detail.activity.blockedAction", { action }),
      };
    case "approval_requested":
      return { primary: t("apps.detail.activity.askedBefore", { who, action }) };
    case "approval_resolved":
      return { primary: humanizeApprovalResolved(action, actionRequest) };
    default:
      return { primary: t("apps.detail.activity.usedAction", { who, action }) };
  }
}

function humanizeApprovalResolved(
  action: string,
  actionRequest?: ActivityPanelProps["actionRequests"][string],
): string {
  const resolver = actionRequest?.resolverDisplayName ?? t("apps.detail.activity.someone");
  if (actionRequest?.status === "approved") return t("apps.detail.activity.approved", { resolver, action });
  if (actionRequest?.status === "rejected") return t("apps.detail.activity.rejected", { resolver, action });
  return t("apps.detail.activity.reviewed", { resolver, action });
}

/** Humanize a connection lifecycle event into a prosumer sentence (PAP-11284). */
function humanizeLifecycleEvent(
  event: ToolConnectionLifecycleEvent,
  appName: string,
  agentName: string | null,
): string {
  const who = event.actorDisplayName ?? agentName ?? t("apps.detail.activity.someone");
  switch (event.type) {
    case "app_connected":
      return t("apps.detail.lifecycle.connected", { who, app: appName });
    case "app_paused":
      return t("apps.detail.lifecycle.paused", { who });
    case "app_resumed":
      return t("apps.detail.lifecycle.resumed", { who });
    case "reconnected":
      return t("apps.detail.lifecycle.reconnected", { who, app: appName });
    case "disconnected":
      return t("apps.detail.lifecycle.disconnected", { who, app: appName });
    case "allowlist_changed":
      return humanizeAllowlistChange(who, event.details);
    case "actions_quarantined": {
      const count = numberFrom(event.details?.count);
      return t(count === 1 ? "apps.detail.lifecycle.actionsQuarantined_one" : "apps.detail.lifecycle.actionsQuarantined_other", { count });
    }
    default:
      return t("apps.detail.lifecycle.updated", { who });
  }
}

function humanizeAllowlistChange(who: string, details: Record<string, unknown> | null): string {
  const added = numberFrom(details?.added);
  const removed = numberFrom(details?.removed);
  if (added > 0 && removed === 0) {
    return t(added === 1 ? "apps.detail.lifecycle.allowlistAdded_one" : "apps.detail.lifecycle.allowlistAdded_other", { who, count: added });
  }
  if (removed > 0 && added === 0) {
    return t(removed === 1 ? "apps.detail.lifecycle.allowlistRemoved_one" : "apps.detail.lifecycle.allowlistRemoved_other", { who, count: removed });
  }
  if (added > 0 && removed > 0) {
    return t("apps.detail.lifecycle.allowlistBoth", { who, added, removed });
  }
  return t("apps.detail.lifecycle.allowlistUpdated", { who });
}

function lifecycleLinkLabel(event: ToolConnectionLifecycleEvent): string {
  return event.type === "actions_quarantined" ? t("apps.detail.lifecycle.reviewPermissions") : t("apps.detail.lifecycle.viewPermissions");
}

function numberFrom(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function dotColor(event: ToolCallEvent): string {
  if (event.eventType === "call_failed" || event.outcome === "failure" || event.outcome === "timeout") {
    return "bg-red-400";
  }
  if (event.eventType === "call_denied" || event.outcome === "denied") return "bg-amber-400";
  if (event.eventType === "approval_requested") return "bg-amber-400";
  return "bg-emerald-400";
}

function lifecycleDotColor(event: ToolConnectionLifecycleEvent): string {
  if (event.type === "disconnected") return "bg-red-400";
  if (event.type === "app_paused" || event.type === "actions_quarantined") return "bg-amber-400";
  return "bg-emerald-400";
}
