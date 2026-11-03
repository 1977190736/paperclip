import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronRight } from "lucide-react";
import { casesApi, type CaseHandoffView, type CaseWorkIssue } from "@/api/cases";
import { AgentIdentity } from "@/components/AgentIdentity";
import { Identity } from "@/components/Identity";
import { MarkdownBody } from "@/components/MarkdownBody";
import { IssueReferencePill } from "@/components/IssueReferencePill";
import { Button } from "@/components/ui/button";
import { formatDateTime, relativeTime } from "@/lib/utils";
import { queryKeys } from "@/lib/queryKeys";
import type { CaseAgentMap } from "./CaseWorkSummary";
import { useTranslation } from "@/i18n";

function HandoffActor({ id, name, fallback, agents }: {
  id: string | null;
  name: string | null | undefined;
  fallback: string;
  agents?: CaseAgentMap;
}) {
  const { t } = useTranslation();
  return id ? <AgentIdentity agent={agents?.get(id) ?? { id, name: name ?? t("tail1.handoff.agent") }} size="xs" /> : <Identity name={name ?? fallback} size="xs" />;
}

export function CaseHandoffHistory({ caseId, task, agents }: { caseId: string; task?: CaseWorkIssue | null; agents?: CaseAgentMap }) {
  const { t } = useTranslation();
  const history = useInfiniteQuery({
    queryKey: queryKeys.cases.handoffs(caseId),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => casesApi.listHandoffs(caseId, pageParam),
    getNextPageParam: page => page.nextCursor ?? undefined,
  });
  const handoffs = history.data?.pages.flatMap(page => page.items) ?? [];
  return <section className="space-y-3" aria-label={t("tail1.handoff.sectionAria")}>
    <h2 className="text-sm font-semibold">{t("tail1.handoff.title")}</h2>
    {history.isLoading ? <p className="text-sm text-muted-foreground">{t("tail1.handoff.loading")}</p> : null}
    {history.isError ? <p role="alert" className="text-sm text-destructive">{t("tail1.handoff.loadFailed")}</p> : null}
    {!history.isLoading && !history.isError && handoffs.length === 0 ? <p className="text-sm text-muted-foreground">{t("tail1.handoff.empty")}</p> : null}
    <ol className="divide-y divide-border">{handoffs.map(handoff => <HandoffRow key={handoff.id} handoff={handoff} task={task} agents={agents} />)}</ol>
    {history.hasNextPage ? <Button variant="ghost" size="sm" disabled={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>{t("tail1.handoff.loadOlder")}</Button> : null}
  </section>;
}

function HandoffRow({ handoff, task, agents }: { handoff: CaseHandoffView; task?: CaseWorkIssue | null; agents?: CaseAgentMap }) {
  const { t } = useTranslation();
  const createdAt = new Date(handoff.createdAt).toISOString();
  const terminal = handoff.destinationKind === "done";
  const settled = handoff.state === "delivered" || handoff.state === "completed";
  const stateLabel = handoff.state === "cancelled" ? (handoff.assignmentAppliedAt ? t("tail1.handoff.appliedDeliveryCancelled") : t("tail1.handoff.cancelledBeforeTransfer")) : settled ? null
    : terminal ? t("tail1.handoff.waitingTaskCompletion") : handoff.assignmentAppliedAt ? t("tail1.handoff.appliedWaitingDelivery") : t("tail1.handoff.pendingTransfer");
  const handoffTask = task?.id === handoff.issueId ? task : null;
  return <li>
    <details className="group">
      <summary className="flex cursor-pointer list-none items-start gap-2 rounded-sm py-3 marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronRight aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-(--motion-duration-fast) group-open:rotate-90 motion-reduce:transition-none" />
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-medium">{terminal ? t("tail1.handoff.done") : handoff.phase}{stateLabel && <span className="ml-2 text-xs font-normal text-muted-foreground">{stateLabel}</span>}</span>
            <span className="flex items-center gap-3">
              {handoffTask && <IssueReferencePill issue={handoffTask} variant="property" />}
              <time dateTime={createdAt} title={formatDateTime(createdAt)} className="font-mono text-xs text-muted-foreground">{relativeTime(createdAt)}</time>
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-2 text-muted-foreground">
            <HandoffActor id={handoff.fromAgentId} name={handoff.fromAgentName} fallback={handoff.actorType === "user" ? t("tail1.handoff.user") : t("tail1.handoff.system")} agents={agents} />
            <ArrowRight aria-hidden className="size-3" />
            {terminal ? <span className="text-xs">{t("tail1.handoff.done")}</span>
              : <HandoffActor id={handoff.toAgentId} name={handoff.toAgentName} fallback={t("tail1.handoff.agent")} agents={agents} />}
          </span>
        </span>
      </summary>
      <div className="space-y-2 pb-4 pl-6">
        {handoff.workflowTransition && <p className="text-xs text-muted-foreground">
          {handoff.workflowTransition.from.name ?? t("tail1.handoff.caseInstructions")}{handoff.workflowTransition.from.phase ? ` · ${handoff.workflowTransition.from.phase}` : ""}
          {" → "}{handoff.workflowTransition.to.name ?? t("tail1.handoff.caseInstructions")} · {handoff.workflowTransition.to.phase}
        </p>}
        {handoff.lastError && !settled && handoff.state !== "cancelled" ? <p className="text-xs text-muted-foreground">{handoff.lastError}</p> : null}
        <MarkdownBody linkIssueReferences linkCaseReferences>{handoff.instructions}</MarkdownBody>
      </div>
    </details>
  </li>;
}
