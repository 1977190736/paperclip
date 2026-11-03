import type {
  WorkspaceOperation,
  WorkspaceReadiness,
  WorkspaceReadinessState,
  WorkspaceRuntimeService,
} from "@paperclipai/shared";
import { t } from "@/i18n";

/**
 * Derives the workspace access state the UI shows (PAP-17572).
 *
 * The board cannot read a cloned workspace's protected health directly, so state
 * comes from three server-side facts it *can* see: the live runtime rows, the
 * workspace operation log, and the readiness the control plane reported when it
 * last tried to mint a login handoff.
 *
 * Every state carries one concrete next action. The failure this replaces was a
 * generic "Load failed" (or worse, a green badge) that told an operator nothing
 * about whether to wait, start, repair, or read a log.
 */

export type WorkspaceAccessActionKind =
  | "open"
  | "start"
  | "repair"
  | "view_logs"
  /** Nothing to do but wait for a running operation. */
  | "wait";

export type WorkspaceAccessAction = {
  kind: WorkspaceAccessActionKind;
  label: string;
};

export type WorkspaceAccessNotice = {
  title: string;
  description: string;
  action: WorkspaceAccessAction;
};

export type WorkspaceAccessDisplayState = WorkspaceReadinessState | "stopped";

export type WorkspaceAccessState = {
  state: WorkspaceAccessDisplayState;
  title: string;
  description: string;
  action: WorkspaceAccessAction;
  /** True when a password-independent handoff is the expected way in. */
  handoffAvailable: boolean;
  /** A non-blocking historical failure that is still useful to inspect. */
  secondaryNotice?: WorkspaceAccessNotice;
};

/** What the control plane said the last time a handoff was requested. */
export type WorkspaceLoginHandoffFailureInfo = {
  reason: string;
  detail?: string | null;
  readiness?: WorkspaceReadiness | null;
};

function latestOperation(operations: WorkspaceOperation[], phase: WorkspaceOperation["phase"]) {
  return operations.find((operation) => operation.phase === phase) ?? null;
}

function describeSeedPhase(readiness: WorkspaceReadiness | null | undefined): string | null {
  if (!readiness?.failurePhase && !readiness?.seedPhase) return null;
  return readiness.failurePhase ?? readiness.seedPhase ?? null;
}

