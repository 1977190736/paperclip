import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ScrollText } from "lucide-react";
import { Link } from "@/lib/router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/queryKeys";
import {
  toolsApi,
  type ToolAuditOutcome,
  type ToolAuditWindow,
  type ToolGatewayActivityEvent,
} from "@/api/tools";
import { agentsApi } from "@/api/agents";
import { AgentSelect } from "@/components/AgentMultiSelect";
import { ToolsPageHeader, LoadingState, ErrorState, RelativeTime } from "./shared";
import { t, useTranslation } from "@/i18n";

const PAGE_SIZE = 50;
const ALL = "__all";

/** Outcome chip vocabulary (spec §4C / §5): Allowed · Blocked · Asked first · Failed · Waiting. */
const OUTCOME_META: Record<ToolAuditOutcome, { labelKey: string; status: string }> = {
  allowed: { labelKey: "pages2.toolsAudit.outcomeAllowed", status: "allowed" },
  blocked: { labelKey: "pages2.toolsAudit.outcomeBlocked", status: "denied" },
  asked_first: { labelKey: "pages2.toolsAudit.outcomeAskedFirst", status: "require-approval" },
  waiting: { labelKey: "pages2.toolsAudit.outcomeWaiting", status: "deferred" },
  failed: { labelKey: "pages2.toolsAudit.outcomeFailed", status: "failed" },
  unknown: { labelKey: "pages2.toolsAudit.outcomeRecorded", status: "unchecked" },
};

const OUTCOME_FILTERS: { value: string; labelKey: string }[] = [
  { value: ALL, labelKey: "pages2.toolsAudit.allOutcomes" },
  { value: "allowed", labelKey: "pages2.toolsAudit.outcomeAllowed" },
  { value: "blocked", labelKey: "pages2.toolsAudit.outcomeBlocked" },
  { value: "asked_first", labelKey: "pages2.toolsAudit.outcomeAskedFirst" },
  { value: "waiting", labelKey: "pages2.toolsAudit.outcomeWaiting" },
  { value: "failed", labelKey: "pages2.toolsAudit.outcomeFailed" },
];

const WINDOW_FILTERS: { value: ToolAuditWindow; labelKey: string }[] = [
  { value: "all", labelKey: "pages2.toolsAudit.windowAll" },
  { value: "1h", labelKey: "pages2.toolsAudit.window1h" },
  { value: "24h", labelKey: "pages2.toolsAudit.window24h" },
  { value: "7d", labelKey: "pages2.toolsAudit.window7d" },
  { value: "30d", labelKey: "pages2.toolsAudit.window30d" },
];

function detailString(details: Record<string, unknown> | null, key: string): string | undefined {
  const v = details?.[key];
  return typeof v === "string" && v.trim().length > 0 ? v : undefined;
}

