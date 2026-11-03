import { useId } from "react";
import { AGENT_ROLES, AGENT_ROLE_LABELS } from "@paperclipai/shared";
import type { MuseInvitationDraft } from "@/lib/muse-invitation-draft";
import { Input } from "../ui/input";
import { Link } from "@/lib/router";
import { ArrowLeft, Bot, Check, Circle, CircleAlert, Loader2 } from "lucide-react";
import { AdapterMark } from "../AdapterMark";
import { AgentSetupPrompt } from "../AgentSetupPrompt";
import { Button } from "../ui/button";
import { DialogDescription, DialogTitle } from "../ui/dialog";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";

export type ExternalAgentPreset = "dot" | "grok_bot" | "muse" | "hermes" | "other";
export type DotConnectionState = {
  phase: "waiting" | "connected" | "subscribed" | "testing" | "finishing" | "ready";
  problem?: "event_timeout" | "prompt_unavailable" | "offline" | "agent_unavailable";
};

const presets = [
  { id: "dot", name: "Dot", adapter: "openai_dot", description: "Your Dot in ChatGPT" },
  { id: "grok_bot", name: "Grok Bot", adapter: "grok_bot", description: "An existing Bot in Grok" },
  { id: "muse", name: "Muse — Personal agent", adapter: "muse", description: "Your personal Muse at muse.ai" },
  { id: "hermes", name: "Hermes", adapter: "hermes_gateway", description: "An existing Hermes agent" },
  { id: "other", name: "Other", adapter: "http", description: "Any agent that can connect to Paperclip" },
] as const;

export function ExternalAgentPresetPicker({ onSelect, dotDisabledReason, grokDisabledReason, museEnabled = false }: { onSelect: (preset: ExternalAgentPreset) => void; dotDisabledReason?: string; grokDisabledReason?: string; museEnabled?: boolean }) {
  const { t } = useTranslation();
  return <div className={cn("grid grid-cols-2 gap-3", !museEnabled && "sm:grid-cols-4")}>
    {presets.filter(preset => preset.id !== "muse" || museEnabled).map(preset => <button
      key={preset.id}
      type="button"
      onClick={() => onSelect(preset.id)}
      disabled={preset.id === "dot" && !!dotDisabledReason || preset.id === "grok_bot" && !!grokDisabledReason}
      title={preset.id === "dot" ? dotDisabledReason : preset.id === "grok_bot" ? grokDisabledReason : undefined}
      className="flex aspect-square flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card px-3 py-4 text-center transition-colors disabled:opacity-50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <AdapterMark type={preset.adapter} className="size-8" />
      <span className="text-sm font-medium">{preset.id === "muse" ? t("agentConfig.adapter.muse") : preset.id === "other" ? t("comps2.newAgent.presetOther") : preset.name}</span>
      <span className="sr-only">{t(`comps2.newAgent.presetDesc.${preset.id}`)}</span>
    </button>)}
  </div>;
}

const dotCheckKeys = ["connected", "updates", "testEvent"] as const;

