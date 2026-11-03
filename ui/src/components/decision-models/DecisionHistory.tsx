import { useQuery } from "@tanstack/react-query";
import type { DecisionHistoryEntry } from "@paperclipai/shared";
import { decisionModelsApi } from "@/api/decision-models";
import { useTranslation } from "@/i18n";
import { Link } from "@/lib/router";
import { formatDateTime, formatTokens, formatDetailedCents } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function DecisionHistoryTable({ entries, fastResponse = false, fastResponsesEnabled = true }: { entries: (DecisionHistoryEntry & { publicationStatus?: string; connectionName?: string | null })[]; fastResponse?: boolean; fastResponsesEnabled?: boolean }) {
  const { t } = useTranslation();
  if (!entries.length) return <p className="text-sm text-muted-foreground">{fastResponse ? t("comps1.decisionHistory.emptyFast") : t("comps1.decisionHistory.empty")} <Link to={fastResponse && !fastResponsesEnabled ? "/company/settings/instance/experimental" : "/company/settings/connections"} className="underline underline-offset-4">{fastResponse ? fastResponsesEnabled ? t("comps1.decisionHistory.configureFast") : t("comps1.decisionHistory.enableFast") : t("comps1.decisionHistory.configureModel")}</Link>{t("comps1.decisionHistory.runTestSuffix")}</p>;
  return <div className="space-y-3">
    <p className="text-xs text-muted-foreground">{t("comps1.decisionHistory.recentNote")}</p>
    <div className="overflow-x-auto"><table className="w-full text-sm" aria-label={fastResponse ? t("comps1.decisionHistory.tableAriaFast") : t("comps1.decisionHistory.tableAria")}>
      <thead><tr className="border-b border-border text-muted-foreground">{[t("comps1.decisionHistory.colWhen"), t("comps1.decisionHistory.colResponsible"), t("comps1.decisionHistory.colTask"), ...(fastResponse ? [t("comps1.decisionHistory.colConnection")] : []), t("comps1.decisionHistory.colModel"), t("comps1.decisionHistory.colStatus"), t("comps1.decisionHistory.colDuration"), t("comps1.decisionHistory.colTokens"), t("comps1.decisionHistory.colCost")].map(label => <th key={label} className="px-3 py-2 text-left font-medium">{label}</th>)}</tr></thead>
      <tbody>{entries.map(row => <tr key={row.id} className="border-b border-border last:border-0">
        <td className="px-3 py-3"><div className="whitespace-nowrap">{formatDateTime(row.startedAt)}</div><div className="text-xs text-muted-foreground">{row.feature === "settings.test" ? t("comps1.decisionHistory.setupTest") : row.feature}</div></td>
        <td className="px-3 py-3">{row.actorType === "system" ? t("comps1.decisionHistory.paperclipServices") : row.userName ?? (row.responsibleUserId === "local-board" ? t("comps1.decisionHistory.board") : t("comps1.decisionHistory.formerUser"))}</td>
        <td className="px-3 py-3">{row.issueId ? <Link className="underline underline-offset-4" to={`/issues/${row.issueIdentifier ?? row.issueId}`}>{row.issueIdentifier ?? t("comps1.decisionHistory.viewTask")}</Link> : "—"}</td>
        {fastResponse && <td className="px-3 py-3">{row.connectionName ?? (row.connectionId ? t("comps1.decisionHistory.removedConnection") : "—")}</td>}
        <td className="px-3 py-3 font-mono text-xs">{row.model}</td>
        <td className="px-3 py-3"><div>{row.status === "succeeded" ? t("comps1.decisionHistory.statusSucceeded") : row.status === "running" ? t("comps1.decisionHistory.statusRunning") : row.status === "unknown" ? t("comps1.decisionHistory.statusUnresolved") : row.status === "skipped" ? t("comps1.decisionHistory.statusSkipped") : row.status === "pending" ? t("comps1.decisionHistory.statusPending") : t("comps1.decisionHistory.statusFailed")}</div>{row.publicationStatus && <div className="text-xs text-muted-foreground">{row.publicationStatus}</div>}{row.errorCode && <div className="text-xs text-muted-foreground">{row.errorCode.replaceAll("_", " ")}</div>}</td>
        <td className="px-3 py-3 font-mono">{row.durationMs === null ? "—" : `${(row.durationMs / 1000).toFixed(1)}s`}</td>
        <td className="whitespace-nowrap px-3 py-3 font-mono">{row.inputTokens === null ? "—" : formatTokens(row.inputTokens)} / {row.outputTokens === null ? "—" : formatTokens(row.outputTokens)}</td>
        <td className="px-3 py-3 font-mono"><div>{row.costCents === null ? t("comps1.decisionHistory.costUnknown") : formatDetailedCents(row.costCents)}</div>{row.costStatus !== "unpriced" && row.costStatus && <span className="text-xs text-muted-foreground">{row.costStatus === "estimated" ? t("comps1.decisionHistory.estimated") : t("comps1.decisionHistory.reported")}</span>}</td>
      </tr>)}</tbody>
    </table></div>
  </div>;
}
export function DecisionHistory({ companyId, from, to }: { companyId: string; from?: string | null; to?: string | null }) {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ["decision-history", companyId, from, to], queryFn: () => decisionModelsApi.history(companyId, from, to), refetchInterval: q => q.state.data?.some(row => row.status === "running") ? 5000 : false });
  if (query.isPending) return <p className="text-sm text-muted-foreground">{t("comps1.decisionHistory.loading")}</p>;
  if (query.error) return <div role="alert" className="space-y-2"><p className="text-sm text-destructive">{t("comps1.decisionHistory.loadFailed")}</p><Button variant="outline" onClick={() => void query.refetch()}>{t("comps1.decisionHistory.tryAgain")}</Button></div>;
  return <DecisionHistoryTable entries={query.data ?? []} />;
}
