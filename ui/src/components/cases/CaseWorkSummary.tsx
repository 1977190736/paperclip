import { Clock3 } from "lucide-react";
import type { CaseDetail, CaseHandoffView } from "@/api/cases";
import { AgentIdentity } from "@/components/AgentIdentity";
import type { AvatarAgent } from "@/components/AgentAvatar";
import { IssueReferencePill } from "@/components/IssueReferencePill";
import { IssueStatusBadge } from "@/components/StatusBadge";
import { PropertyRow } from "@/components/issue-properties/primitives";
import { useTranslation } from "@/i18n";

export type CaseAgentMap = ReadonlyMap<string, AvatarAgent & { status?: string }>;

export function CaseWorkSummary({ caseData, pendingHandoff, agents }: {
  caseData: CaseDetail;
  pendingHandoff?: CaseHandoffView | null;
  agents?: CaseAgentMap;
}) {
  const { t } = useTranslation();
  const task = caseData.workIssue;
  const pending = pendingHandoff === undefined ? caseData.pendingHandoff : pendingHandoff;
  const assignee = task?.assigneeAgentId ? agents?.get(task.assigneeAgentId) ?? {
    id: task.assigneeAgentId,
    name: task.assigneeAgentName ?? t("tail1.workSummary.agent"),
  } : null;
  const from = pending?.fromAgentId ? agents?.get(pending.fromAgentId)?.name ?? pending.fromAgentName ?? t("tail1.workSummary.fallbackPrevAgent") : t("tail1.workSummary.fallbackPrevAgent");
  const to = pending ? (pending.toAgentId ? agents?.get(pending.toAgentId)?.name : null) ?? pending.toAgentName ?? t("tail1.workSummary.fallbackNextAgent") : null;
  const destination = pending?.toAgentId ? agents?.get(pending.toAgentId) : null;
  const waiting = pending?.destinationKind === "done" ? t("tail1.workSummary.willCloseWhenDone") : pending?.lastError
    ?? (pending?.state === "awaiting_release" ? t("tail1.workSummary.waitingFinish", { agent: from })
      : destination?.status === "paused" ? t("tail1.workSummary.agentPaused", { agent: to }) : t("tail1.workSummary.waitingStart", { agent: to }));

  return <section className="space-y-3" aria-label={t("tail1.workSummary.sectionAria")}>
    <h2 className="text-sm font-semibold">{t("tail1.workSummary.title")}</h2>
    {caseData.workIssueId ? <div className="space-y-3">
      {task ? <div>
        <PropertyRow label={t("tail1.workSummary.task")}><IssueReferencePill issue={task} className="min-h-11 md:min-h-0" /></PropertyRow>
        <PropertyRow label={t("tail1.workSummary.workflow")}><span className="text-sm">{caseData.workflow?.name ?? t("tail1.workSummary.caseInstructions")}</span></PropertyRow>
        {caseData.phase && <PropertyRow label={t("tail1.workSummary.phase")}><span className="text-sm">{caseData.phase}</span></PropertyRow>}
        <PropertyRow label={t("tail1.workSummary.agent")}>{assignee ? <AgentIdentity agent={assignee} size="xs" /> : <span className="text-sm text-muted-foreground">{t("tail1.workSummary.unassigned")}</span>}</PropertyRow>
        <PropertyRow label={t("tail1.workSummary.taskStatus")}><IssueStatusBadge status={task.status} /></PropertyRow>
      </div> : <p className="text-sm text-muted-foreground">{t("tail1.workSummary.taskUnavailable")}</p>}
      {pending && pending.state !== "delivered" && pending.state !== "completed" && pending.state !== "cancelled" && <div className="flex items-start gap-2 text-sm">
        <Clock3 aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 space-y-1">
          {pending.state === "awaiting_release" && <p>{t("tail1.workSummary.nextLine", { name: pending.workflowTransition?.to.name ?? t("tail1.workSummary.caseInstructions"), phase: pending.phase })}</p>}
          <p className="text-xs leading-relaxed text-muted-foreground">{waiting}</p>
        </div>
      </div>}
    </div> : <p className="text-sm text-muted-foreground">{t("tail1.workSummary.noTaskLinked")}</p>}
  </section>;
}
