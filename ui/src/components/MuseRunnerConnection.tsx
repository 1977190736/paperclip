import { Bot } from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { museDetectorCleanupAttestationSchema } from "@paperclipai/shared";
import type { MuseConnection, MusePairing, MuseAttestStopInput, MuseDetectorCleanupAttestationInput } from "@paperclipai/shared";
import { agentsApi } from "@/api/agents";
import { useMuseConnection, useMuseConnectionState } from "@/hooks/useMuseConnection";
import { queryKeys } from "@/lib/queryKeys";
import { formatDateTime } from "@/lib/utils";
import { AgentSetupPrompt } from "./AgentSetupPrompt";
import { MuseConnectionChecks } from "./new-agent/ExternalAgentInviteContent";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { t, useTranslation } from "@/i18n";

export interface MuseConnectionDetailsProps {
  connection: MuseConnection;
  pairing?: MusePairing | null;
  busy?: boolean;
  error?: string;
  offline?: boolean;
  onTest: () => void;
  onRepair: () => void;
  onPause: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
  onAttest: (input: MuseAttestStopInput) => void;
  onAttestDetectorCleanup?: (input: MuseDetectorCleanupAttestationInput) => void;
}

/** The settings view uses the same connection evidence as the invitation. */
export function MuseConnectionDetails({ connection, pairing, busy, error, offline = false, onTest, onRepair, onPause, onDisconnect, onRefresh, onAttest, onAttestDetectorCleanup }: MuseConnectionDetailsProps) {
  const b = connection.binding;
  const [attestation, setAttestation] = useState<MuseAttestStopInput | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [detectorSnapshot, setDetectorSnapshot] = useState<Omit<MuseDetectorCleanupAttestationInput, "observation" | "detectorRemoved"> | null>(null);
  const [detectorHookId, setDetectorHookId] = useState("");
  const [observationDigest, setObservationDigest] = useState("");
  const [detectorObservedAt, setDetectorObservedAt] = useState("");
  const detectorObservedAtValid = museDetectorCleanupAttestationSchema.shape.observation.shape.observedAt.safeParse(detectorObservedAt).success;
  const [detectorConfirmed, setDetectorConfirmed] = useState(false);
  const detectorIdentity = JSON.stringify([b?.id, b?.generation, b?.revision, b?.qualification?.id, b?.cleanup.hookScript, b?.cleanup.attestationEligible, offline]);
  useEffect(() => { setDetectorSnapshot(null); setObservationDigest(""); setDetectorObservedAt(""); setDetectorHookId(""); setDetectorConfirmed(false); }, [detectorIdentity]);
  const boundaryIdentity = JSON.stringify(b?.stop.boundary);
  const stopBindingRevision = b?.stop.bindingRevision;
  useEffect(() => { setAttestation(null); setConfirmed(false); }, [boundaryIdentity, stopBindingRevision]);
  const live = !!b && b.status !== "revoked";
  const { t } = useTranslation();
  const state = useMuseConnectionState(connection, { offline });
  const testing = state.testing;
  const configure = !offline && connection.enabled && connection.canConfigureConnection && !!connection.publicOrigin;
  const timestamp = (value: string | null) => value ? formatDateTime(value, { includeSeconds: true }) : t("comps1.muse.notObserved");
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">{t("comps1.muse.intro")}</p>
    {!connection.enabled && <p className="text-sm text-muted-foreground">{t("comps1.muse.disabledNote")}</p>}
    {!connection.publicOrigin && <p className="text-sm text-muted-foreground">{t("comps1.muse.publicOriginNote")}</p>}
    {b && <>
      <MuseConnectionChecks state={state} />
      <dl className="space-y-2 text-xs">
        {[
          [t("comps1.muse.lastReceiverContact"), timestamp(b.lastReceiverContactAt)],
          [t("comps1.muse.workerActivity"), timestamp(b.lastWorkerActivityAt)],
          [t("comps1.muse.lastVerifiedReply"), timestamp(b.lastVerifiedReplyAt)],
          [t("comps1.muse.credentialStatus"), b.credentialState],
          [t("comps1.muse.refreshExpires"), timestamp(b.refreshExpiresAt)],
          [t("comps1.muse.clientVersion"), b.clientVersion ?? t("comps1.muse.notReported")],
          [t("comps1.muse.liveAssignments"), String(b.liveAssignments)],
          [t("comps1.muse.uncertainOperations"), String(b.uncertainOperations)],
          [t("comps1.muse.pendingAnswers"), String(b.pendingInputs)],
          [t("comps1.muse.usageAndCost"), t("comps1.muse.unavailable")],
        ].map(([label, value]) => <div key={label} className="flex flex-wrap items-baseline justify-between gap-2"><dt className="text-muted-foreground">{label}</dt><dd className="font-mono">{value}</dd></div>)}
      </dl>
      <p className="text-xs text-muted-foreground">{t("comps1.muse.lagNote", { seconds: Math.ceil(b.contactPersistenceLagMs / 1000) })}</p>
      {b.status === "revoked" && <p role="status" className="text-sm text-muted-foreground">{t("comps1.muse.revokedNote")}</p>}
      {(b.cleanup.pending || b.status === "revoked") && <div className="space-y-2 text-sm text-muted-foreground">
        {"detectorRemovalRequested" in b.cleanup && b.cleanup.detectorRemovalRequested === true && !b.cleanup.detectorRemoved && <p>{t("comps1.muse.detectorRemovalRequested")}</p>}
        <p>{t("comps1.muse.detectorRemovalStatus", { detector: b.cleanup.detectorEvidence?.source === "operator_runtime_attestation" ? t("comps1.muse.detectorAttested") : b.cleanup.detectorRemoved ? t("comps1.muse.detectorAcknowledged") : t("comps1.muse.detectorNotConfirmed"), quiescence: b.cleanup.workerQuiescenceReported ? t("comps1.muse.reported") : t("comps1.muse.notConfirmed") })}</p>
        {b.cleanup.authenticatedAfterRevocation === false && <p>{t("comps1.muse.receiverDisableNote")}</p>}
        {b.cleanup.expiresAt && <p className="text-xs">{t("comps1.muse.cleanupExpires", { time: formatDateTime(b.cleanup.expiresAt) })}</p>}
        {b.cleanup.detectorEvidence && <p>{t("comps1.muse.detectorEvidenceNote", { time: timestamp(b.cleanup.detectorEvidence.recordedAt), source: b.cleanup.detectorEvidence.source === "operator_runtime_attestation" ? t("comps1.muse.evidenceAttestation") : t("comps1.muse.evidenceWorkerReport") })}</p>}
        {b.cleanup.attestationEligible && onAttestDetectorCleanup && !detectorSnapshot && <Button type="button" variant="outline" disabled={busy || offline} onClick={() => {
          if (!b.cleanup.hookScript) return;
          setDetectorSnapshot({ bindingId: b.id, generation: b.generation, expectedRevision: b.revision, qualificationId: b.qualification?.id ?? null, hookScript: b.cleanup.hookScript });
        }}>{t("comps1.muse.recordDetectorObservation")}</Button>}
        <p>{t("comps1.muse.separateCleanupNote")}</p>
      </div>}
      {b.stop.status !== "none" && <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">{b.stop.status === "operator_attested" ? t("comps1.muse.stopAttested")
          : b.stop.status === "worker_reported" ? t("comps1.muse.stopWorkerReported")
          : t("comps1.muse.stopFenced")}</p>
        {b.stop.nativeEffectsUnknown && <p role="status" className="text-muted-foreground">{t("comps1.muse.nativeUnknownNote")}</p>}
        {b.stop.boundary && stopBindingRevision == null && b.stop.status !== "operator_attested" && <p role="status" className="text-muted-foreground">{t("comps1.muse.bindingRevisionNote")}</p>}
        {b.stop.boundary && b.stop.status !== "operator_attested" && !attestation && <Button type="button" variant="outline" disabled={busy || stopBindingRevision == null} onClick={() => {
          if (!b.stop.boundary || stopBindingRevision == null) return;
          setAttestation({ boundary: { ...b.stop.boundary }, expectedRevision: stopBindingRevision, workerStopped: true }); setConfirmed(false);
        }}>{t("comps1.muse.attestWorkerStopped")}</Button>}
      </div>}
    </>}
    {detectorSnapshot && <section aria-label={t("comps1.muse.recordDetectorAria")} className="space-y-3 rounded-md border border-border p-3">
      <p className="text-sm font-medium">{t("comps1.muse.recordObservationTitle")}</p>
      <p className="break-all font-mono text-xs">{detectorSnapshot.hookScript}</p>
      <p className="text-sm text-muted-foreground">{t("comps1.muse.hooksNote")}</p>
      <label className="block space-y-2 text-sm">{t("comps1.muse.hookIdLabel")}<Input aria-label={t("comps1.muse.hookIdAria")} value={detectorHookId} onChange={event => { setDetectorHookId(event.target.value); setDetectorConfirmed(false); }} autoComplete="off" /></label>
      <label className="block space-y-2 text-sm">{t("comps1.muse.digestLabel")}<Input aria-label={t("comps1.muse.digestAria")} value={observationDigest} onChange={event => { setObservationDigest(event.target.value); setDetectorConfirmed(false); }} autoComplete="off" /></label>
      <p className="text-xs text-muted-foreground">{t("comps1.muse.digestNote")}</p>
      <label className="block space-y-2 text-sm">{t("comps1.muse.observedAtLabel")}<Input aria-label={t("comps1.muse.observedAtAria")} value={detectorObservedAt} onChange={event => { setDetectorObservedAt(event.target.value); setDetectorConfirmed(false); }} placeholder="YYYY-MM-DDTHH:mm:ss.sssZ" autoComplete="off" /></label>
      <p className="text-xs text-muted-foreground">{t("comps1.muse.observedAtNote")}</p>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={detectorConfirmed} onChange={event => setDetectorConfirmed(event.target.checked)} className="mt-1 accent-primary" /><span>{t("comps1.muse.detectorConfirmLabel")}</span></label>
      <div className="flex items-center justify-between gap-3"><Button type="button" variant="ghost" onClick={() => setDetectorSnapshot(null)}>{t("comps1.muse.cancel")}</Button><Button type="button" disabled={!detectorConfirmed || !detectorObservedAtValid || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(detectorHookId) || !/^[a-f0-9]{64}$/.test(observationDigest) || busy || offline} onClick={() => onAttestDetectorCleanup?.({ ...detectorSnapshot, detectorRemoved: true, observation: { method: "hooks.list", includeDisabled: true, hookId: detectorHookId, outcome: "exact_hook_absent", observedAt: detectorObservedAt, sha256: observationDigest } })}>{t("comps1.muse.confirmDetectorObservation")}</Button></div>
    </section>}
    {attestation && <section aria-label={t("comps1.muse.attestAria")} className="space-y-3 rounded-md border border-border p-3">
      <p className="text-sm font-medium">{t("comps1.muse.confirmWorkerTitle")}</p>
      <dl className="space-y-2 text-xs">
        {Object.entries(attestation.boundary).map(([key, value]) => <div key={key} className="flex flex-wrap items-baseline justify-between gap-2"><dt className="text-muted-foreground">{key}</dt><dd className="break-all font-mono">{value === null ? t("comps1.muse.none") : String(value)}</dd></div>)}
      </dl>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-1 accent-primary" /><span>{t("comps1.muse.workerConfirmLabel")}</span></label>
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={() => setAttestation(null)}>{t("comps1.muse.cancel")}</Button>
        <Button type="button" disabled={!confirmed || busy} onClick={() => onAttest(attestation)}>{t("comps1.muse.confirmWorkerStopped")}</Button>
      </div>
    </section>}
    {pairing && !b?.paired && <div className="space-y-2">
      <AgentSetupPrompt key={pairing.bindingId + pairing.revision} prompt={pairing.setupInstruction} label={t("comps1.muse.copySetupPrompt")} title={t("comps1.muse.connectMuseTitle")} agent={{ name: "Muse", icon: <Bot className="size-5" /> }} description={t("comps1.muse.connectMuseDescription")} />
      <p className="text-xs text-muted-foreground">{t("comps1.muse.setupExpiresNote", { time: formatDateTime(pairing.expiresAt) })}</p>
    </div>}
    <div className="flex flex-wrap items-center gap-2">
      {live && <Button type="button" variant="outline" disabled={!configure || b.credentialState !== "active" || !b.paired || busy || testing} onClick={onTest}>{testing ? t("comps1.muse.testingReply") : t("comps1.muse.testReply")}</Button>}
      <Button type="button" variant="outline" disabled={!configure || busy} onClick={onRepair}>{b?.credentialState === "expired" ? t("comps1.muse.reconnectMuse") : live ? t("comps1.muse.repairConnection") : t("comps1.muse.connectMuse")}</Button>
      {connection.agentStatus !== "paused" && connection.agentStatus !== "terminated" && <Button type="button" variant="outline" disabled={busy} onClick={onPause}>{t("comps1.muse.pauseAgent")}</Button>}
      {live && <Button type="button" variant="outline" disabled={busy} onClick={onDisconnect}>{t("comps1.muse.disconnect")}</Button>}
      <Button type="button" variant="ghost" disabled={busy} onClick={onRefresh}>{t("comps1.muse.refresh")}</Button>
      <Button type="button" asChild variant="ghost"><a href="https://muse.ai" target="_blank" rel="noopener noreferrer">{t("comps1.muse.openMuse")}</a></Button>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}

