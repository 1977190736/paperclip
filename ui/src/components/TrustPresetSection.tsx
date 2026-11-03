import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { AgentPermissions, TrustPreset } from "@paperclipai/shared";
import { Check, Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, CollapsibleSection } from "./agent-config-primitives";
import {
  buildPermissionsForTrustPreset,
  clearSingleLowTrustBoundaryTarget,
  getLowTrustBoundary,
  getSingleLowTrustBoundaryTarget,
  getTrustPreset,
  isCeLowTrustBoundaryEditable,
  lowTrustBoundaryHasScope,
  setSingleLowTrustBoundaryTarget,
  summarizeLowTrustBoundaryTarget,
  TRUST_PRESET_DESCRIPTIONS,
  TRUST_PRESET_LABELS,
  type LowTrustBoundaryTarget,
} from "../lib/trust-policy-ui";
import { cn } from "../lib/utils";
import { useTranslation, t as translate } from "@/i18n";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

function formatCount(value: readonly unknown[] | undefined, singular: string, plural: string) {
  const count = value?.length ?? 0;
  if (count === 0) return "-";
  return `${count} ${count === 1 ? singular : plural}`;
}

function PolicyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 text-right", value === "-" && "text-muted-foreground")}>{value}</span>
    </div>
  );
}

export interface LowTrustBoundaryCandidate {
  id: string;
  label: string;
}

type LowTrustBoundaryTargetType = LowTrustBoundaryTarget["type"];

const BOUNDARY_TARGET_KEYS: Record<LowTrustBoundaryTargetType, string> = {
  project: "project",
  root_issue: "rootIssue",
  issue: "issue",
};

