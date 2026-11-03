import { useQuery } from "@tanstack/react-query";
import type { Agent } from "@paperclipai/shared";
import { decisionsApi } from "@/api/decisions";
import { useTranslation } from "@/i18n";
import { useLocation } from "@/lib/router";
import { queryKeys } from "@/lib/queryKeys";
import { taskChatHashAnchor } from "./task-chat/scroll-navigation";
import { DecisionResolver } from "./DecisionResolver";
import { Button } from "./ui/button";

/** A selected Decisions-v1 record belongs to its task, not a second history tab. */
export function TaskDecisionRecord({ companyId, issueId, viewerId, agentMap }: {
  companyId: string; issueId: string; viewerId: string | null; agentMap?: Map<string, Agent>;
}) {
  const { t } = useTranslation();
  const { hash } = useLocation();
  const anchor = taskChatHashAnchor(hash);
  const decisionId = anchor?.startsWith("decision-") ? anchor.slice("decision-".length) : null;
  const record = useQuery({
    queryKey: queryKeys.decisions.taskRecord(companyId, issueId, viewerId, decisionId),
    queryFn: () => decisionsApi.get(decisionId!), enabled: !!decisionId, retry: false,
  });
  if (!decisionId) return null;
  const decision = record.data;
  const matchesTask = decision?.companyId === companyId && decision.originIssueId === issueId;
  const choice = decision?.options.find((option) => option.id === decision.chosenOptionId);
  return <section id={anchor!} aria-label={t("comps1.taskDecision.ariaLabel")} className="space-y-3 rounded-xl border border-border bg-card p-4">
    <h2 className="text-sm font-medium">{t("comps1.taskDecision.title")}</h2>
    {record.isPending ? <p role="status" className="text-sm text-muted-foreground">{t("comps1.taskDecision.loading")}</p> : record.isError ? (
      <div role="alert" className="text-sm"><p>{t("comps1.taskDecision.loadFailed")}</p><Button size="sm" variant="ghost" onClick={() => void record.refetch()}>{t("comps1.taskDecision.retry")}</Button></div>
    ) : !matchesTask ? <p role="alert" className="text-sm text-muted-foreground">{t("comps1.taskDecision.notAvailable")}</p> : <>
      {decision.status !== "open" ? <dl className="space-y-2 text-sm">
        <div><dt className="text-muted-foreground">{t("comps1.taskDecision.recordedChoice")}</dt><dd>{choice?.label ?? (decision.chosenOptionId === "dismissed" ? t("comps1.taskDecision.dismissed") : decision.status)}</dd></div>
        {(decision.inputs ?? []).filter((input) => decision.inputValues?.[input.id] !== undefined).map((input) => <div key={input.id}>
          <dt className="text-muted-foreground">{input.label}</dt><dd className="whitespace-pre-wrap">{decision.inputValues![input.id]}</dd>
        </div>)}
      </dl> : null}
      <DecisionResolver companyId={companyId} decisionId={decisionId} agentMap={agentMap} initialDecision={decision}
        recordedDecision={decision.status === "open" ? undefined : decision} onResolved={() => { void record.refetch(); }} />
    </>}
  </section>;
}
