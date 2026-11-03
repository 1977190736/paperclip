import type { ComponentProps, Ref } from "react";
import { ChevronDown, CirclePlus, Columns3, List, ListTree } from "lucide-react";
import { IssueFiltersPopover } from "./IssueFiltersPopover";
import { Button } from "./ui/button";
import { ToolbarSearch } from "./ToolbarSearch";
import { FlyoutHeader, FlyoutOptions } from "./ui/flyout";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { taskListViews as views, type TaskListView } from "@/lib/task-list-views";
import { useTranslation } from "@/i18n";

/** Canonical proposed task toolbar; review under Components / Toolbars / Tasks. */
export function TaskListToolbar({ view, onViewChange, viewOptions = views, query, onQueryChange, searchRef, layout, onLayoutChange, allExpanded, onToggleExpanded, onNewTask, filters }: {
  view: TaskListView;
  onViewChange: (view: TaskListView) => void;
  viewOptions?: readonly { value: TaskListView; label: string }[];
  query: string;
  onQueryChange: (query: string) => void;
  searchRef?: Ref<HTMLInputElement>;
  layout: "list" | "board";
  onLayoutChange: (layout: "list" | "board") => void;
  allExpanded: boolean;
  onToggleExpanded: () => void;
  onNewTask: () => void;
  filters: ComponentProps<typeof IssueFiltersPopover>;
}) {
  const { t } = useTranslation();
  return (
    <div data-canonical-toolbar="tasks" className="design-page-toolbar" role="toolbar" aria-label={t("comps3.taskListToolbar.ariaLabel")}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline" className="design-toolbar-button design-view-trigger" aria-label={t("comps3.taskListToolbar.viewAria", { label: viewOptions.find(option => option.value === view)!.label })}>{viewOptions.find(option => option.value === view)!.label}<ChevronDown aria-hidden /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="task-list-options" aria-label={t("comps3.taskListToolbar.viewsAria")}>
          <DropdownMenuLabel asChild><FlyoutHeader className="task-list-options-heading">{t("comps3.taskListToolbar.views")}</FlyoutHeader></DropdownMenuLabel>
          <DropdownMenuRadioGroup asChild value={view} onValueChange={value => onViewChange(value as TaskListView)}><FlyoutOptions className="task-list-options-items">
            {viewOptions.map(option => <DropdownMenuRadioItem className="task-list-options-item" key={option.value} value={option.value}>{option.label}</DropdownMenuRadioItem>)}
          </FlyoutOptions></DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolbarSearch query={query} onQueryChange={onQueryChange} inputRef={searchRef} label={t("connections.workPanels.searchTasks")} placeholder={t("comps2.coordinator.searchTasksPlaceholder")} />
      <div className="design-view-toggle" role="group" aria-label={t("comps3.taskListToolbar.layoutAria")}>
        {[{ value: "list", label: t("comps3.taskListToolbar.listView"), icon: List }, { value: "board", label: t("comps3.taskListToolbar.boardView"), icon: Columns3 }].map(({ value, label, icon: Icon }) => (
          <Tooltip key={value}><TooltipTrigger asChild><Button variant="ghost" className="design-toolbar-button design-toolbar-icon" aria-label={label} aria-pressed={layout === value} onClick={() => onLayoutChange(value as "list" | "board")}><Icon aria-hidden /></Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>
        ))}
      </div>
      <div className="design-toolbar-actions">
        <Tooltip><TooltipTrigger asChild><Button variant="outline" className="design-toolbar-button design-toolbar-icon" disabled={layout !== "list"} aria-label={allExpanded ? t("comps3.taskListToolbar.collapseAll") : t("comps3.taskListToolbar.expandAll")} onClick={onToggleExpanded}><ListTree aria-hidden /></Button></TooltipTrigger><TooltipContent>{allExpanded ? t("comps3.taskListToolbar.collapseAll") : t("comps3.taskListToolbar.expandAll")}</TooltipContent></Tooltip>
        <div className="design-toolbar-filter"><IssueFiltersPopover {...filters} presentation="refreshed" buttonVariant="outline" iconOnly enableExternalObjectFilters={false} /></div>
        <Button className="design-toolbar-button design-new-task" onClick={onNewTask}><CirclePlus aria-hidden />{t("comps3.taskListToolbar.newTask")}</Button>
      </div>
    </div>
  );
}
