import { useMemo, useState } from "react";
import { useCoordinatorChatTaskHandoffs } from "./CoordinatorChatTaskHandoffs";
import { CoordinatorCreatedTaskLink } from "./CoordinatorTaskCommitment";
import { ToolbarSearch } from "@/components/ToolbarSearch";
import { NativeSelect } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";

/** The task list is source-conversation scoped, independent of reassignment. */
export function CoordinatorConversationTasksPanel({ conversationIssueId }: { conversationIssueId: string }) {
  const { t } = useTranslation();
  const tasks = useCoordinatorChatTaskHandoffs(conversationIssueId);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return tasks.handoffs.filter(task => (!status || task.status === status) && (!needle || `${task.identifier ?? ""} ${task.title}`.toLocaleLowerCase().includes(needle)))
      .sort((a, b) => sort === "title" ? a.title.localeCompare(b.title) : (sort === "oldest" ? 1 : -1) * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
  }, [tasks.handoffs, query, status, sort]);
  return <section className="space-y-4" aria-label={t("comps2.coordinator.conversationTasksAria")}>
    <div className="space-y-1"><h2 className="text-lg font-medium">{t("agents.coordinatorSidebar.navTasks")}</h2><p className="text-sm text-muted-foreground">{t("comps2.coordinator.createdFromConversation")}</p></div>
    <ToolbarSearch query={query} onQueryChange={setQuery} label={t("comps2.coordinator.searchConversationTasks")} placeholder={t("comps2.coordinator.searchTasksIdsPlaceholder")} />
    <div className="flex flex-wrap gap-2">
      <NativeSelect value={status} onChange={event => setStatus(event.target.value)} aria-label={t("comps2.coordinator.filterConversationStatusAria")} className="w-auto"><option value="">{t("comps2.coordinator.allStatuses")}</option><option value="todo">{t("comps2.coordinator.status.readyToStart")}</option><option value="in_progress">{t("comps2.coordinator.status.inProgress")}</option><option value="in_review">{t("comps2.coordinator.status.needsReview")}</option><option value="blocked">{t("comps2.coordinator.status.blocked")}</option><option value="done">{t("comps2.coordinator.status.done")}</option><option value="cancelled">{t("comps2.coordinator.outcome.cancelled")}</option></NativeSelect>
      <NativeSelect value={sort} onChange={event => setSort(event.target.value)} aria-label={t("comps2.coordinator.sortConversationAria")} className="w-auto"><option value="newest">{t("comps2.coordinator.newestFirst")}</option><option value="oldest">{t("comps2.coordinator.oldestFirst")}</option><option value="title">{t("comps2.coordinator.titleSort")}</option></NativeSelect>
    </div>
    {tasks.isPending && <p role="status" className="text-sm text-muted-foreground">{t("agents.coordinatorSidebar.loadingTasks")}</p>}
    {tasks.isError && <div role="alert" className="space-y-2"><p className="text-sm">{t("comps2.coordinator.tasksLoadError")}</p><Button variant="outline" onClick={() => void tasks.refetch()}>{t("agentConfig.common.retry")}</Button></div>}
    <div className="space-y-3">{visible.map(task => <div key={task.id} className="overflow-hidden rounded-xl border border-border bg-card"><CoordinatorCreatedTaskLink task={task} /></div>)}</div>
    {!tasks.isPending && !tasks.isError && !visible.length && <p className="py-4 text-sm text-muted-foreground">{query || status ? t("comps2.coordinator.noLoadedTasksMatch") : t("comps2.coordinator.conversationTasksEmpty")}</p>}
    {tasks.hasNextPage && <Button variant="outline" disabled={tasks.isFetchingNextPage} onClick={() => void tasks.fetchNextPage()}>{tasks.isFetchingNextPage ? t("comps2.coordinator.loading") : t("comps2.coordinator.loadMoreTasks")}</Button>}
  </section>;
}
