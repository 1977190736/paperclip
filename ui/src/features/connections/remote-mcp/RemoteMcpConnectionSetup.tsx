import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, ExternalLink, HelpCircle, Loader2, Plus, Trash2 } from "lucide-react";
import { InlineBanner } from "@/components/InlineBanner";
import { ActionsSection } from "@/pages/apps/app-detail/PermissionsPanel";
import { SetupWizardFooter } from "@/components/SetupWizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RemoteMcpManagement } from "./RemoteMcpManagement";
import { remoteMcpProviderAuthHelp, remoteMcpProviderInstructions, remoteMcpProviderPlaceholder, remoteMcpProviderUrlHelp } from "./providers";
import { useTranslation } from "@/i18n";
import {
  AccessStepContent,
  ConnectionAccessDefaults,
  connectionDefaultSummarySentence,
  StepHeader,
} from "../ConnectionSetupFlow";
import type { RemoteMcpProvider } from "./providers";
import type { RemoteMcpSetupActions, RemoteMcpSetupState } from "./types";

/**
 * PAP-659 C0: the connect path is one screen. `access` is still a real screen,
 * but only as management after the connection exists — the way in states the
 * resolved default and puts its controls in the Advanced disclosure, the same
 * as every catalog connector.
 */
const steps = ["connect"] as const;
const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

