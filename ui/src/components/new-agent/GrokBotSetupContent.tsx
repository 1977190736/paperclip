import { useId } from "react";
import { Check, Circle, Loader2 } from "lucide-react";
import { AGENT_ROLES, type CreateGrokInvitation, type DotPairing, type GrokConnection } from "@paperclipai/shared";
import { AdapterMark } from "../AdapterMark";
import { AgentSetupPrompt } from "../AgentSetupPrompt";
import { Button, buttonVariants } from "../ui/button";
import { CopyText } from "../CopyText";
import { Input } from "../ui/input";
import { NativeSelect } from "../ui/select";
import { DialogDescription, DialogTitle } from "../ui/dialog";
import { buildGrokAccessPrompt, buildGrokRoutinePrompt } from "@/lib/grok-bot-setup-prompt";
import { Link } from "@/lib/router";
import { useTranslation } from "@/i18n";

export type GrokSetupStep = 0 | 1 | 2 | 3;
export interface GrokBotSetupContentProps {
  step: GrokSetupStep; companyName: string; details: CreateGrokInvitation;
  created: boolean; loading?: boolean; busy?: boolean; error?: string;
  managers: Array<{ id: string; name: string }>;
  connection?: GrokConnection; pairing: DotPairing | null; approvalHref?: string;
  webhookUrl: string; webhookKey: string; editingCredentials?: boolean;
  onEditCredentials?: () => void;
  onDetails: (details: CreateGrokInvitation) => void;
  onCredentials: (url: string, key: string) => void;
  onBack: () => void; onExit: () => void; onNext: () => void; onRetry: () => void;
}
const steps = ["identify", "access", "enable", "verify"] as const;
export function GrokBotSetupContent(p: GrokBotSetupContentProps) {
  const { t } = useTranslation();
  const pairingCodeId = useId();
  const binding = p.connection?.binding;
  const routine = binding?.routine;
  const exchange = routine?.lastExchange;
  const delivered = exchange?.status === "accepted" || exchange?.status === "acknowledged";
  const replied = !!routine?.verified && exchange?.status === "acknowledged";
  const ready = replied && p.connection?.agentLifecycleState === "ready" && !!p.connection.canConfigureConnection && !routine?.recoveryNeeded;
  const pending = exchange && ["prepared", "sending", "accepted"].includes(exchange.status) && Date.parse(exchange.expiresAt) > Date.now();
  const nextDisabled = p.busy || p.loading || !!p.approvalHref
    || p.step === 0 && (!p.details.name.trim() || !p.details.botName.trim())
    || p.step === 1 && !binding?.connected
    || p.step === 2 && ((!routine?.configured || p.editingCredentials) && (!p.webhookUrl || !p.webhookKey))
    || p.step === 3 && !ready && (!!pending || !!routine?.recoveryNeeded || !!replied);
  return <>
    <div className="min-h-0 space-y-6 overflow-y-auto px-6 pb-6 pt-8 sm:px-8">
      <div className="space-y-3 pr-5">
        <AdapterMark type="grok_bot" className="size-10" />
        <DialogTitle className="text-xl font-semibold tracking-tight">{ready ? t("comps2.grok.title.ready") : t("comps2.grok.title.connect")}</DialogTitle>
        <DialogDescription className="text-sm leading-relaxed">{ready ? t("comps2.grok.description.ready", { botName: p.details.botName, companyName: p.companyName }) : t("comps2.grok.description.connect", { companyName: p.companyName })}</DialogDescription>
      </div>
      <ol aria-label={t("comps2.grok.stepsAria")} className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
        {steps.map((label, index) => <li key={label} aria-current={p.step === index ? "step" : undefined} className={p.step === index ? "font-medium text-foreground" : ""}>{index + 1}. {t(`comps2.grok.steps.${label}`)}</li>)}
      </ol>
      {p.error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{p.error}</p><Button variant="outline" disabled={p.busy} onClick={p.onRetry}>{t("agents.chatSidebar.tryAgain")}</Button></div>}
      {p.loading ? <p role="status" className="text-sm text-muted-foreground">{t("comps2.grok.restoring")}</p> : p.approvalHref ? <p className="text-sm text-muted-foreground">{t("comps2.grok.approvalNeeded")}</p> : <>
        {p.step === 0 && <div className="space-y-4">
          <label className="block space-y-2 text-sm"><span>{t("comps2.grok.paperclipName")}</span><Input value={p.details.name} disabled={p.created} onChange={e => p.onDetails({ ...p.details, name: e.target.value })} autoComplete="off" maxLength={100} /></label>
          <label className="block space-y-2 text-sm"><span>{t("comps2.grok.botNameInGrok")}</span><Input value={p.details.botName} disabled={p.created} onChange={e => p.onDetails({ ...p.details, botName: e.target.value })} autoComplete="off" maxLength={100} /></label>
          <p className="text-xs text-muted-foreground">{t("comps2.grok.botNameNote")}</p>
          <label className="block space-y-2 text-sm"><span>{t("comps2.newAgent.role")}</span><NativeSelect disabled={p.created} value={p.details.role ?? "general"} onChange={e => p.onDetails({ ...p.details, role: e.target.value as CreateGrokInvitation["role"] })}>{AGENT_ROLES.map(role => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}</NativeSelect></label>
          <label className="block space-y-2 text-sm"><span>{t("comps2.grok.manager")}</span><NativeSelect disabled={p.created} value={p.details.reportsTo ?? ""} onChange={e => p.onDetails({ ...p.details, reportsTo: e.target.value || null })}><option value="">{t("comps2.grok.noManager")}</option>{p.managers.map(manager => <option key={manager.id} value={manager.id}>{manager.name}</option>)}</NativeSelect></label>
        </div>}
        {p.step === 1 && <div className="space-y-4 text-sm">
          <p>{t("comps2.grok.connectIntro")}</p>
          {p.connection?.resourceUrl && <AgentSetupPrompt prompt={buildGrokAccessPrompt(p.connection.resourceUrl, p.details.botName)} label={t("comps2.grok.copyConnectionInstructions")} title={t("comps2.grok.connectAccessTitle")} description={t("comps2.grok.connectAccessDescription")} />}
          {!binding?.connected && p.pairing && <div className="space-y-2">
            <label htmlFor={pairingCodeId}>{t("comps2.grok.pairingCode")}</label>
            <div className="flex items-center gap-2">
              <Input id={pairingCodeId} value={p.pairing.pairingCode} readOnly type="password" autoComplete="off" />
              <CopyText text={p.pairing.pairingCode} ariaLabel={t("comps2.grok.copyPairingCodeAria")} className={buttonVariants({ variant: "outline", size: "sm" })}>{t("comps2.grok.copyCode")}</CopyText>
            </div>
            <p className="text-xs text-muted-foreground">{t("comps2.grok.pairingCodeNote", { time: new Date(p.pairing.expiresAt).toLocaleTimeString() })}</p>
          </div>}
          <p role="status" aria-live="polite" className="text-muted-foreground">{binding?.connected ? t("comps2.grok.accessConnected") : t("comps2.grok.watchingAuthorization")}</p>
          <p className="text-xs text-muted-foreground">{t("comps2.grok.pluginsAccountWide")}</p>
        </div>}
        {p.step === 2 && <div className="space-y-4 text-sm">
          <p>{t("comps2.grok.routineIntro")}</p>
          {binding && <AgentSetupPrompt prompt={buildGrokRoutinePrompt(binding.id, p.details.botName)} label={t("comps2.grok.copyRoutineInstructions")} title={t("comps2.grok.steps.enable")} description={t("comps2.grok.routineDescription")} />}
          <p className="text-xs text-muted-foreground">{t("comps2.grok.routineClickNote")}</p>
          {routine?.configured && !p.editingCredentials && !p.webhookUrl && !p.webhookKey ? <div className="space-y-2"><p role="status" className="text-muted-foreground">{t("comps2.grok.credentialsStored")}</p>{p.onEditCredentials && <Button variant="outline" onClick={p.onEditCredentials} disabled={p.busy}>{t("comps2.grok.replaceCredentials")}</Button>}</div> : <>
            <label className="block space-y-2"><span>{t("onboarding.connect.webhookUrl")}</span><Input value={p.webhookUrl} onChange={e => p.onCredentials(e.target.value, p.webhookKey)} type="password" autoComplete="off" spellCheck={false} /></label>
            <label className="block space-y-2"><span>{t("comps2.grok.webhookKey")}</span><Input value={p.webhookKey} onChange={e => p.onCredentials(p.webhookUrl, e.target.value)} type="password" autoComplete="off" spellCheck={false} /></label>
          </>}
          <p className="text-xs text-muted-foreground">{t("comps2.grok.credentialsNote")}</p>
        </div>}
        {p.step === 3 && <section aria-label={t("comps2.grok.checksAria")} className="space-y-4 text-sm">
          {[{ label: t("comps2.grok.checkDelivered"), done: delivered }, { label: t("comps2.grok.checkReply"), done: replied }].map(check => <p key={check.label} className="flex items-center gap-3">{check.done ? <Check className="size-4" /> : pending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <Circle className="size-4 text-muted-foreground" />}{check.label}<span className="text-muted-foreground">{check.done ? t("comps2.grok.complete") : t("comps2.grok.waiting")}</span></p>)}
          <p role="status" aria-live="polite" className="text-muted-foreground">{routine?.recoveryNeeded ? t("comps2.grok.status.recovery") : ready ? t("comps2.grok.status.ready") : replied ? t("comps2.grok.status.replied") : exchange?.status === "rejected" ? t("comps2.grok.status.rejected") : delivered ? t("comps2.grok.status.delivered") : t("comps2.grok.status.challenge")}</p>
          <p className="text-xs text-muted-foreground">{t("comps2.grok.externalNote")}</p>
        </section>}
      </>}
    </div>
    <div className="flex items-center justify-between gap-3 border-t px-6 py-4 sm:px-8">
      <div className="flex items-center gap-2"><Button variant="ghost" onClick={p.onBack} disabled={p.busy}>{t("comps2.newAgent.back")}</Button><Button variant="ghost" onClick={p.onExit} disabled={p.busy}>{t("comps2.newAgent.saveExit")}</Button></div>
      {p.approvalHref ? <Button asChild><Link to={p.approvalHref} onClick={p.onExit}>{t("comps2.newAgent.reviewApproval")}</Link></Button> : <Button onClick={p.onNext} disabled={nextDisabled}>{p.busy ? t("comps2.grok.saving") : ready ? t("comps2.newAgent.done") : p.step === 3 ? pending ? t("comps2.grok.waitingForReply") : replied ? t("comps2.newAgent.progress.finishingSetup") : t("comps2.grok.verifyConnection") : t("onboarding.footer.continue")}</Button>}
    </div>
  </>;
}