export function MuseRunnerConnection({ companyId, agentId }: { companyId?: string; agentId?: string }) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const muse = useMuseConnection(companyId, agentId);
  const pause = useMutation({ mutationFn: () => agentsApi.pause(agentId!, companyId), onSuccess: () => {
    void muse.refresh(); void cache.invalidateQueries({ queryKey: queryKeys.agents.detail(agentId!) });
    if (companyId) void cache.invalidateQueries({ queryKey: queryKeys.agents.list(companyId) });
  } });
  if (!agentId) return <p className="text-sm text-muted-foreground">{t("comps1.muse.saveFirst")}</p>;
  const error = muse.state.error ?? muse.pair.error ?? muse.verify.error ?? muse.revoke.error ?? muse.attest.error ?? muse.attestDetector.error ?? pause.error;
  if (muse.identity.failed) return <div className="space-y-3"><p role="alert" className="text-sm text-destructive">{t("comps1.muse.identityFailed")}</p><Button type="button" variant="outline" onClick={() => { void cache.invalidateQueries({ queryKey: queryKeys.auth.session }); }}>{t("comps1.muse.refresh")}</Button></div>;
  if (!muse.state.data) return <div className="space-y-3"><p role="status" className="text-sm text-muted-foreground">{muse.state.error ? t("comps1.muse.loadFailed") : t("comps1.muse.loading")}</p>{error && <p role="alert" className="text-sm text-destructive">{error.message}</p>}<Button type="button" variant="outline" onClick={() => { void muse.state.refetch(); }}>{t("comps1.muse.refresh")}</Button></div>;
  return <MuseConnectionDetails key={muse.identity.userId} connection={muse.state.data} pairing={muse.pairing} offline={muse.state.isError}
    busy={muse.pair.isPending || muse.verify.isPending || muse.revoke.isPending || muse.attest.isPending || muse.attestDetector.isPending || pause.isPending}
    error={error?.message} onTest={() => { if (muse.binding) muse.verify.mutate(muse.binding); }} onRepair={muse.repair}
    onPause={() => pause.mutate()} onDisconnect={() => { if (muse.binding) muse.revoke.mutate(muse.binding); }}
    onRefresh={() => { void muse.state.refetch(); }} onAttest={input => muse.attest.mutate(input)} onAttestDetectorCleanup={input => muse.attestDetector.mutate(input)} />;
}
