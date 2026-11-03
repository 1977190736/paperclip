import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, LoaderCircle, Save } from "lucide-react";
import type { InboxAgentPolicy, InboxAgentPolicyMode } from "@paperclipai/shared";
import { agentsApi } from "@/api/agents";
import { inboxAgentPolicyApi } from "@/api/inbox-agent-policy";
import { queryKeys } from "@/lib/queryKeys";
import { isAgentTaskTarget } from "@/lib/company-members";
import { AgentMultiSelect } from "@/components/AgentMultiSelect";
import { Button } from "@/components/ui/button";
import { RadioCardGroup, type RadioCardOption } from "@/components/ui/radio-card";
import { useTranslation } from "@/i18n";

function modeOptions(t: (key: string) => string): RadioCardOption[] {
  return [
    {
      value: "open",
      title: t("comps3.inboxPolicy.anyAgents"),
      description: t("comps3.inboxPolicy.anyAgentsDesc"),
    },
    {
      value: "allowlist",
      title: t("comps3.inboxPolicy.chosenAgents"),
      description: t("comps3.inboxPolicy.chosenAgentsDesc"),
    },
    {
      value: "disabled",
      title: t("comps3.inboxPolicy.off"),
      description: t("comps3.inboxPolicy.offDesc"),
    },
  ];
}

function policyKey(mode: InboxAgentPolicyMode, allowedAgentIds: string[]): string {
  return `${mode}:${[...allowedAgentIds].sort().join(",")}`;
}

interface Draft {
  mode: InboxAgentPolicyMode;
  allowedAgentIds: string[];
}

/**
 * "Let agents tidy my inbox" user-settings control. A single
 * three-state policy — `open` / `allowlist` / `disabled` — round-tripped through
 * the per-user endpoints. When `allowlist` is selected the user picks which
 * of their agents may archive. The one-click Undo/Unarchive affordance and the
 * "Archived by …" attribution live elsewhere (inbox rows / properties pane).
 */
export function InboxAgentPolicyControl({ companyId }: { companyId: string | null | undefined }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const lastServerKeyRef = useRef<string | null>(null);

  const policyQuery = useQuery({
    queryKey: companyId ? queryKeys.inboxAgentPolicy.mine(companyId) : ["inbox-agent-policy", "none"],
    queryFn: () => inboxAgentPolicyApi.getMine(companyId!),
    enabled: !!companyId,
  });
  const policy = policyQuery.data;

  const agentsQuery = useQuery({
    queryKey: companyId ? queryKeys.agents.list(companyId) : ["agents", "none"],
    queryFn: () => agentsApi.list(companyId!),
    enabled: !!companyId,
  });
  const selectableAgents = useMemo(
    () => (agentsQuery.data ?? []).filter(isAgentTaskTarget),
    [agentsQuery.data],
  );
  const agentOptions = useMemo(
    () => selectableAgents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      title: agent.title ?? agent.role,
      icon: agent.icon,
    })),
    [selectableAgents],
  );
  const selectedAgentIds = useMemo(
    () => new Set(draft?.allowedAgentIds ?? []),
    [draft?.allowedAgentIds],
  );

  // Adopt server state on first load, or on refetch when the user has not
  // diverged from the previously-synced snapshot (so a background refetch never
  // clobbers pending edits).
  useEffect(() => {
    if (!policy) return;
    const serverKey = policyKey(policy.mode, policy.allowedAgentIds);
    setDraft((current) => {
      if (current === null || policyKey(current.mode, current.allowedAgentIds) === lastServerKeyRef.current) {
        return { mode: policy.mode, allowedAgentIds: policy.allowedAgentIds };
      }
      return current;
    });
    lastServerKeyRef.current = serverKey;
  }, [policy]);

  const updateMutation = useMutation({
    mutationFn: (next: Draft) =>
      inboxAgentPolicyApi.updateMine(companyId!, {
        mode: next.mode,
        allowedAgentIds: next.mode === "allowlist" ? next.allowedAgentIds : [],
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData<InboxAgentPolicy>(queryKeys.inboxAgentPolicy.mine(companyId!), saved);
    },
  });

  const isDirty = Boolean(
    draft && policy && policyKey(draft.mode, draft.allowedAgentIds) !== policyKey(policy.mode, policy.allowedAgentIds),
  );

  if (policyQuery.error) {
    return (
      <div className="text-sm text-destructive">
        {policyQuery.error instanceof Error ? policyQuery.error.message : t("comps3.inboxPolicy.loadFailed")}
      </div>
    );
  }

  if (policyQuery.isLoading || !draft) {
    return <div className="text-sm text-muted-foreground">{t("comps3.inboxPolicy.loading")}</div>;
  }

  return (
    <section className="space-y-4" aria-label={t("comps3.inboxPolicy.title")}>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">{t("comps3.inboxPolicy.title")}</h2>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t("comps3.inboxPolicy.intro")}
        </p>
      </div>

      <RadioCardGroup
        ariaLabel={t("comps3.inboxPolicy.radioAria")}
        value={draft.mode}
        onValueChange={(value) => setDraft((current) => (current ? { ...current, mode: value as InboxAgentPolicyMode } : current))}
        options={modeOptions(t)}
        className="max-w-2xl"
      />

      {draft.mode === "allowlist" ? (
        <div className="max-w-2xl space-y-2">
          <div className="text-sm font-medium">{t("comps3.inboxPolicy.allowedAgents")}</div>
          <AgentMultiSelect
            agents={agentOptions}
            selectedAgentIds={selectedAgentIds}
            onChange={(next) =>
              setDraft((current) =>
                current ? { ...current, allowedAgentIds: [...next] } : current,
              )
            }
            triggerLabel={
              selectedAgentIds.size === 0
                ? t("comps2.chatPicker.selectAgents")
                : selectedAgentIds.size === 1
                  ? t("comps2.chatPicker.selectedOne", { number: selectedAgentIds.size })
                  : t("comps2.chatPicker.selectedMany", { number: selectedAgentIds.size })
            }
            triggerFullWidth={false}
            showSelectionPreview={false}
            emptyMessage={t("comps3.inboxPolicy.noAgentsYet")}
          />
        </div>
      ) : null}

      {updateMutation.error ? (
        <div className="max-w-2xl rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {updateMutation.error instanceof Error ? updateMutation.error.message : t("comps3.inboxPolicy.saveFailed")}
        </div>
      ) : null}

      <div className="flex max-w-2xl items-center justify-end gap-3">
        {updateMutation.isSuccess && !isDirty ? (
          <span className="text-xs text-muted-foreground" role="status">{t("comps3.inboxPolicy.saved")}</span>
        ) : null}
        <Button
          type="button"
          disabled={!isDirty || updateMutation.isPending}
          onClick={() => draft && updateMutation.mutate(draft)}
        >
          {updateMutation.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
          {updateMutation.isPending ? t("comps1.decisionSettings.saving") : t("agentConfig.common.save")}
        </Button>
      </div>
    </section>
  );
}