export function TrustPresetSection({
  permissions,
  onChange,
  disabled,
  companyId,
  projectCandidates = [],
  issueCandidates = [],
  candidatesLoading,
  allowSingleIssue = true,
  projectAccessEditor,
  layout = "select",
  aside,
}: {
  permissions: Partial<AgentPermissions> | null | undefined;
  onChange: (permissions: Partial<AgentPermissions>) => void;
  disabled?: boolean;
  companyId?: string | null;
  projectCandidates?: LowTrustBoundaryCandidate[];
  issueCandidates?: LowTrustBoundaryCandidate[];
  candidatesLoading?: boolean;
  allowSingleIssue?: boolean;
  projectAccessEditor?: ReactNode;
  /** "cards" shows the presets as selectable cards beside `aside` (the agent page). */
  layout?: "select" | "cards";
  aside?: ReactNode;
}) {
  const { t } = useTranslation();
  const [policyOpen, setPolicyOpen] = useState(false);
  const preset = getTrustPreset(permissions);
  const boundary = getLowTrustBoundary(permissions);
  const boundaryTarget = getSingleLowTrustBoundaryTarget(boundary);
  const [targetType, setTargetType] = useState<LowTrustBoundaryTargetType>(boundaryTarget?.type ?? "project");
  const lowTrust = preset === "low_trust_review";
  const hasScope = lowTrustBoundaryHasScope(boundary);
  const boundaryEditable = isCeLowTrustBoundaryEditable(boundary);
  const policy = permissions?.authorizationPolicy ?? null;
  const managedPermissions = useMemo(
    () => buildPermissionsForTrustPreset(permissions, preset),
    [permissions, preset],
  );

  useEffect(() => {
    if (boundaryTarget) setTargetType(boundaryTarget.type);
  }, [boundaryTarget?.type]);

  function handlePresetChange(value: string) {
    const nextPreset: TrustPreset = value === "low_trust_review" ? "low_trust_review" : "standard";
    onChange(buildPermissionsForTrustPreset(permissions, nextPreset));
  }

  function handleBoundaryTargetChange(targetId: string) {
    if (!companyId || !targetId) return;
    onChange(setSingleLowTrustBoundaryTarget(permissions, companyId, { type: targetType, id: targetId }));
  }

  function handleClearBoundary() {
    onChange(clearSingleLowTrustBoundaryTarget(permissions));
  }

  const targetCandidates = targetType === "project" ? projectCandidates : issueCandidates;
  const boundaryValue = boundaryTarget?.type === targetType ? boundaryTarget.id : "";

  const containment = lowTrust ? (
          <div
            role={hasScope ? "status" : "alert"}
            aria-live="polite"
            className={cn(
              "rounded-md border px-3 py-2.5 text-sm flex gap-2",
              hasScope
                ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-100"
                : "border-destructive/30 bg-destructive/10 text-destructive",
            )}
          >
            {hasScope ? (
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <p className="font-medium">
                  {hasScope ? t("comps2.trust.containmentActive") : t("comps2.trust.containmentNotConfigured")}
                </p>
                <p className="mt-1 text-xs leading-5">
                  {hasScope
                    ? t("comps2.trust.containmentActiveNote")
                    : t("comps2.trust.containmentMissingNote")}
                </p>
              </div>
              {projectAccessEditor && (boundary?.projectIds?.length ?? 0) > 1 ? null : boundaryEditable ? (
                <div className="rounded-md border border-border/70 bg-background/70 p-3 text-foreground space-y-3">
                  <div className="grid gap-3 sm:grid-cols-(--gtc-12)">
                    <Field label={t("comps2.trust.boundaryType")}>
                      <select
                        className={inputClass}
                        value={targetType}
                        onChange={(event) => setTargetType(event.target.value as LowTrustBoundaryTargetType)}
                        disabled={disabled}
                      >
                        <option value="project">{t("comps2.trust.project")}</option>
                        <option value="root_issue">{t("comps2.trust.rootIssue")}</option>
                        {allowSingleIssue && <option value="issue">{t("comps2.trust.issue")}</option>}
                      </select>
                    </Field>
                    <Field label={t(`comps2.trust.${BOUNDARY_TARGET_KEYS[targetType]}`)}>
                      <select
                        className={inputClass}
                        value={boundaryValue}
                        onChange={(event) => handleBoundaryTargetChange(event.target.value)}
                        disabled={disabled || !companyId || candidatesLoading || targetCandidates.length === 0}
                      >
                        <option value="">
                          {candidatesLoading
                            ? t("secrets.common.loading")
                            : targetCandidates.length === 0
                              ? (targetType === "project" ? t("comps2.trust.noProjectsAvailable") : t("comps2.trust.noIssuesAvailable"))
                              : t("comps2.trust.selectBoundary")}
                        </option>
                        {targetCandidates.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {t("comps2.trust.singleBoundaryNote")}
                    </p>
                    {boundaryTarget ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs"
                        onClick={handleClearBoundary}
                        disabled={disabled}
                      >
                        {t("comps2.trust.clearBoundary")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-border/70 bg-background/70 p-3 text-foreground">
                  <p className="text-sm font-medium">{t("comps2.trust.managedByEe")}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {t("comps2.trust.managedByEeNote", { summary: summarizeLowTrustBoundaryTarget(boundary).toLowerCase() })}
                  </p>
                </div>
              )}
              {!projectAccessEditor && <p className="text-xs text-muted-foreground">
                {t("comps2.trust.moreBoundariesQuestion")}{" "}
                <a
                  className="underline underline-offset-2 hover:text-foreground"
                  href="https://paperclip.ing/ee"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("comps2.trust.getEe")}
                </a>
              </p>}
              <CollapsibleSection
                title={t("comps2.trust.viewPolicy")}
                open={policyOpen}
                onToggle={() => setPolicyOpen((open) => !open)}
              >
                <div className="divide-y divide-border/60 text-foreground">
                  <PolicyRow label={t("comps2.trust.preset")} value={t("comps2.trust.lowTrustV1")} />
                  <PolicyRow label={t("comps2.trust.rawOutput")} value={t("comps2.trust.quarantined")} />
                  <PolicyRow label={t("comps2.trust.projects")} value={formatCount(boundary?.projectIds, t("comps2.trust.project"), t("comps2.trust.projects"))} />
                  <PolicyRow label={t("comps2.trust.rootIssue")} value={boundary?.rootIssueId ? boundary.rootIssueId.slice(0, 8) : "-"} />
                  <PolicyRow label={t("comps2.trust.explicitIssues")} value={formatCount(boundary?.issueIds, t("comps2.trust.issue"), t("comps2.trust.issues"))} />
                  <PolicyRow label={t("comps2.trust.allowedAgents")} value={formatCount(boundary?.allowedAgentIds, t("comps2.trust.agent"), t("comps2.trust.agents"))} />
                  <PolicyRow label={t("comps2.trust.allowedTools")} value={boundary?.allowedToolClasses?.join(" · ") || "-"} />
                  <PolicyRow label={t("comps2.trust.allowedSecrets")} value={formatCount(boundary?.allowedSecretBindingIds, t("comps2.trust.binding"), t("comps2.trust.bindings"))} />
                  <PolicyRow label={t("comps2.trust.promotionTarget")} value={boundary?.outputPromotionTarget?.issueId?.slice(0, 8) ?? "-"} />
                  <PolicyRow
                    label={t("comps2.trust.eeFields")}
                    value={Object.keys(policy ?? {}).some((key) => !["trustPreset", "reviewPreset", "trustBoundary"].includes(key))
                      ? t("comps2.trust.customFieldsPreserved")
                      : "-"}
                  />
                </div>
              </CollapsibleSection>
            </div>
          </div>
        ) : null;

  if (layout === "cards") {
    return (
      <div className="flex flex-col gap-(--agent-detail-module-gap)">
        <div className="grid gap-(--agent-detail-module-gap) sm:grid-cols-3">
          <div role="radiogroup" aria-label={t("comps2.trust.presetAria")} className="contents">
            {(["low_trust_review", "standard"] as const).map((value) => {
              const selected = preset === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-agent-tile=""
                  disabled={disabled}
                  onClick={() => (selected ? undefined : handlePresetChange(value))}
                  className={cn(
                    "flex min-h-(--agent-detail-tile-min-h) flex-col gap-2 rounded-lg border bg-(--agent-detail-tile) p-(--agent-detail-module-inset) text-left transition-colors outline-none hover:bg-(--agent-detail-tile-hover) focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                    selected ? "border-foreground" : "border-transparent",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">{TRUST_PRESET_LABELS[value]}</span>
                    {selected ? <Check className="size-4 text-foreground" aria-hidden /> : null}
                  </span>
                  <span className="text-sm leading-5 text-muted-foreground">{TRUST_PRESET_DESCRIPTIONS[value]}</span>
                </button>
              );
            })}
          </div>
          {aside}
        </div>
        {containment}
        {lowTrust ? projectAccessEditor : null}
        {managedPermissions.authorizationPolicy?.reviewPreset ? null : (
          <p className="text-xs text-muted-foreground">
            {t("comps2.trust.eeExtensionNote")}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium">{t("comps2.trust.trust")}</h3>
      <div className="rounded-lg border border-border p-4 space-y-3">
        <Field label={t("comps2.trust.presetLabel")} hint={t("comps2.trust.presetHint")}>
          <select
            className={inputClass}
            value={preset}
            onChange={(event) => handlePresetChange(event.target.value)}
            disabled={disabled}
          >
            <option value="standard">{TRUST_PRESET_LABELS.standard}</option>
            <option value="low_trust_review">{TRUST_PRESET_LABELS.low_trust_review}</option>
          </select>
        </Field>
        <p className="text-xs text-muted-foreground">{TRUST_PRESET_DESCRIPTIONS[preset]}</p>

        {containment}

        {lowTrust && projectAccessEditor}

        {managedPermissions.authorizationPolicy?.reviewPreset ? null : (
          <p className="text-xs text-muted-foreground">
            {t("comps2.trust.eeExtensionNote")}
          </p>
        )}
      </div>
    </div>
  );
}
