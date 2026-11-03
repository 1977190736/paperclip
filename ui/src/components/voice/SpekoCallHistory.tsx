import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import type { VoiceCallHistoryEntry, VoiceCallReport, VoiceUnapprovedCallHistoryEntry } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import { voiceSessionsApi } from "@/api/voiceSessions";
import { voicePhoneApi } from "@/api/voicePhone";
import { voiceHistoryApi } from "@/api/voiceHistory";
import { useTranslation, t as translate } from "@/i18n";

function charge(amount: string | null) {
  if (amount === null) return translate("comps2.voice.notYetReported");
  const value = BigInt(amount);
  const whole = value / 1_000_000n, fraction = (value % 1_000_000n).toString().padStart(6, "0");
  return `$${whole}.${fraction} USD`;
}
export function SpekoCallReport({ report }: { report: VoiceCallReport }) {
  const { t } = useTranslation();
  return <div className="space-y-3">
    <dl className="flex flex-wrap gap-4 text-sm"><div><dt className="text-muted-foreground">{t("comps2.voice.spekoCharge")}</dt><dd>{charge(report.costMicroUsd)}</dd></div>{report.durationSeconds !== null && <div><dt className="text-muted-foreground">{t("comps2.voice.duration")}</dt><dd>{report.durationSeconds} {t("comps2.voice.seconds")}</dd></div>}</dl>
    <p className="text-xs text-muted-foreground">{t("comps2.voice.agentCostsNote")}</p>
    {report.transcript.length ? <ol aria-label={t("comps2.voice.callTranscript")} className="space-y-3">{report.transcript.map(turn => <li key={turn.id} className="min-w-0"><p className="text-xs font-medium text-muted-foreground">{turn.speaker === "caller" ? t("comps2.voice.speakerYou") : t("comps2.voice.speakerAgent")}{turn.interrupted ? t("comps2.voice.interruptedSuffix") : ""}</p><p className="whitespace-pre-wrap break-words text-sm">{turn.text}</p></li>)}</ol>
      : <p className="text-sm text-muted-foreground">{report.status === "unavailable" ? t("comps2.voice.transcriptUnavailable") : report.status === "pending" ? t("comps2.voice.transcriptPending") : t("comps2.voice.transcriptMissing")}</p>}
  </div>;
}
const modeKeys = { browser: "browserVoice", inbound_phone: "incomingCall", outbound_phone: "outgoingCall" } as const;
const stateKeys = { reserved: "preparing", creating: "connecting", creation_unknown: "checkingConnection", connecting: "connecting", active: "inProgress", awaiting_approval: "awaitingApproval", ending: "ending", ended: "completed", failed: "failed", expired: "expired" } as const;
export function SpekoCallActivityItem({ entry: { session, report }, onEnd, ending, presentation = "history" }: { entry: VoiceCallHistoryEntry; onEnd?(sessionId: string): void; ending?: boolean; presentation?: "history" | "activity" }) {
  const { t } = useTranslation();
  const summary = useRef<HTMLElement | null>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (restoreFocus.current && ["ended", "failed", "expired"].includes(session.state)) { summary.current?.focus(); restoreFocus.current = false; }
  }, [session.state]);
  return <details data-activity-kind="call" className={presentation === "activity" ? "px-2 py-3 transition-colors hover:bg-accent/50" : "rounded-md border border-border p-3"}>
    <summary ref={summary} className="cursor-pointer break-words text-sm font-medium">{t(`comps2.voice.mode.${modeKeys[session.mode]}`)} · {t(`comps2.voice.state.${stateKeys[session.state]}`)}<span className="ml-2 text-xs font-normal text-muted-foreground">{new Date(session.createdAt).toLocaleString()}</span></summary>
    <div className="mt-3 space-y-3"><Link className="text-sm text-primary underline" to={`/issues/${encodeURIComponent(session.issueId)}`}>{t("comps2.voice.conversationTask")}</Link>
      {session.errorCode && <p className="text-sm text-muted-foreground">{session.errorCode === "cleanup_pending" ? t("comps2.voice.cleanupPending") : t("comps2.voice.connectionProblem")}</p>}
      {!session.endedAt && !["ended", "failed", "expired"].includes(session.state) && session.callerAuthority !== "guest_intake" && onEnd && <Button size="sm" variant="outline" disabled={ending} onClick={() => { restoreFocus.current = true; onEnd(session.id); }}>{ending ? t("comps2.voice.ending") : t("comps2.voice.endCall")}</Button>}
      <SpekoCallReport report={report} />
    </div>
  </details>;
}
export function SpekoUnapprovedCallActivityItem({ call, presentation = "history" }: { call: VoiceUnapprovedCallHistoryEntry; presentation?: "history" | "activity" }) {
  const { t } = useTranslation();
  return <div data-activity-kind="unapproved_call" className={presentation === "activity" ? "px-2 py-3 text-sm" : "rounded-md border border-border p-3 text-sm"}><p>{call.state === "denied" ? t("comps2.voice.callDenied") : call.state === "expired" ? t("comps2.voice.approvalExpired") : t("comps2.voice.missedCall")} · {new Date(call.createdAt).toLocaleString()}</p><p className="text-xs text-muted-foreground">{t("comps2.voice.noPrivateTask")}</p></div>;
}
export interface SpekoCallHistoryViewProps { entries?: VoiceCallHistoryEntry[]; unapprovedCalls?: VoiceUnapprovedCallHistoryEntry[]; loading?: boolean; error?: string; incomingError?: string; endError?: string; onRetry(): void; onEnd?(sessionId: string): void; endingSessionId?: string }
export function SpekoCallHistoryView({ entries = [], unapprovedCalls = [], loading, error, incomingError, endError, onRetry, onEnd, endingSessionId }: SpekoCallHistoryViewProps) {
  const { t } = useTranslation();
  return <section className="max-w-xl space-y-3" aria-label={t("comps2.voice.yourCalls")}>
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{t("comps2.voice.yourCalls")}</h2><Button size="sm" variant="ghost" onClick={onRetry} disabled={loading}>{t("comps2.voice.refresh")}</Button></div>
    {loading && <p role="status" className="text-sm text-muted-foreground">{t("comps2.voice.loadingCalls")}</p>}
    {error && <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{error}</p><Button size="sm" variant="outline" onClick={onRetry}>{t("agents.chatSidebar.tryAgain")}</Button></div>}
    {incomingError && <p role="alert" className="text-sm text-destructive">{t("comps2.voice.unapprovedLoadError")} {incomingError}</p>}
    {endError && <p role="alert" className="text-sm text-destructive">{t("comps2.voice.endCallError")} {endError}</p>}
    {!loading && !error && !incomingError && !entries.length && !unapprovedCalls.length && <p className="text-sm text-muted-foreground">{t("comps2.voice.historyEmpty")}</p>}
    {!error && entries.map(entry => <SpekoCallActivityItem key={entry.session.id} entry={entry} onEnd={onEnd} ending={endingSessionId === entry.session.id} />)}
    {!incomingError && unapprovedCalls.length > 0 && <div className="space-y-2"><h3 className="text-sm font-medium">{t("comps2.voice.unapprovedIncoming")}</h3><ul className="space-y-2">{unapprovedCalls.map(call => <li key={call.id}><SpekoUnapprovedCallActivityItem call={call} /></li>)}</ul></div>}
  </section>;
}
export function useSpekoCallHistory(companyId: string, endpointId: string, enabled = true) {
  const query = useQuery({ queryKey: ["speko-history", companyId, endpointId], queryFn: () => voiceHistoryApi.list(companyId, endpointId), enabled, retry: false, refetchInterval: enabled ? 30_000 : false });
  const incoming = useQuery({queryKey: ["speko-unapproved-history", companyId, endpointId], queryFn: () => voicePhoneApi.history(companyId, endpointId), retry: false, enabled: enabled && query.isSuccess, refetchInterval: enabled ? 30_000 : false});
  const ending = useMutation({mutationFn: (sessionId: string) => voiceSessionsApi.end(companyId, sessionId), onSuccess: () => query.refetch()});
  return { entries: query.data ?? [], unapprovedCalls: incoming.data ?? [], loading: query.isLoading || incoming.isLoading, error: query.error?.message, incomingError: incoming.error?.message, endError: ending.error?.message, endingSessionId: ending.isPending ? ending.variables : undefined,
    onEnd: (sessionId: string) => ending.mutate(sessionId), onRetry: () => { ending.reset(); void query.refetch(); void incoming.refetch(); } };
}
export function SpekoCallHistory({ companyId, endpointId }: { companyId: string; endpointId: string }) {
  return <SpekoCallHistoryView {...useSpekoCallHistory(companyId, endpointId)} />;
}