function timestampMs(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function failedRepairNotice(repair: WorkspaceOperation): WorkspaceAccessNotice {
  const phase = typeof repair.metadata?.repairPhase === "string" ? repair.metadata.repairPhase : null;
  return {
    title: t("libui.workspaceAccess.repairFailed.title"),
    description: phase
      ? t("libui.workspaceAccess.repairFailed.phase", { phase })
      : t("libui.workspaceAccess.repairFailed.plain"),
    action: { kind: "view_logs", label: t("libui.workspaceAccess.action.viewRepairLog") },
  };
}

function failedProvisionNotice(provision: WorkspaceOperation): WorkspaceAccessNotice {
  const phase = typeof provision.metadata?.seedFailurePhase === "string"
    ? provision.metadata.seedFailurePhase
    : null;
  return {
    title: t("libui.workspaceAccess.provisionFailed.title"),
    description: phase
      ? t("libui.workspaceAccess.provisionFailed.phase", { phase })
      : t("libui.workspaceAccess.provisionFailed.plain"),
    action: { kind: "view_logs", label: t("libui.workspaceAccess.action.viewProvisioningLog") },
  };
}

/** Handoff failure reasons are server data keys; the copy is display-only. */
const HANDOFF_REASON_KEYS: Record<string, string> = {
  handoff_not_configured: "handoffNotConfigured",
  no_board_identity: "noBoardIdentity",
  runtime_not_running: "runtimeNotRunning",
  runtime_url_unusable: "runtimeUrlUnusable",
  workspace_not_ready: "workspaceNotReady",
};

/** Readiness failure phases are server data keys; the copy is display-only. */
const READINESS_FAILURE_KEYS: Record<string, string> = {
  database_unreachable: "databaseUnreachable",
  clone_data_missing: "cloneDataMissing",
  clone_data_unreadable: "cloneDataUnreadable",
  cloned_membership_missing: "clonedMembershipMissing",
  cloned_identity_unreadable: "clonedIdentityUnreadable",
  auth_handoff_not_configured: "authHandoffNotConfigured",
  seed_manifest_unreadable: "seedManifestUnreadable",
};

/**
 * Human cause for a readiness rejection, preferring the specific recorded phase
 * over a generic sentence so the copy names what to fix.
 */
export function describeWorkspaceReadinessCause(
  failure: WorkspaceLoginHandoffFailureInfo | null | undefined,
): string | null {
  if (!failure) return null;
  const phase = describeSeedPhase(failure.readiness);
  if (phase && READINESS_FAILURE_KEYS[phase]) return t(`libui.workspaceAccess.readiness.${READINESS_FAILURE_KEYS[phase]}`);
  if (phase) return t("libui.workspaceAccess.lastRecordedPhase", { phase });
  if (failure.detail && READINESS_FAILURE_KEYS[failure.detail]) return t(`libui.workspaceAccess.readiness.${READINESS_FAILURE_KEYS[failure.detail]}`);
  const reasonKey = HANDOFF_REASON_KEYS[failure.reason];
  return reasonKey ? t(`libui.workspaceAccess.reason.${reasonKey}`) : null;
}

export function resolveWorkspaceAccessState(input: {
  runtimeServices: WorkspaceRuntimeService[] | null | undefined;
  operations: WorkspaceOperation[] | null | undefined;
  handoffFailure?: WorkspaceLoginHandoffFailureInfo | null;
}): WorkspaceAccessState {
  const operations = input.operations ?? [];
  const runtimeServices = input.runtimeServices ?? [];
  const repair = latestOperation(operations, "workspace_repair");
  const provision =
    latestOperation(operations, "workspace_seed")
    ?? latestOperation(operations, "workspace_runtime_provision")
    ?? latestOperation(operations, "workspace_provision");
  const failure = input.handoffFailure ?? null;
  const cause = describeWorkspaceReadinessCause(failure);
  const handoffAvailable = failure?.reason !== "handoff_not_configured" && failure?.reason !== "no_board_identity";
  const servingService = runtimeServices.find(
    (service) => service.status === "running" && service.healthStatus === "healthy" && service.url,
  );
  const startingService = runtimeServices.find(
    (service) => service.status === "provisioning" || service.status === "starting",
  );
  const repairFinishedAt = timestampMs(repair?.finishedAt);
  const servingServiceStartedAt = timestampMs(servingService?.startedAt);
  const provisionFinishedAt = timestampMs(provision?.finishedAt);
  const readinessConfirmsServing = Boolean(servingService && failure?.readiness?.state === "ready");
  const runtimeStartedAfterRepair = repairFinishedAt !== null
    && servingServiceStartedAt !== null
    && repairFinishedAt < servingServiceStartedAt;
  const repairFailureWasSuperseded = repair?.status === "failed" && Boolean(
    servingService
    && (readinessConfirmsServing || runtimeStartedAfterRepair),
  );
  const successfulRepairFinishedAt = repair?.status === "succeeded"
    ? timestampMs(repair.finishedAt)
    : null;
  // A failed seed is historical once the workspace is demonstrably serving,
  // or once a later repair has replaced and revalidated that database.
  const provisionFailureWasSuperseded = provision?.status === "failed" && Boolean(
    servingService
    || (
      provisionFinishedAt !== null
      && successfulRepairFinishedAt !== null
      && provisionFinishedAt < successfulRepairFinishedAt
    ),
  );
  const secondaryNotice = repair?.status === "failed" && repairFailureWasSuperseded
    ? failedRepairNotice(repair)
    : provision?.status === "failed" && provisionFailureWasSuperseded
      ? failedProvisionNotice(provision)
      : undefined;

  // A live repair outranks everything: it is already changing the answer.
  if (repair?.status === "running") {
    const phase = typeof repair.metadata?.repairPhase === "string" ? repair.metadata.repairPhase : null;
    return {
      state: "repairing",
      title: t("libui.workspaceAccess.repairing.title"),
      description: phase
        ? t("libui.workspaceAccess.repairing.phase", { phase })
        : t("libui.workspaceAccess.repairing.plain"),
      action: { kind: "wait", label: t("libui.workspaceAccess.action.repairInProgress") },
      handoffAvailable,
    };
  }
  if (repair?.status === "failed" && !repairFailureWasSuperseded) {
    const notice = failedRepairNotice(repair);
    return {
      state: "failed",
      ...notice,
      handoffAvailable,
    };
  }

  if (provision?.status === "running") {
    return {
      state: "provisioning",
      title: t("libui.workspaceAccess.provisioning.title"),
      description: t("libui.workspaceAccess.provisioning.description"),
      action: { kind: "wait", label: t("libui.workspaceAccess.action.provisioning") },
      handoffAvailable,
    };
  }
  if (provision?.status === "failed" && !provisionFailureWasSuperseded) {
    const seedPhase = typeof provision.metadata?.seedFailurePhase === "string"
      ? provision.metadata.seedFailurePhase
      : null;
    return {
      state: "failed",
      title: t("libui.workspaceAccess.provisionFailed.title"),
      description: seedPhase
        ? t("libui.workspaceAccess.provisionFailedState.phase", { phase: seedPhase })
        : t("libui.workspaceAccess.provisionFailedState.plain"),
      action: { kind: "repair", label: t("libui.workspaceAccess.action.repairWorkspace") },
      handoffAvailable,
    };
  }

  // Readiness the control plane actually observed beats anything inferred from
  // runtime rows, because it is the only signal that looked inside the clone.
  const staleNotReadyFailure = failure?.reason === "workspace_not_ready" && readinessConfirmsServing;
  if (failure && !staleNotReadyFailure) {
    if (failure.reason === "runtime_not_running" && !servingService && !startingService) {
      return {
        state: "stopped",
        title: t("libui.workspaceAccess.stopped.title"),
        description: t("libui.workspaceAccess.stopped.description"),
        action: { kind: "start", label: t("libui.workspaceAccess.action.startWorkspace") },
        handoffAvailable,
      };
    }
    if (failure.reason === "workspace_not_ready" || failure.reason === "runtime_url_unusable") {
      const readinessState = failure.readiness?.state;
      const validating = readinessState === "validating" || readinessState === "provisioning";
      return {
        state: validating ? "validating" : "degraded",
        title: validating ? t("libui.workspaceAccess.validating.title") : t("libui.workspaceAccess.degraded.title"),
        description: [
          cause ?? t("libui.workspaceAccess.degraded.causeFallback"),
          validating ? t("libui.workspaceAccess.validatingNote") : t("libui.workspaceAccess.repairNote"),
        ].join(" "),
        action: validating
          ? { kind: "wait", label: t("libui.workspaceAccess.action.validating") }
          : { kind: "repair", label: t("libui.workspaceAccess.action.repairWorkspace") },
        handoffAvailable,
      };
    }
    if (!handoffAvailable) {
      return {
        state: servingService ? "ready" : "degraded",
        title: servingService ? t("libui.workspaceAccess.snapshotSignIn.title") : t("libui.workspaceAccess.degraded.title"),
        description: cause ?? t("libui.workspaceAccess.snapshotSignIn.description"),
        action: servingService
          ? { kind: "open", label: t("libui.workspaceAccess.action.openWorkspace") }
          : { kind: "start", label: t("libui.workspaceAccess.action.startWorkspace") },
        handoffAvailable: false,
        secondaryNotice,
      };
    }
  }

  if (startingService) {
    return {
      state: "provisioning",
      title: t("libui.workspaceAccess.starting.title"),
      description: t("libui.workspaceAccess.starting.description"),
      action: { kind: "wait", label: t("libui.workspaceAccess.action.startingWorkspace") },
      handoffAvailable,
    };
  }

  if (servingService) {
    return {
      state: "ready",
      title: t("libui.workspaceAccess.ready.title"),
      description: t("libui.workspaceAccess.ready.description"),
      action: { kind: "open", label: t("libui.workspaceAccess.action.openWorkspace") },
      handoffAvailable,
      secondaryNotice,
    };
  }

  const unhealthyService = runtimeServices.find(
    (service) => service.status === "running" && service.healthStatus !== "healthy",
  );
  if (unhealthyService) {
    return {
      state: "degraded",
      title: t("libui.workspaceAccess.degraded.title"),
      description: cause
        ?? t("libui.workspaceAccess.degraded.unhealthyFallback"),
      action: { kind: "repair", label: t("libui.workspaceAccess.action.repairWorkspace") },
      handoffAvailable,
    };
  }

  return {
    state: "stopped",
    title: t("libui.workspaceAccess.stopped.title"),
    description: t("libui.workspaceAccess.stopped.description"),
    action: { kind: "start", label: t("libui.workspaceAccess.action.startWorkspace") },
    handoffAvailable,
  };
}