function FieldHelp({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  return <Tooltip open={open} onOpenChange={setOpen}>
    <TooltipTrigger asChild><button type="button" aria-label={t("connections.remoteMcp.helpWith", { label })} onClick={() => setOpen(!open)} className="rounded-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><HelpCircle className="size-4" /></button></TooltipTrigger>
    <TooltipContent className="max-w-xs">{children}</TooltipContent>
  </Tooltip>;
}

/** Controlled presentation shared by provider setup, configuration imports and review stories.
 * Authentication, persistence and calls belong to the controller, never these views. */
export function RemoteMcpConnectionSetup({ provider, state: s, actions: a, agents, companyId, connectionId, fixedGrantKind, lockedAgentId, host = "page", authorizationUrl, upstreamServiceName, onCancel, additionalSettings, settingsValid = true }: {
  additionalSettings?: ReactNode;
  settingsValid?: boolean;
  companyId: string;
  onCancel?: () => void;
  upstreamServiceName?: string;
  host?: "page" | "dialog";
  lockedAgentId?: string;
  authorizationUrl?: string;
  provider: RemoteMcpProvider;
  connectionId: string;
  fixedGrantKind?: RemoteMcpSetupState["grantKind"];
  state: RemoteMcpSetupState;
  actions: RemoteMcpSetupActions;
  agents: { id: string; name: string }[];
}) {
  const uid = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const { t } = useTranslation();
  const previousStep = useRef(s.step);
  const [sessionOpen, setSessionOpen] = useState(() => Boolean(provider.defaultUrl && s.url !== provider.defaultUrl));
  useEffect(() => {
    if (previousStep.current !== s.step) heading.current?.focus();
    previousStep.current = s.step;
  }, [s.step]);
  const currentStep = steps.indexOf(s.step as typeof steps[number]);
  const busy = s.connectStatus === "connecting";
  const change = (patch: Partial<RemoteMcpSetupState>) => a.edit(patch);
  const external = (purpose: Parameters<typeof a.openProvider>[0], text: string) => <Button type="button" variant="link" className="h-auto p-0 text-sm text-current underline" onClick={() => a.openProvider(purpose)}>{text}<ExternalLink className="size-3.5" aria-hidden="true" /></Button>;
  const boundary = <InlineBanner compact>
    {t("connections.remoteMcp.boundaryPrefix")} {external("manage", provider.name)}.
  </InlineBanner>;
  const footer = (children: ReactNode) => <SetupWizardFooter onSaveExit={a.saveExit} disabled={busy}>{children}</SetupWizardFooter>;

  /**
   * The stated default and the one Advanced disclosure (PAP-659 C0).
   *
   * Step 1 of this work learned the lesson the hard way on Gmail: adding an
   * access disclosure beside a connector's existing "Advanced authentication"
   * panel leaves two of them on one screen, which is worse than the step it
   * replaced. So the provider's authentication settings are passed in here as
   * `extra` and share a single panel with the access controls.
   */
  // Deliberately not derived from `s.auth`. A gateway URL can carry a personal
  // token even when the method declares `auth: "none"`, so the shared-vs-mine
  // credential choice has to stay offered; deriving "none" here would silently
  // remove it and pin every Zapier connection to the organization.
  const authKind = "oauth";
  const defaults = (extra: ReactNode) => <ConnectionAccessDefaults
    companyId={companyId}
    {...(companyId ? {} : { agents })}
    sentence={connectionDefaultSummarySentence({
      grantKind: s.grantKind,
      authKind,
      installChoice: s.allAgents ? "all" : "specific",
      installCount: s.agentIds.length,
      lockedAgentId,
      preserveAgentAccess: s.setupComplete,
    })}
    extra={extra}
    // Something inside is load-bearing: the operator has already chosen a
    // non-default sign-in method, or the provider just rejected a credential.
    forceOpen={s.auth !== (provider.supportsBrowserAuth ? "auto" : "none") || s.connectStatus === "rejected"}
    disabled={busy}
    authKind={authKind}
    grantKinds={fixedGrantKind ? [fixedGrantKind] : undefined}
    grantKind={s.grantKind}
    setGrantKind={(grantKind) => { if (grantKind !== "agent") change({ grantKind }); }}
    installChoice={s.allAgents ? "all" : "specific"}
    setInstallChoice={(choice) => change({ allAgents: choice === "all" })}
    installAgentIds={new Set(s.agentIds)}
    setInstallAgentIds={(ids) => change({ agentIds: [...ids] })}
    lockedAgentId={lockedAgentId}
    preserveAgentAccess={s.setupComplete}
  />;

  const error = s.connectStatus === "invalid_url" ? { title: t("connections.remoteMcp.errors.invalidUrl.title"), body: t("connections.remoteMcp.errors.invalidUrl.body") }
    : s.connectStatus === "oauth_failed" ? { title: t("connections.remoteMcp.errors.oauthFailed.title", { provider: provider.name }), body: t("connections.remoteMcp.errors.oauthFailed.body") }
    : s.connectStatus === "rejected" ? { title: t("connections.remoteMcp.errors.rejected.title"), body: t("connections.remoteMcp.errors.rejected.body", { provider: provider.name }) }
    : s.connectStatus === "unreachable" ? { title: t("connections.remoteMcp.errors.unreachable.title"), body: t("connections.remoteMcp.errors.unreachable.body") }
    : null;
  const urlField = <div className="space-y-2">
    <div className="flex items-center gap-2"><Label htmlFor={`${uid}-url`}>{t("connections.remoteMcp.serverUrl")}</Label><FieldHelp label={t("connections.remoteMcp.serverUrl")}>{remoteMcpProviderUrlHelp(provider.id)}</FieldHelp></div>
    <Input id={`${uid}-url`} type="password" autoComplete="off" spellCheck={false} placeholder={remoteMcpProviderPlaceholder(provider.id)} value={s.url} aria-invalid={s.connectStatus === "invalid_url"} aria-describedby={`${uid}-url-help`} onChange={(event) => change({ url: event.target.value })} />
    <p id={`${uid}-url-help`} className="text-xs text-muted-foreground">{remoteMcpProviderUrlHelp(provider.id)}</p>
    {provider.id === "executor" ? <div className="space-y-2"><div className="flex items-center gap-2"><Label htmlFor={`${uid}-management`}>{t("connections.remoteMcp.consoleUrl")}</Label>
      <FieldHelp label={t("connections.remoteMcp.consoleUrl")}>{t("connections.remoteMcp.consoleUrlHelp")}</FieldHelp></div>
      <Input id={`${uid}-management`} type="url" value={s.managementUrl ?? ""} placeholder="https://executor.sh/your-organization/integrations" onChange={event => change({ managementUrl: event.target.value })} />
    </div> : null}
  </div>;

  return <div className={host === "dialog" ? "min-w-0 text-foreground" : "mx-auto max-w-6xl p-4 text-foreground sm:p-8"} data-remote-mcp-provider={provider.id}>
    <StepHeader headingRef={heading} appIdentity={{ name: provider.name, logoUrl: null }}
      title={upstreamServiceName ? t("connections.remoteMcp.connectThrough", { service: upstreamServiceName, provider: provider.name }) : s.step === "draft" ? t("connections.remoteMcp.continueSetup") : s.setupComplete ? s.step === "access" ? t("connections.remoteMcp.whoCanUse") : s.step === "connect" ? t("connections.remoteMcp.reconnectTitle", { provider: provider.name }) : provider.name : undefined}
      subtitle={currentStep >= 0 && !s.setupComplete ? t("connections.remoteMcp.useOnYourBehalf", { provider: provider.name }) : s.step === "draft" ? t("connections.remoteMcp.draftReadyToResume", { provider: provider.name }) : s.step === "permissions" ? t("connections.remoteMcp.connectedActions", { identity: s.identity ? ` ${t("connections.remoteMcp.asIdentity", { identity: s.identity })}` : "", actions: s.tools.length }) : t("connections.remoteMcp.manageConnection", { provider: provider.name })}
      step={currentStep >= 0 && !s.setupComplete ? "key" : "gallery"} activeIndex={currentStep} labels={steps.map(() => t("connections.remoteMcp.connect"))} onCancel={busy || s.step === "management" || s.step === "permissions" || s.step === "draft" ? undefined : onCancel ?? a.saveExit} />
    <main className="space-y-6">
        {upstreamServiceName && <InlineBanner compact>{t("connections.remoteMcp.upstreamHandled", { provider: provider.name, service: upstreamServiceName })} {provider.id === "composio" ? t("connections.remoteMcp.composioSignIn") : t("connections.remoteMcp.manageAppSignIn")}</InlineBanner>}
        {s.notice && <p role="status" className="text-sm text-muted-foreground">{s.notice}</p>}

        {s.step === "access" && <AccessStepContent agents={agents} lockedAgentId={lockedAgentId} authKind="oauth" grantKinds={fixedGrantKind ? [fixedGrantKind] : undefined} grantKind={s.grantKind} setGrantKind={(grantKind) => { if (grantKind !== "agent") change({ grantKind }); }}
          installChoice={s.allAgents ? "all" : "specific"} setInstallChoice={(choice) => change({ allAgents: choice === "all" })}
          installAgentIds={new Set(s.agentIds)} setInstallAgentIds={(ids) => change({ agentIds: [...ids] })}
          submitLabel={s.setupComplete ? t("connections.remoteMcp.done") : t("connections.remoteMcp.continue")} onBack={s.setupComplete ? a.finish : a.saveExit} onContinue={s.setupComplete ? a.finish : () => a.navigate("connect")} />}
        {s.step === "permissions" && <>
          <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">{t("connections.remoteMcp.permissions")}</h2><Button variant="outline" onClick={a.finish}>{t("connections.remoteMcp.connectionSettings")}</Button></div>
          {s.tools.some((entry) => entry.broad) && boundary}
          <ActionsSection connectionId={connectionId} appName={provider.name}
            readOnly={s.tools.filter((entry) => entry.isReadOnly)} canChange={s.tools.filter((entry) => !entry.isReadOnly)} quarantined={[]}
            enabledIds={new Set(s.tools.filter((entry) => s.permissions[entry.id] !== "off").map((entry) => entry.id))}
            askFirstIds={new Set(s.tools.filter((entry) => s.permissions[entry.id] === "ask_first").map((entry) => entry.id))}
            disabled={!s.connected} refreshPending={s.refreshing} canConfigure
            onSetPermission={(ids, next) => change({ permissions: { ...s.permissions, ...Object.fromEntries(ids.map((id) => [id, next === "ask" ? "ask_first" : next])) } })}
            onReviewQuarantined={() => {}} onRefreshActions={a.refresh} />
        </>}
        <div className="mx-auto max-w-2xl space-y-6">
        {s.step === "connect" && <>
          <div className="space-y-3">
            <ol className="list-decimal space-y-2 pl-5 text-sm">{remoteMcpProviderInstructions(provider.id).map((instruction, index) => <li key={index}>{instruction}</li>)}</ol>
            {external("setup", t("connections.remoteMcp.openSetupGuide", { provider: provider.name }))}
          </div>
          {s.connectStatus === "sign_in" && provider.supportsBrowserAuth ? <>
            <div role="status"><InlineBanner title={t("connections.remoteMcp.finishSigningIn", { provider: provider.name })}>
              {t("connections.remoteMcp.completeSignIn")}
            </InlineBanner></div>
            <p className="text-sm text-muted-foreground">{t("connections.remoteMcp.windowNotOpened")} {authorizationUrl ? <a className="text-current underline" href={authorizationUrl} onClick={() => a.openProvider("sign_in")} target="_blank" rel="noopener noreferrer">{t("connections.remoteMcp.openSignInAgain")}</a> : external("sign_in", t("connections.remoteMcp.openSignInAgain"))}.</p>
            {footer(<><Button variant="outline" onClick={a.cancelConnect}>{t("connections.remoteMcp.cancelSignIn")}</Button><Button disabled>{t("connections.remoteMcp.waitingForSignIn")}</Button></>)}
          </> : <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); a.connect(); }}>
            {error && <div role="alert"><InlineBanner tone="danger" title={error.title}>{error.body}</InlineBanner></div>}
            {s.connectStatus === "cancelled" && <p role="status" className="text-sm text-muted-foreground">{t("connections.remoteMcp.cancelledNotice")}</p>}
            <fieldset disabled={busy} className="min-w-0 space-y-5">
              {provider.defaultUrl ? <Collapsible open={sessionOpen || s.connectStatus === "invalid_url"} onOpenChange={setSessionOpen}>
                <CollapsibleTrigger asChild><Button type="button" variant="link" className="h-auto p-0 text-sm text-muted-foreground underline underline-offset-2">{t("connections.remoteMcp.reuseExistingSession")}</Button></CollapsibleTrigger>
                <CollapsibleContent className="mt-3">{urlField}</CollapsibleContent>
              </Collapsible> : urlField}
              {defaults(<div className="space-y-4">
                  <p className="text-sm font-medium text-foreground">{t("connections.remoteMcp.authentication")}</p>
                  <p className="text-sm text-muted-foreground">{remoteMcpProviderAuthHelp(provider.id)}</p>
                  <div className="space-y-2"><Label htmlFor={`${uid}-auth`}>{t("connections.remoteMcp.signInMethod")}</Label><select id={`${uid}-auth`} className={selectClass} value={s.auth} onChange={(event) => change({ auth: event.target.value as RemoteMcpSetupState["auth"] })}>
                    {provider.supportsBrowserAuth && <option value="auto">{t("connections.remoteMcp.authOptions.auto")}</option>}<option value="bearer">{t("connections.remoteMcp.authOptions.bearer")}</option><option value="headers">{t("connections.remoteMcp.authOptions.headers")}</option><option value="none">{t("connections.remoteMcp.authOptions.none")}</option>
                  </select></div>
                  {s.auth === "bearer" && <div className="space-y-2"><div className="flex items-center gap-2"><Label htmlFor={`${uid}-token`}>{t("connections.remoteMcp.bearerToken")}</Label><FieldHelp label={t("connections.remoteMcp.bearerToken")}>{t("connections.remoteMcp.bearerTokenHelp")}</FieldHelp></div><Input id={`${uid}-token`} type="password" autoComplete="off" value={s.token} onChange={(event) => change({ token: event.target.value })} /></div>}
                  {(s.auth === "bearer" || s.auth === "headers") && <div className="space-y-3">
                    <p className="text-sm font-medium">{s.auth === "bearer" ? t("connections.remoteMcp.additionalHeaders") : t("connections.remoteMcp.headers")}</p>
                    {s.headers.map((header, index) => <div key={header.id} className="flex flex-wrap items-end gap-2">
                      <div className="min-w-0 flex-1 space-y-2"><Label htmlFor={`${uid}-${header.id}-name`}>{t("connections.remoteMcp.headerName", { index: index + 1 })}</Label><Input id={`${uid}-${header.id}-name`} value={header.name} placeholder={provider.id === "arcade" ? "Arcade-User-ID" : t("connections.remoteMcp.headerNamePlaceholder")} onChange={(event) => change({ headers: s.headers.map((h) => h.id === header.id ? { ...h, name: event.target.value } : h) })} /></div>
                      <div className="min-w-0 flex-1 space-y-2"><Label htmlFor={`${uid}-${header.id}-value`}>{t("connections.remoteMcp.headerValue", { index: index + 1 })}</Label><Input id={`${uid}-${header.id}-value`} type="password" autoComplete="off" value={header.value} onChange={(event) => change({ headers: s.headers.map((h) => h.id === header.id ? { ...h, value: event.target.value } : h) })} /></div>
                      <Button type="button" variant="ghost" size="icon" aria-label={t("connections.remoteMcp.removeHeader", { index: index + 1 })} onClick={() => change({ headers: s.headers.filter((h) => h.id !== header.id) })}><Trash2 className="size-4" /></Button>
                    </div>)}
                    <Button type="button" variant="outline" size="sm" onClick={() => change({ headers: [...s.headers, { id: crypto.randomUUID(), name: "", value: "" }] })}><Plus className="size-4" />{t("connections.remoteMcp.addHeader")}</Button>
                  </div>}
                </div>)}
            </fieldset>
            {additionalSettings}
            {busy && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" />{t("connections.remoteMcp.connectingDiscovering")}</p>}
            {footer(<>{s.setupComplete ? <Button type="button" variant="outline" disabled={busy} onClick={a.finish}>{t("connections.remoteMcp.back")}</Button> : <span />}<Button type="submit" disabled={busy || !s.url.trim() || !settingsValid}>{busy ? t("connections.remoteMcp.connecting") : error || s.connectStatus === "cancelled" ? t("connections.remoteMcp.tryAgain") : t("connections.remoteMcp.connectProvider", { provider: provider.name })}</Button></>)}
          </form>}
        </>}

        {s.step === "management" && <>
          {!s.connected ? <InlineBanner tone="warning" title={t("connections.remoteMcp.disconnected")}>{t("connections.remoteMcp.disconnectedBody")}</InlineBanner> : <div className="space-y-2"><p className="flex items-center gap-2 text-sm"><CheckCircle2 className="size-4" />{t("connections.remoteMcp.connectedAs", { identity: s.identity ? ` ${t("connections.remoteMcp.asIdentity", { identity: s.identity })}` : "" })}</p><p className="text-sm text-muted-foreground">{s.grantKind === "user" ? t("connections.remoteMcp.justMe") : t("connections.remoteMcp.anyHuman")} · {t("connections.remoteMcp.toolsCount", { tools: s.tools.length })} · {s.allAgents ? t("connections.remoteMcp.anyAgent") : t("connections.remoteMcp.agentsWithAccess", { agents: s.agentIds.length })}</p></div>}
          <div className="flex flex-wrap gap-2"><Button onClick={() => a.navigate("access")}>{t("connections.remoteMcp.whoCanUse")}</Button><Button variant="outline" disabled={!s.connected} onClick={() => a.navigate("permissions")}>{t("connections.remoteMcp.permissions")}</Button></div>
          <p className="text-sm text-muted-foreground">{t("connections.remoteMcp.refreshCatalog", { provider: provider.name })}</p>
          <Button variant="outline" disabled={!s.connected || s.refreshing} onClick={a.refresh}>{s.refreshing ? t("connections.remoteMcp.refreshing") : t("connections.remoteMcp.refreshTools")}</Button>
          <RemoteMcpManagement providerName={provider.name} connected={s.connected} onReconnect={a.reconnect} onManage={() => a.openProvider("manage")} onDisconnect={a.disconnect} />
        </>}
        {s.step === "draft" && <><p className="text-sm">{t("connections.remoteMcp.draftKept")}</p><div className="flex justify-end"><Button onClick={a.resumeDraft}>{t("connections.remoteMcp.resumeSetup")}</Button></div></>}
        </div>
    </main>
  </div>;
}