/** Controlled by server evidence in the invite controller, never by copying a prompt. */
export function DotConnectionChecks({ state }: { state: DotConnectionState }) {
  const { t } = useTranslation();
  const completed = { waiting: 0, connected: 1, subscribed: 2, testing: 2, finishing: 3, ready: 3 }[state.phase];
  const message = state.problem === "agent_unavailable" ? t("comps2.newAgent.dotMessage.agentUnavailable")
    : state.problem === "offline" ? t("comps2.newAgent.dotMessage.offline")
    : state.problem === "prompt_unavailable" ? t("comps2.newAgent.dotMessage.promptUnavailable")
    : state.problem === "event_timeout" ? t("comps2.newAgent.dotMessage.eventTimeout")
    : state.phase === "finishing" ? t("comps2.newAgent.dotMessage.finishing")
    : state.phase === "ready" ? t("comps2.newAgent.dotMessage.ready")
    : state.phase === "waiting" ? t("comps2.newAgent.dotMessage.waiting")
    : state.phase === "connected" ? t("comps2.newAgent.dotMessage.connected")
    : t("comps2.newAgent.dotMessage.confirming");
  return <section aria-label={t("comps2.newAgent.dotChecksAria")} className="space-y-4">
    <ol className="space-y-4">
      {dotCheckKeys.map((key, index) => {
        const done = index < completed;
        const failed = index === completed && state.problem === "event_timeout";
        const active = index === completed && !state.problem;
        const Icon = done ? Check : failed ? CircleAlert : active ? Loader2 : Circle;
        return <li key={key} className="flex items-start gap-3" aria-current={active ? "step" : undefined}>
          <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", done ? "bg-accent text-foreground" : failed ? "text-destructive" : "text-muted-foreground")}>
            <Icon className={cn("size-4", active && "animate-spin motion-reduce:animate-none")} />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className={cn("text-sm", done || active || failed ? "font-medium" : "text-muted-foreground")}>
              {t(`comps2.newAgent.dotChecks.${key}.title`)}<span className="sr-only">{done ? t("comps2.newAgent.statusComplete") : failed ? t("comps2.newAgent.statusNeedsAttention") : active ? t("comps2.newAgent.statusInProgress") : t("comps2.newAgent.statusWaiting")}</span>
            </p>
            {done && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t(`comps2.newAgent.dotChecks.${key}.description`)}</p>}
          </div>
        </li>;
      })}
    </ol>
    <p role={state.problem && state.problem !== "prompt_unavailable" ? "alert" : "status"} aria-live="polite" className={cn("text-sm leading-relaxed", state.problem && state.problem !== "prompt_unavailable" ? "text-destructive" : "text-muted-foreground")}>{message}</p>
  </section>;
}

export type MuseConnectionState = {
  paired: boolean;
  receiverDetected: boolean;
  backgroundReplyVerified: boolean;
  ready: boolean;
  finishing?: boolean;
  testing?: boolean;
  problem?: "no_recent_response" | "prompt_unavailable" | "offline" | "agent_unavailable" | "disconnected" | "disabled" | "connection_expired";
};

/** Receiver contact is separate from an authenticated, independent worker reply. */
export function MuseConnectionChecks({ state }: { state: MuseConnectionState }) {
  const { t } = useTranslation();
  const milestones = [
    { title: t("comps2.newAgent.museChecks.pairedTitle"), done: state.paired, description: t("comps2.newAgent.museChecks.pairedDescription") },
    { title: t("comps2.newAgent.museChecks.receiverTitle"), done: state.receiverDetected, description: t("comps2.newAgent.museChecks.receiverDescription") },
    { title: t("comps2.newAgent.museChecks.replyTitle"), done: state.backgroundReplyVerified, description: t("comps2.newAgent.museChecks.replyDescription") },
  ];
  const checksPassed = milestones.every(item => item.done);
  const message = state.problem === "offline" ? t("comps2.newAgent.museMessage.offline")
    : state.problem === "disconnected" ? t("comps2.newAgent.museMessage.disconnected")
    : state.problem === "connection_expired" ? t("comps2.newAgent.museMessage.connectionExpired")
    : state.problem === "disabled" ? t("comps2.newAgent.museMessage.disabled")
    : state.problem === "prompt_unavailable" ? t("comps2.newAgent.museMessage.promptUnavailable")
    : state.problem === "agent_unavailable" ? t("comps2.newAgent.museMessage.agentUnavailable")
    : state.problem === "no_recent_response" ? t("comps2.newAgent.museMessage.noRecentResponse")
    : state.testing ? t("comps2.newAgent.museMessage.testing")
    : checksPassed && state.ready ? t("comps2.newAgent.museMessage.ready")
    : checksPassed ? t("comps2.newAgent.museMessage.checksPassed")
    : !state.paired ? t("comps2.newAgent.museMessage.notPaired")
    : !state.receiverDetected ? t("comps2.newAgent.museMessage.paired")
    : t("comps2.newAgent.museMessage.receiverDetected");
  return <section aria-label={t("comps2.newAgent.museChecksAria")} className="space-y-4">
    <ol className="space-y-4">
      {milestones.map(item => <li key={item.title} className="flex items-start gap-3">
        <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", item.done ? "bg-accent text-foreground" : "text-muted-foreground")}>
          {item.done ? <Check className="size-4" /> : <Circle className="size-4" />}
        </span>
        <div className="min-w-0 pt-0.5">
          <p className={cn("text-sm", item.done ? "font-medium" : "text-muted-foreground")}>
            {item.title}<span className="sr-only">{item.done ? t("comps2.newAgent.statusComplete") : t("comps2.newAgent.statusWaiting")}</span>
          </p>
          {item.done && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>}
        </div>
      </li>)}
    </ol>
    <p role="status" aria-live="polite" className="text-sm leading-relaxed text-muted-foreground">{message}</p>
  </section>;
}

