import { useMemo, type CSSProperties } from "react";
import { Folder, GitBranch, GitBranchPlus, Monitor } from "lucide-react";
import type { ExecutionWorkspaceSummary } from "@paperclipai/shared";
import { SearchableSelect, type SearchableSelectOption } from "@/components/SearchableSelect";
import { orderReusableExecutionWorkspaces } from "@/lib/reusable-execution-workspaces";
import { useTranslation } from "@/i18n";

interface WorktreeOption extends SearchableSelectOption {
  mode: string;
  workspaceId?: string;
  description: string;
}

interface ComposerWorktreePickerProps {
  mode: string;
  workspaceId: string;
  workspaces: readonly ExecutionWorkspaceSummary[];
  onChange: (mode: string, workspaceId: string) => void;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  disabled?: boolean;
  mobile?: boolean;
  contentStyle?: CSSProperties;
  selectedWorkspaceLabel?: string;
}

const MODE_OPTION_DEFS = [
  { key: "isolated_workspace", value: "isolated_workspace", mode: "isolated_workspace", labelKey: "taskChat.worktree.new.label", descriptionKey: "taskChat.worktree.new.description" },
  { key: "shared_workspace", value: "shared_workspace", mode: "shared_workspace", labelKey: "taskChat.worktree.shared.label", descriptionKey: "taskChat.worktree.shared.description" },
  { key: "operator_branch", value: "operator_branch", mode: "operator_branch", labelKey: "taskChat.worktree.branch.label", descriptionKey: "taskChat.worktree.branch.description" },
  { key: "agent_default", value: "agent_default", mode: "agent_default", labelKey: "taskChat.worktree.agentDefault.label", descriptionKey: "taskChat.worktree.agentDefault.description" },
  { key: "inherit", value: "inherit", mode: "inherit", labelKey: "taskChat.worktree.inherit.label", descriptionKey: "taskChat.worktree.inherit.description" },
] as const;

/** Reuses the searchable selector and the existing workspace recency ordering. */
export function ComposerWorktreePicker({
  mode, workspaceId, workspaces, onChange, loading, error, onRetry,
  disabled, mobile, contentStyle, selectedWorkspaceLabel,
}: ComposerWorktreePickerProps) {
  const { t } = useTranslation();
  const modeOptions = useMemo(
    () => MODE_OPTION_DEFS.map((def) => ({ ...def, label: t(def.labelKey), description: t(def.descriptionKey) })),
    [t],
  );
  const groups = useMemo(() => [
    { id: "new", options: [modeOptions[0]!] },
    {
      id: "reuse", label: t("taskChat.worktree.reuseGroup"),
      options: orderReusableExecutionWorkspaces(workspaces).map((workspace): WorktreeOption => ({
        key: `reuse:${workspace.id}`, value: `reuse:${workspace.id}`,
        workspaceId: workspace.id, mode: "reuse_existing", label: workspace.name,
        description: workspace.branchName ?? t("taskChat.worktree.existingWorkspace"),
        searchText: `${workspace.branchName ?? ""} ${workspace.id}`,
      })),
    },
    {
      id: "other", label: t("taskChat.worktree.otherGroup"),
      options: modeOptions.filter((option) => option.mode === "shared_workspace"
        || (option.mode !== "isolated_workspace" && option.mode === mode)),
    },
  ], [mode, workspaces, modeOptions, t]);

  const value = mode === "reuse_existing" ? `reuse:${workspaceId}` : mode;
  return (
    <SearchableSelect<string, WorktreeOption>
      value={value}
      groups={groups}
      onValueChange={(_, option) => onChange(option.mode, option.workspaceId ?? "")}
      placeholder={t("taskChat.worktree.title")}
      triggerAriaLabel={t("taskChat.worktree.title")}
      mobileTitle={t("taskChat.worktree.title")}
      searchPlaceholder={t("taskChat.worktree.searchPlaceholder")}
      emptyMessage={t("taskChat.worktree.emptyMessage")}
      disabled={disabled}
      modal={mobile}
      contentStyle={contentStyle}
      contentWidth="auto"
      className="min-w-0 flex-1 sm:flex-none sm:max-w-72"
      triggerClassName="h-8 gap-1.5 border-0 bg-transparent px-2 text-xs font-medium shadow-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-0"
      renderValue={(option) => (
        <span className="flex min-w-0 items-center gap-1.5">
          <GitBranch className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            <span className="hidden text-muted-foreground sm:inline">{t("taskChat.worktree.prefix")} </span>
            {option?.label ?? selectedWorkspaceLabel ?? t("taskChat.worktree.selectWorktree")}
          </span>
        </span>
      )}
      renderOption={(option) => {
        const Icon = option.workspaceId ? GitBranch : option.mode === "isolated_workspace" ? GitBranchPlus
          : option.mode === "agent_default" ? Monitor : option.mode === "operator_branch" ? GitBranch : Folder;
        return (
          <>
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{option.label}</span>
              <span className="truncate text-xs text-muted-foreground">{option.description}</span>
            </span>
          </>
        );
      }}
      listFooter={loading || error || workspaces.length === 0 ? (
        <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground" role="status">
          {loading ? t("taskChat.worktree.loading") : error ? (
            <span className="flex items-center justify-between gap-2">
              {t("taskChat.worktree.loadFailed")}
              <button type="button" className="rounded px-2 py-1 text-foreground hover:bg-accent" onClick={onRetry}>{t("taskChat.common.retry")}</button>
            </span>
          ) : t("taskChat.worktree.emptyFooter")}
        </div>
      ) : undefined}
    />
  );
}
