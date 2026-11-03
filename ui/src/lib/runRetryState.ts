import { formatDateTime } from "./utils";
import { t } from "@/i18n";

type RetryAwareRun = {
  status: string;
  retryOfRunId?: string | null;
  scheduledRetryAt?: string | Date | null;
  scheduledRetryAttempt?: number | null;
  scheduledRetryReason?: string | null;
  retryExhaustedReason?: string | null;
};

export type RunRetryStateSummary = {
  kind: "scheduled" | "exhausted" | "attempted";
  badgeLabel: string;
  tone: string;
  detail: string | null;
  secondary: string | null;
  retryOfRunId: string | null;
};

const RETRY_REASON_KEYS: Record<string, string> = {
  native_provider_overloaded: "nativeProviderOverloaded",
  ai_connection_pool_wait: "aiConnectionPoolWait",
  transient_failure: "transientFailure",
  missing_issue_comment: "missingIssueComment",
  process_lost: "processLost",
  assignment_recovery: "assignmentRecovery",
  issue_continuation_needed: "issueContinuationNeeded",
  max_turns_continuation: "maxTurnsContinuation",
};

function readNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function joinFragments(parts: Array<string | null>) {
  const filtered = parts.filter((part): part is string => Boolean(part));
  return filtered.length > 0 ? filtered.join(" · ") : null;
}

export function formatRetryReason(reason: string | null | undefined) {
  const normalized = readNonEmptyString(reason);
  if (!normalized) return null;
  const key = RETRY_REASON_KEYS[normalized];
  return key ? t(`libui.runRetry.reason.${key}`) : normalized.replace(/_/g, " ");
}

export function describeRunRetryState(run: RetryAwareRun): RunRetryStateSummary | null {
  const attempt =
    typeof run.scheduledRetryAttempt === "number" && Number.isFinite(run.scheduledRetryAttempt) && run.scheduledRetryAttempt > 0
      ? run.scheduledRetryAttempt
      : null;
  const attemptLabel = attempt ? t("libui.runRetry.attempt", { count: attempt }) : null;
  const reasonLabel = formatRetryReason(run.scheduledRetryReason);
  const retryOfRunId = readNonEmptyString(run.retryOfRunId);
  const exhaustedReason = readNonEmptyString(run.retryExhaustedReason);
  const dueAt = run.scheduledRetryAt ? formatDateTime(run.scheduledRetryAt) : null;
  const isMaxTurnContinuation = run.scheduledRetryReason === "max_turns_continuation";
  const hasRetryMetadata =
    Boolean(retryOfRunId)
    || Boolean(reasonLabel)
    || Boolean(dueAt)
    || Boolean(attemptLabel)
    || Boolean(exhaustedReason);

  if (!hasRetryMetadata) return null;

  if (run.status === "scheduled_retry") {
    return {
      kind: "scheduled",
      badgeLabel: run.scheduledRetryReason === "ai_connection_pool_wait"
        ? t("libui.runRetry.badge.poolExhausted")
        : isMaxTurnContinuation
          ? t("libui.runRetry.badge.continuationScheduled")
          : t("libui.runRetry.badge.retryScheduled"),
      tone: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
      detail: joinFragments([attemptLabel, reasonLabel]),
      secondary: dueAt
        ? t(isMaxTurnContinuation ? "libui.runRetry.nextContinuationAt" : "libui.runRetry.nextRetryAt", { time: dueAt })
        : t(isMaxTurnContinuation ? "libui.runRetry.nextContinuationPending" : "libui.runRetry.nextRetryPending"),
      retryOfRunId,
    };
  }

  if (exhaustedReason) {
    return {
      kind: "exhausted",
      badgeLabel: isMaxTurnContinuation ? t("libui.runRetry.badge.continuationExhausted") : t("libui.runRetry.badge.retryExhausted"),
      tone: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      detail: joinFragments([attemptLabel, reasonLabel, t("libui.runRetry.automaticRetriesExhausted")]),
      // `exhaustedReason` is server-provided copy; the phrase check below matches
      // that data and must stay verbatim English.
      secondary: exhaustedReason.includes("Manual intervention required")
        ? exhaustedReason
        : t("libui.runRetry.manualInterventionSuffix", { reason: exhaustedReason }),
      retryOfRunId,
    };
  }

  return {
    kind: "attempted",
    badgeLabel: isMaxTurnContinuation ? t("libui.runRetry.badge.continuedRun") : t("libui.runRetry.badge.retriedRun"),
    tone: "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    detail: joinFragments([attemptLabel, reasonLabel]),
    secondary: null,
    retryOfRunId,
  };
}