/** Shared presentation for the invitation flow. The caller owns invitations and watching. */
export function ExternalAgentInviteContent({
  preset, prompt, companyName, connection, onSelect, onBack, onClose, onCopied, onRetry, onNewPrompt,
  dotDisabledReason, grokDisabledReason, busy = false, error, approvalHref, museEnabled = false, museConnection, museDraft, onMuseDraftChange, onMuseContinue,
}: {
  museEnabled?: boolean;
  museConnection?: MuseConnectionState;
  museDraft?: MuseInvitationDraft;
  onMuseDraftChange?: (draft: MuseInvitationDraft) => void;
  onMuseContinue?: () => void;
  dotDisabledReason?: string;
  grokDisabledReason?: string;
  busy?: boolean;
  error?: string;
  approvalHref?: string;
  preset: ExternalAgentPreset | null;
  prompt: string;
  companyName: string;
  connection: DotConnectionState;
  onSelect: (preset: ExternalAgentPreset) => void;
  onBack: () => void;
  onClose: () => void;
  onCopied: () => void;
  onRetry: () => void;
  onNewPrompt: () => void;
}) {
  const { t } = useTranslation();
  const detailsId = useId();
  const muse = preset === "muse";
  const museDetails = muse && !!museDraft;
  const museAwaitingInvitation = muse && !museDetails && !museConnection && !approvalHref;
  const museReady = muse && !!museConnection?.ready && museConnection.paired && museConnection.receiverDetected && museConnection.backgroundReplyVerified && !museConnection.problem && !museConnection.testing;
  const provider = presets.find(item => item.id === preset);
  const dot = preset === "dot";
  const ready = museReady || (dot && connection.phase === "ready" && !connection.problem);
  const connecting = dot && connection.phase !== "waiting";
  const progressLabel = connection.problem === "agent_unavailable" ? t("comps2.newAgent.progress.agentUnavailable")
    : connection.problem === "offline" ? t("comps2.newAgent.progress.updatesPaused")
    : connection.problem === "event_timeout" ? t("comps2.newAgent.progress.needsAttention")
    : connection.phase === "finishing" ? t("comps2.newAgent.progress.finishingSetup")
    : connection.phase === "connected" ? t("onboarding.connect.connecting") : t("comps2.newAgent.progress.confirmingConnection");
  return <>
    <div className="min-h-0 space-y-6 overflow-y-auto px-6 pb-6 pt-8 sm:px-8">
      <div className="space-y-3 pr-5">
        {muse && <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4" />{t("comps2.newAgent.back")}</Button>}
        {provider && <AdapterMark type={provider.adapter} className="size-10" />}
        <div className="space-y-2">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {!provider ? t("comps2.newAgent.title.inviteExternal") : muse ? ready ? t("comps2.newAgent.title.museConnected") : museDetails || museAwaitingInvitation ? t("comps2.newAgent.title.inviteMuse") : t("comps2.newAgent.title.connectMuse") : dot ? ready ? t("comps2.newAgent.title.dotConnected") : t("comps2.newAgent.title.connectDot") : preset === "hermes" ? t("comps2.newAgent.title.inviteHermes") : t("comps2.newAgent.title.inviteAgent")}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {!provider ? t("comps2.newAgent.description.noProvider", { companyName })
              : muse ? museDetails ? t("comps2.newAgent.description.museDetails", { companyName })
              : museAwaitingInvitation ? t("comps2.newAgent.description.museAwaiting")
              : ready ? t("comps2.newAgent.description.museReady", { companyName })
              : !prompt && !museConnection?.paired ? t("comps2.newAgent.description.museChecking")
              : t("comps2.newAgent.description.musePrompt")
              : ready ? t("comps2.newAgent.description.dotReady", { companyName })
              : connection.problem === "agent_unavailable" ? t("comps2.newAgent.description.dotAgentUnavailable")
              : connection.phase === "finishing" ? t("comps2.newAgent.description.dotFinishing")
              : connecting ? t("comps2.newAgent.description.dotConnecting")
              : dot ? t("comps2.newAgent.description.dotCopyPrompt")
              : t("comps2.newAgent.description.invitePrompt", { brand: preset === "hermes" ? "Hermes " : "" })}
          </DialogDescription>
        </div>
      </div>
      {error && <div role="alert" className="space-y-3 text-sm text-destructive"><p>{error}</p>{!museAwaitingInvitation && <Button variant="outline" disabled={busy} onClick={onRetry}>{t("agents.chatSidebar.tryAgain")}</Button>}</div>}
      {!provider ? <><ExternalAgentPresetPicker onSelect={onSelect} dotDisabledReason={dotDisabledReason} grokDisabledReason={grokDisabledReason} museEnabled={museEnabled} />
        {dotDisabledReason && <p className="text-sm text-muted-foreground">{dotDisabledReason}</p>}{grokDisabledReason && grokDisabledReason !== dotDisabledReason && <p className="text-sm text-muted-foreground">{grokDisabledReason}</p>}</>
        : approvalHref ? <p className="text-sm text-muted-foreground">{t("comps2.newAgent.approvalNeeded", { brand: muse ? "Muse" : "Dot" })}</p>
        : museAwaitingInvitation ? busy ? <p role="status" className="text-sm text-muted-foreground">{t("comps2.newAgent.loadingMuseInvitation")}</p> : null
        : muse && busy && !museDetails && !prompt && !museConnection?.paired ? <p role="status" className="text-sm text-muted-foreground">{t("comps2.newAgent.loadingMuseSetup")}</p>
        : museDetails ? <form id={detailsId} className="space-y-4" onSubmit={event => { event.preventDefault(); if (museDraft.name.trim() && !busy) onMuseContinue?.(); }}>
          <div className="space-y-2">
            <label htmlFor={`${detailsId}-name`} className="text-sm font-medium">{t("agentConfig.identity.namePlaceholder")}</label>
            <Input id={`${detailsId}-name`} disabled={busy} autoFocus maxLength={100} value={museDraft.name} placeholder="Muse" onChange={event => onMuseDraftChange?.({ ...museDraft, name: event.target.value })} />
          </div>
          <div className="space-y-2">
            <label htmlFor={`${detailsId}-role`} className="text-sm font-medium">{t("comps2.newAgent.role")}</label>
            <select id={`${detailsId}-role`} disabled={busy} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={museDraft.role} onChange={event => {
              const role = AGENT_ROLES.find(value => value === event.target.value);
              if (role) onMuseDraftChange?.({ ...museDraft, role });
            }}>{AGENT_ROLES.map(role => <option key={role} value={role}>{AGENT_ROLE_LABELS[role]}</option>)}</select>
          </div>
          <p className="text-xs text-muted-foreground">{t("comps2.newAgent.museToolsNote")}</p>
        </form>
        : muse && museConnection ? <>
          <MuseConnectionChecks state={museConnection} />
          {museConnection.problem === "no_recent_response" && <Button variant="outline" disabled={busy} onClick={onRetry}>{t("comps2.newAgent.testBackgroundReply")}</Button>}
          {museConnection.problem === "offline" && <Button variant="outline" disabled={busy} onClick={onRetry}>{t("comps2.newAgent.refreshConnection")}</Button>}
          {!museConnection.paired && <a href="https://muse.ai" target="_blank" rel="noopener noreferrer" className="inline-flex text-sm text-foreground underline underline-offset-4">{t("comps2.newAgent.openMuse")}</a>}
          <p className="text-xs text-muted-foreground">{t("comps2.newAgent.museLagNote")}</p>
        </>
        : busy && !prompt && connection.phase === "waiting" ? <p role="status" className="text-sm text-muted-foreground">{t("comps2.newAgent.preparingInvitation")}</p> : dot ? <>
        <div className="border-t pt-6"><DotConnectionChecks state={connection} />
          {connection.phase === "waiting" && <p className="mt-4 text-xs text-muted-foreground">{t("comps2.newAgent.dotAccountNote")}</p>}</div>
        {connection.problem === "event_timeout" && <Button variant="outline" disabled={busy} onClick={onRetry}>{t("comps2.newAgent.retryTestEvent")}</Button>}
        {connection.problem === "offline" && <Button variant="outline" disabled={busy} onClick={onRetry}>{t("comps2.newAgent.reconnectUpdates")}</Button>}
      </> : <p className="text-sm leading-relaxed text-muted-foreground">{t("comps2.newAgent.invitationNote", { companyName })}</p>}
    </div>
    <div className="flex items-center justify-between gap-3 border-t px-6 py-4 sm:px-8">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={muse ? onClose : provider ? onBack : onClose}>
          {provider && !muse && <ArrowLeft className="size-4" />}{muse ? ready ? t("comps2.newAgent.close") : t("comps2.newAgent.saveExit") : provider ? t("comps2.newAgent.back") : t("agentConfig.common.cancel")}
        </Button>
      </div>
      {provider && (approvalHref ? <Button asChild><Link to={approvalHref} onClick={onClose}>{t("comps2.newAgent.reviewApproval")}</Link></Button>
        : museDetails ? <Button type="submit" form={detailsId} disabled={busy || !museDraft.name.trim()}>{busy ? t("comps2.newAgent.preparing") : t("onboarding.footer.continue")}</Button>
        : ready ? <Button onClick={onClose}>{t("comps2.newAgent.done")}</Button>
        : museAwaitingInvitation ? <Button disabled={busy} onClick={onRetry}>{busy ? t("comps2.newAgent.loadingSetup") : t("comps2.newAgent.refreshSetup")}</Button>
        : muse ? museConnection?.problem === "disconnected" || museConnection?.problem === "connection_expired" ? <Button disabled={busy} onClick={onNewPrompt}>{t("comps2.newAgent.reconnectMuse")}</Button>
          : museConnection?.problem === "prompt_unavailable" ? <Button disabled={busy} onClick={onNewPrompt}>{t("comps2.newAgent.createNewPrompt")}</Button>
          : !museConnection?.paired && prompt ? <AgentSetupPrompt key={prompt} prompt={prompt} label={t("comps2.newAgent.copySetupPrompt")} title={t("comps2.newAgent.title.connectMuse")} agent={{ name: "Muse", icon: <Bot className="size-5" /> }} description={t("comps2.newAgent.musePromptDescription")} align="end" className="min-w-0 shrink" onCopied={onCopied} />
          : busy ? <Button disabled>{t("comps2.newAgent.preparing")}</Button>
          : <Button asChild><a href="https://muse.ai" target="_blank" rel="noopener noreferrer">{t("comps2.newAgent.openMuse")}</a></Button>
        : connecting ? <Button disabled aria-live="polite">
          {!connection.problem && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {progressLabel}
        </Button>
        : dot && connection.problem === "prompt_unavailable" ? <Button disabled={busy} onClick={onNewPrompt}>{t("comps2.newAgent.createNewPrompt")}</Button>
        : !prompt || busy ? <Button disabled>{busy ? t("comps2.newAgent.preparing") : t("comps2.newAgent.waitingForDot")}</Button>
        : <AgentSetupPrompt
          key={preset}
          prompt={prompt}
          label={dot ? t("comps2.newAgent.copySetupPrompt") : t("comps2.newAgent.copyInvitationPrompt")}
          title={dot ? t("comps2.newAgent.title.connectDot") : t("comps2.newAgent.title.inviteAgent")}
          description={dot ? t("comps2.newAgent.dotPromptDescription") : t("comps2.newAgent.agentPromptDescription")}
          agent={dot ? { name: "Dot", src: "/brands/adapters/openai-dot.svg" } : undefined}
          align="end"
          className="min-w-0 shrink"
          onCopied={onCopied}
        />)}
    </div>
  </>;
}