function detailStringArray(details: Record<string, unknown> | null, key: string): string[] {
  const v = details?.[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function detailRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function detailNumber(details: Record<string, unknown> | null, key: string): number | undefined {
  const value = details?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function formattedArguments(details: Record<string, unknown> | null): string | undefined {
  const summary = detailRecord(details?.argumentsSummary);
  const serialized = typeof summary?.summary === "string" ? summary.summary : undefined;
  if (!serialized) return undefined;
  try {
    return JSON.stringify(JSON.parse(serialized), null, 2);
  } catch {
    return serialized;
  }
}

function lifecycleSummary(event: ToolGatewayActivityEvent): string | null {
  if (!event.lifecycleType) return null;
  const who = event.actorDisplayName ?? event.agentDisplayName ?? t("pages2.toolsAudit.someone");
  const app = event.appDisplayName ?? event.connectionDisplayName ?? t("pages2.toolsAudit.thisApp");
  const count = detailNumber(event.details, "count") ?? 0;
  const added = detailNumber(event.details, "added") ?? 0;
  const removed = detailNumber(event.details, "removed") ?? 0;
  switch (event.lifecycleType) {
    case "app_connected":
      return t("pages2.toolsAudit.lifecycle.connected", { who, app });
    case "app_paused":
      return t("pages2.toolsAudit.lifecycle.paused", { who, app });
    case "app_resumed":
      return t("pages2.toolsAudit.lifecycle.resumed", { who, app });
    case "reconnected":
      return t("pages2.toolsAudit.lifecycle.reconnected", { who, app });
    case "disconnected":
      return t("pages2.toolsAudit.lifecycle.disconnected", { who, app });
    case "allowlist_changed":
      if (added > 0 && removed === 0) return t("pages2.toolsAudit.lifecycle.allowlistAdded", { who, app, count: added });
      if (removed > 0 && added === 0) return t("pages2.toolsAudit.lifecycle.allowlistRemoved", { who, app, count: removed });
      return t("pages2.toolsAudit.lifecycle.allowlistUpdated", { who, app });
    case "actions_quarantined":
      return t("pages2.toolsAudit.lifecycle.actionsQuarantined", { count, app });
    default:
      return t("pages2.toolsAudit.lifecycle.updated", { who, app });
  }
}

/** Plain-words "why" for the row expander, keyed off the reason code. */
function plainReason(event: ToolGatewayActivityEvent): string {
  if (event.lifecycleType) return t("pages2.toolsAudit.reason.lifecycle");
  const code = detailString(event.details, "reasonCode");
  if (code === "permitted_connections_not_installed") {
    return t("pages2.toolsAudit.reason.permittedNotInstalled");
  }
  switch (event.normalizedOutcome) {
    case "allowed":
      return t("pages2.toolsAudit.reason.allowed");
    case "blocked":
      if (code === "rate_limited") return t("pages2.toolsAudit.reason.blockedRateLimited");
      if (code?.includes("secret")) return t("pages2.toolsAudit.reason.blockedSecret");
      return t("pages2.toolsAudit.reason.blockedByRule");
    case "asked_first":
      return t("pages2.toolsAudit.reason.askedFirst");
    case "waiting":
      return t("pages2.toolsAudit.reason.waiting");
    case "failed":
      return t("pages2.toolsAudit.reason.failed");
    default:
      return t("pages2.toolsAudit.reason.recorded");
  }
}

/** Compact monospace fact row inside the Details collapse. */
function DetailFact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 break-all text-foreground", mono && "font-mono text-(length:--text-micro)")}>{value}</span>
    </div>
  );
}

function OutcomeChip({ outcome }: { outcome: ToolAuditOutcome }) {
  const { t } = useTranslation();
  const meta = OUTCOME_META[outcome] ?? OUTCOME_META.unknown;
  return <StatusBadge status={meta.status} label={t(meta.labelKey)} />;
}

function ActivityRow({
  event,
  ruleNamesById,
}: {
  event: ToolGatewayActivityEvent;
  ruleNamesById: Map<string, string>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const who = event.agentDisplayName ?? t("pages2.toolsAudit.anAgent");
  const action = event.toolDisplayName ?? t("pages2.toolsAudit.anAction");
  const app = event.appDisplayName ?? event.connectionDisplayName ?? event.applicationDisplayName ?? null;
  const lifecycle = lifecycleSummary(event);
  const rawTool = detailString(event.details, "tool") ?? detailString(event.details, "toolName");

  const issueId = detailString(event.details, "issueId");
  const runId = event.runId ?? detailString(event.details, "runId");
  const agentId = event.agentId ?? detailString(event.details, "agentId");
  const reasonCode = detailString(event.details, "reasonCode") ?? event.action.replace("tool_gateway.", "");
  const matchedRuleId = detailStringArray(event.details, "matchedPolicyIds").find((id) => ruleNamesById.has(id));
  const matchedRuleName = matchedRuleId ? ruleNamesById.get(matchedRuleId) : undefined;
  const argumentsText = formattedArguments(event.details);
  const execution = detailRecord(event.details?.execution);
  const request = detailRecord(execution?.request);
  const response = detailRecord(execution?.response);
  const transport = detailString(execution, "transport");
  const requestMethod = detailString(request, "httpMethod");
  const endpoint = detailString(request, "endpoint");
  const mcpMethod = detailString(request, "mcpMethod");
  const requestId = detailString(request, "requestId");
  const httpStatus = detailNumber(response, "httpStatus");
  const contentType = detailString(response, "contentType");
  const responseBytes = detailNumber(response, "bodySizeBytes");
  const upstreamRequestId = detailString(response, "upstreamRequestId");
  const permittedNotInstalledCount = detailNumber(event.details, "permittedNotInstalledCount");
  const permittedNotInstalledConnections = Array.isArray(event.details?.permittedNotInstalledConnections)
    ? event.details.permittedNotInstalledConnections
      .map(detailRecord)
      .filter((connection): connection is Record<string, unknown> => connection !== null)
    : [];
  const isRuntimeMcpDeliveryDiagnostic = reasonCode === "permitted_connections_not_installed";

  return (
    <li className="text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2.5 px-4 py-3 text-left hover:bg-accent/50"
      >
        {open ? (
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1">
          {lifecycle ? (
            <span className="block text-foreground">{lifecycle}</span>
          ) : isRuntimeMcpDeliveryDiagnostic ? (
            <span className="block text-foreground">
              <span className="font-medium">{who}</span>{t("pages2.toolsAudit.receivedNoMcp")}{" "}
              <span className="font-medium">{permittedNotInstalledCount ?? permittedNotInstalledConnections.length}</span>{" "}
              {t("pages2.toolsAudit.permittedNotInstalled", { count: permittedNotInstalledCount ?? permittedNotInstalledConnections.length })}
            </span>
          ) : (
            <span className="block text-foreground">
              <span className="font-medium">{who}</span> {t("pages2.toolsAudit.used")} <span className="font-medium">{action}</span>
              {app ? (
                <>
                  {" "}
                  {t("pages2.toolsAudit.inApp")} <span className="font-medium">{app}</span>
                </>
              ) : null}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2 whitespace-nowrap">
          {event.lifecycleType ? null : <OutcomeChip outcome={event.normalizedOutcome} />}
          <span className="text-xs text-muted-foreground">
            · <RelativeTime value={event.createdAt} />
          </span>
        </span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-border bg-muted/30 px-4 py-3 pl-10 text-sm">
          <p className="text-foreground">
            {plainReason(event)}
            {matchedRuleName ? (
              <>
                {" "}
                <span className="font-medium">{matchedRuleName}</span>
              </>
            ) : null}
          </p>

          <div className="flex flex-wrap gap-3 text-xs">
            {issueId ? (
              <Link to={`/issues/${issueId}`} className="text-primary hover:underline">
                {t("pages2.toolsAudit.viewTask")}
              </Link>
            ) : null}
            {runId && agentId ? (
              <Link to={`/agents/${agentId}/runs/${runId}`} className="text-primary hover:underline">
                {t("pages2.audit.viewRun")}
              </Link>
            ) : null}
          </div>

          <div>
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {detailsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {t("pages2.toolsAudit.details")}
            </button>
            {detailsOpen ? (
              <div className="mt-2 space-y-1.5 text-xs">
                {rawTool ? <DetailFact label={t("pages2.toolsAudit.actionName")} value={rawTool} mono /> : null}
                <DetailFact label={t("pages2.toolsAudit.reasonCode")} value={reasonCode} mono />
                <DetailFact label={t("pages2.toolsAudit.actorType")} value={event.actorType ?? "—"} />
                {runId ? <DetailFact label={t("pages2.toolsAudit.runId")} value={runId} mono /> : null}
                {transport ? <DetailFact label={t("pages2.toolsAudit.transport")} value={transport} mono /> : null}
                {requestMethod && endpoint ? <DetailFact label={t("pages2.toolsAudit.httpRequest")} value={`${requestMethod} ${endpoint}`} mono /> : null}
                {mcpMethod ? <DetailFact label={t("pages2.toolsAudit.mcpMethod")} value={mcpMethod} mono /> : null}
                {requestId ? <DetailFact label={t("pages2.toolsAudit.requestId")} value={requestId} mono /> : null}
                {request ? <DetailFact label={t("pages2.toolsAudit.dispatched")} value={request.dispatched === true ? t("pages2.toolsAudit.yes") : t("pages2.toolsAudit.no")} /> : null}
                {httpStatus !== undefined ? <DetailFact label={t("pages2.toolsAudit.httpStatus")} value={String(httpStatus)} mono /> : null}
                {contentType ? <DetailFact label={t("pages2.toolsAudit.contentType")} value={contentType} mono /> : null}
                {responseBytes !== undefined ? <DetailFact label={t("pages2.toolsAudit.responseSize")} value={t("pages2.toolsAudit.byteSize", { count: responseBytes })} /> : null}
                {upstreamRequestId ? <DetailFact label={t("pages2.toolsAudit.upstreamId")} value={upstreamRequestId} mono /> : null}
                {isRuntimeMcpDeliveryDiagnostic ? (
                  <>
                    <DetailFact label={t("pages2.toolsAudit.deliveredMcp")} value="0" mono />
                    {permittedNotInstalledConnections.map((connection) => {
                      const connectionId = detailString(connection, "id");
                      const connectionName = detailString(connection, "name") ?? t("pages2.toolsAudit.unnamedConnection");
                      return connectionId ? (
                        <div key={connectionId} className="flex gap-2">
                          <span className="shrink-0 text-muted-foreground">{t("pages2.toolsAudit.notInstalled")}</span>
                          <Link to={`/apps/${connectionId}/permissions`} className="font-medium text-primary hover:underline">
                            {connectionName}
                          </Link>
                        </div>
                      ) : null;
                    })}
                  </>
                ) : null}
                {argumentsText ? (
                  <div className="space-y-1">
                    <span className="text-muted-foreground">{t("pages2.toolsAudit.parametersRedacted")}</span>
                    <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-background p-3 font-mono text-xs text-foreground">
                      {argumentsText}
                    </pre>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function AuditTab({ companyId }: { companyId: string }) {
  const { t } = useTranslation();
  const [app, setApp] = useState<string>(ALL);
  const [agent, setAgent] = useState<string>(ALL);
  const [outcome, setOutcome] = useState<string>(ALL);
  const [windowKey, setWindowKey] = useState<ToolAuditWindow>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Debounce the search box so each keystroke doesn't fire a server request.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const apps = useQuery({
    queryKey: queryKeys.tools.applications(companyId),
    queryFn: () => toolsApi.listApplications(companyId),
  });
  const agents = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
  });
  // Map matched rule IDs to their humanized names for the row "why" link.
  const policies = useQuery({
    queryKey: queryKeys.tools.policies(companyId),
    queryFn: () => toolsApi.listPolicies(companyId),
  });
  const ruleNamesById = useMemo(
    () => new Map((policies.data?.policies ?? []).map((p) => [p.id, p.name])),
    [policies.data],
  );

  const filters = {
    app: app === ALL ? undefined : app,
    agent: agent === ALL ? undefined : agent,
    outcome: outcome === ALL ? undefined : outcome,
    window: windowKey,
    search: search || undefined,
  };
  const hasActiveFilters =
    app !== ALL || agent !== ALL || outcome !== ALL || windowKey !== "all" || search.length > 0;

  const activity = useInfiniteQuery({
    queryKey: queryKeys.tools.activity(companyId, {
      app: filters.app,
      agent: filters.agent,
      outcome: filters.outcome,
      window: filters.window,
      search: filters.search,
    }),
    queryFn: ({ pageParam }) =>
      toolsApi.listActivity(companyId, { ...filters, limit: PAGE_SIZE, cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const events = useMemo(
    () => activity.data?.pages.flatMap((page) => page.events) ?? [],
    [activity.data],
  );

  const clearFilters = () => {
    setApp(ALL);
    setAgent(ALL);
    setOutcome(ALL);
    setWindowKey("all");
    setSearchInput("");
    setSearch("");
  };

  return (
    <div className="space-y-4">
      <ToolsPageHeader
        title={t("pages2.toolsAudit.title")}
        description={t("pages2.toolsAudit.description")}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={app} onValueChange={setApp}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("pages2.toolsAudit.app")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("pages2.toolsAudit.allApps")}</SelectItem>
            {(apps.data?.applications ?? []).map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <AgentSelect
          agents={[{ id: ALL, name: t("pages2.audit.allAgents") }, ...(agents.data ?? [])]}
          value={agent}
          onChange={setAgent}
          triggerClassName="w-40"
        />
        <Select value={outcome} onValueChange={setOutcome}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OUTCOME_FILTERS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {t(o.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={windowKey} onValueChange={(v) => setWindowKey(v as ToolAuditWindow)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WINDOW_FILTERS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {t(o.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder={t("pages2.toolsAudit.searchPlaceholder")}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-xs"
        />
        {hasActiveFilters ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            {t("pages2.audit.clearFilters")}
          </Button>
        ) : null}
      </div>

      {activity.isLoading ? (
        <LoadingState />
      ) : activity.error ? (
        <ErrorState error={activity.error} onRetry={() => activity.refetch()} />
      ) : events.length === 0 ? (
        hasActiveFilters ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
              <ScrollText className="h-10 w-10 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium text-foreground">{t("pages2.toolsAudit.noMatch")}</p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  {t("pages2.toolsAudit.tryWider")}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={clearFilters}>
                {t("pages2.audit.clearFilters")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
              <ScrollText className="h-10 w-10 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium text-foreground">{t("pages2.audit.nothingYet")}</p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  {t("pages2.toolsAudit.emptyHint")}
                </p>
              </div>
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            <ul className="divide-y divide-border">
              {events.map((event) => (
                <ActivityRow key={event.id} event={event} ruleNamesById={ruleNamesById} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {activity.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => activity.fetchNextPage()}
            disabled={activity.isFetchingNextPage}
          >
            {activity.isFetchingNextPage ? t("pages2.common.loading") : t("pages2.common.loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
