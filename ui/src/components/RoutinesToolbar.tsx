import { ArrowUpDown, Check, Layers, Plus } from "lucide-react";
import { Link } from "@/lib/router";
import { useTranslation } from "@/i18n";
import { ToolbarSearch } from "./ToolbarSearch";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export type RoutineGroupBy = "folder" | "none" | "project" | "assignee";
export type RoutineSortField = "updated" | "created" | "title" | "lastRun";
export type RoutineSortDir = "asc" | "desc";

export function RoutinesToolbar({ query, onQueryChange, sortField, sortDir, groupBy, onSortChange, onGroupChange, onNewFolder, onCreateRoutine, tasksHref, selectMode, onToggleSelect }: {
  query: string;
  onQueryChange: (value: string) => void;
  sortField: RoutineSortField;
  sortDir: RoutineSortDir;
  groupBy: RoutineGroupBy;
  onSortChange: (field: RoutineSortField, direction: RoutineSortDir) => void;
  onGroupChange: (value: RoutineGroupBy) => void;
  onNewFolder?: () => void;
  onCreateRoutine: () => void;
  tasksHref?: string;
  selectMode?: boolean;
  onToggleSelect?: () => void;
}) {
  const { t } = useTranslation();
  const sortLabels: Record<RoutineSortField, string> = {
    updated: t("comps1.routinesToolbar.sortUpdated"),
    created: t("comps1.routinesToolbar.sortCreated"),
    lastRun: t("comps1.routinesToolbar.sortLastRun"),
    title: t("comps1.routinesToolbar.sortTitle"),
  };
  const groupLabels: Record<RoutineGroupBy, string> = {
    folder: t("routines.group.folder"),
    project: t("routines.composer.project"),
    assignee: t("comps1.routinesToolbar.groupAgent"),
    none: t("comps1.routinesToolbar.groupNone"),
  };
  return <div data-canonical-toolbar="routines" role="toolbar" aria-label={t("comps1.routinesToolbar.ariaLabel")} className="flex flex-wrap items-center gap-4">
    <ToolbarSearch query={query} onQueryChange={onQueryChange} label={t("comps1.routinesToolbar.searchLabel")} placeholder={t("comps1.routinesToolbar.searchPlaceholder")} />
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" title={t("comps1.routinesToolbar.sort")}>
          <ArrowUpDown className="h-3.5 w-3.5 sm:h-3 sm:w-3 sm:mr-1" />
          <span >{t("comps1.routinesToolbar.sort")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-0">
        <div className="p-2 space-y-0.5">
          {([
            ["updated", sortLabels.updated],
            ["created", sortLabels.created],
            ["lastRun", sortLabels.lastRun],
            ["title", sortLabels.title],
          ] as const).map(([field, label]) => (
            <button
                type="button"
              key={field}
              className={`flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm ${
                sortField === field
                  ? "bg-accent/50 text-foreground"
                  : "text-muted-foreground hover:bg-accent/50"
              }`}
              onClick={() => {
                onSortChange(field, sortField === field
                  ? (sortDir === "asc" ? "desc" : "asc")
                  : (field === "title" ? "asc" : "desc"));
              }}
            >
              <span>{label}</span>
              {sortField === field ? (
                <span className="text-xs text-muted-foreground">
                  {sortDir === "asc" ? t("comps1.routinesToolbar.asc") : t("comps1.routinesToolbar.desc")}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" title={t("comps1.routinesToolbar.group")}>
          <Layers className="h-3.5 w-3.5 sm:h-3 sm:w-3 sm:mr-1" />
          <span >{t("comps1.routinesToolbar.group")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-0">
        <div className="p-2 space-y-0.5">
          {([
            ["folder", groupLabels.folder],
            ["project", groupLabels.project],
            ["assignee", groupLabels.assignee],
            ["none", groupLabels.none],
          ] as const).map(([value, label]) => (
            <button
                type="button"
              key={value}
              className={`flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm ${
                groupBy === value
                  ? "bg-accent/50 text-foreground"
                  : "text-muted-foreground hover:bg-accent/50"
              }`}
              onClick={() => onGroupChange(value)}
            >
              <span>{label}</span>
              {groupBy === value ? <Check className="h-3.5 w-3.5" /> : null}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
    <div className="design-toolbar-actions">
      {onToggleSelect && <Button variant="outline" size="sm" onClick={onToggleSelect}>{selectMode ? t("comps1.routinesToolbar.done") : t("comps1.routinesToolbar.select")}</Button>}
      {tasksHref && <Button variant="outline" size="sm" asChild><Link data-toolbar-control to={tasksHref}>{t("comps1.routinesToolbar.viewAllTasks")}</Link></Button>}
      {onNewFolder && <Button variant="outline" size="sm" onClick={onNewFolder}><Plus className="h-4 w-4" />{t("comps1.routinesToolbar.newFolder")}</Button>}
      <Button variant="outline" size="sm" data-toolbar-primary onClick={onCreateRoutine}><Plus className="h-4 w-4" />{t("routines.createRoutine")}</Button>
    </div>
  </div>;
}
