import { useState } from "react";
import { AlertTriangle, CircleHelp, ExternalLink, Loader2 } from "lucide-react";
import type { ChatEndpoint } from "@/api/chatEndpoints";
import { chatEndpointsApi } from "@/api/chatEndpoints";
import { CopyText } from "@/components/CopyText";
import { SetupWizardFooter } from "@/components/SetupWizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "@/lib/router";
import { gitHubAppSettingsUrl } from "./GitHubAppIdentity";
import { useTranslation } from "@/i18n";

export function GitHubConnectionRecoveryNotice({ endpoint }: { endpoint: ChatEndpoint }) {
  const { t } = useTranslation();
  if (!["attention", "revoked"].includes(endpoint.status)) return null;
  return (
    <section aria-label={t("apps.chat.githubRecovery.noticeAria")} className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
      <div className="min-w-0 space-y-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">{endpoint.status === "revoked" ? t("apps.chat.githubRecovery.disconnectedTitle") : t("apps.chat.githubRecovery.needsRepairTitle")}</h2>
          <p className="text-sm">{t("apps.chat.githubRecovery.noticeBody")}</p>
        </div>
        <Button asChild><Link to={`/apps/chat/connect?provider=github&resume=${endpoint.id}&reconnect=1`}>{t("apps.chat.githubRecovery.reconnectGitHub")}</Link></Button>
        {(endpoint.lastError || endpoint.healthMessage) && <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">{t("apps.chat.githubRecovery.connectionDetails")}</summary>
          <p className="mt-2 break-words">{endpoint.lastError ?? endpoint.healthMessage}</p>
        </details>}
      </div>
    </section>
  );
}

export const GITHUB_APP_CREDENTIAL_FIELDS = ["privateKey", "webhookSecret", "clientSecret"] as const;
export type GitHubAppCredentialField = typeof GITHUB_APP_CREDENTIAL_FIELDS[number];
export type GitHubAppCredentials = { appId: string; privateKey: string; webhookSecret: string; clientSecret?: string };

function CredentialLabel({ id, label, help }: { id: string; label: string; help: string }) {
  const { t } = useTranslation();
  return <div className="flex items-center gap-1.5">
    <Label htmlFor={id}>{label}</Label>
    <Tooltip><TooltipTrigger asChild><button type="button" aria-label={t("apps.chat.githubRecovery.helpAria", { label })} className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
      <CircleHelp className="size-3.5" aria-hidden="true" />
    </button></TooltipTrigger><TooltipContent className="max-w-xs">{help}</TooltipContent></Tooltip>
  </div>;
}

export function GitHubAppRecovery({ endpoint, reconnect, credentialFields, requireAllCredentialFields = false, rotateWebhookSecret = false, rotationAlreadyCommitted = false, onConnect, onExit }: {
  endpoint: ChatEndpoint;
  reconnect: boolean;
  credentialFields?: readonly GitHubAppCredentialField[];
  requireAllCredentialFields?: boolean;
  rotateWebhookSecret?: boolean;
  rotationAlreadyCommitted?: boolean;
  onConnect: (credentials?: GitHubAppCredentials) => Promise<void>;
  onExit: () => void;
}) {
  const { t } = useTranslation();
  const [replace, setReplace] = useState(!!credentialFields || !reconnect);
  const [credentials, setCredentials] = useState<GitHubAppCredentials>({ appId: endpoint.botExternalId ?? "", privateKey: "", webhookSecret: "" });
  const [privateKeyDraft, setPrivateKeyDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fileError, setFileError] = useState("");
  const [rotationSecret, setRotationSecret] = useState("");
  const [rotationGeneration, setRotationGeneration] = useState<string | null>(null);
  const [rotationUncertain, setRotationUncertain] = useState(false);
  const needsPrivateKey = !credentialFields || credentialFields.includes("privateKey");
  const needsWebhookSecret = credentialFields ? credentialFields.includes("webhookSecret") : !reconnect && !["active", "paused", "revoked"].includes(endpoint.status);
  const appName = endpoint.botLabel ?? endpoint.setup?.github?.appName ?? t("apps.chat.githubRecovery.existingAppFallback");
  const appIdInvalid = !!credentials.appId.trim() && !/^\d+$/.test(credentials.appId.trim());
  const keyInvalid = !!credentials.privateKey.trim() && !/-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(credentials.privateKey);
  const keyLoaded = !!credentials.privateKey.trim() && !keyInvalid && !privateKeyDraft;
  const incomplete = credentialFields
    ? !credentialFields.length || appIdInvalid || keyInvalid || (requireAllCredentialFields
      ? credentialFields.some(field => !credentials[field]?.trim())
      : credentialFields.every(field => !credentials[field]?.trim()))
    : replace && (!credentials.appId.trim() || !credentials.privateKey.trim() || appIdInvalid || keyInvalid || (needsWebhookSecret && !credentials.webhookSecret.trim()));
  const actionLabel = pending ? t("apps.chat.githubRecovery.checking") : replace ? (reconnect ? t("apps.chat.githubRecovery.verifyReconnect") : t("apps.chat.githubRecovery.connectExisting")) : t("apps.chat.githubRecovery.reconnectSaved");
  async function connect() {
    setPending(true);
    setError("");
    try { await onConnect(replace ? credentials : undefined); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t("apps.chat.githubRecovery.reconnectErrorFallback")); }
    finally { setPending(false); }
  }
  async function checkSavedRotation(expected: string | null | undefined) {
    try {
      const saved = await chatEndpointsApi.get(endpoint.id);
      if (expected !== undefined && (saved.setup?.credentialRotationId ?? null) === expected) {
        setRotationUncertain(false);
        return true;
      }
      setRotationSecret("");
      setRotationGeneration(null);
      setError(t("apps.chat.githubRecovery.rotationMissing"));
    } catch {
      // A failed status read cannot establish that the earlier secret is current.
    }
    setRotationUncertain(true);
    return false;
  }
  async function generateSecret() {
    const previousGeneration = rotationGeneration ?? (rotationSecret ? undefined : endpoint.setup?.credentialRotationId ?? null);
    setPending(true);
    setError("");
    try {
      const result = await chatEndpointsApi.generateSetupSecret(endpoint.id);
      setRotationSecret(result.webhookSecret);
      setRotationGeneration(result.credentialRotationId ?? null);
      setRotationUncertain(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("apps.chat.githubRecovery.generateErrorFallback"));
      setRotationUncertain(true);
      await checkSavedRotation(previousGeneration);
    }
    finally { setPending(false); }
  }
  return <div className="space-y-6">
    {reconnect && <div className="space-y-3">
      <p className="text-sm">{t("apps.chat.githubRecovery.restorePrefix")} <strong>{appName}</strong>{t("apps.chat.githubRecovery.restoreSuffix")}</p>
      <p className="text-sm text-muted-foreground">{t("apps.chat.githubRecovery.staysAttached")}</p>
    </div>}
    {rotateWebhookSecret && <section aria-label={t("apps.chat.githubRecovery.rotationAria")} className="space-y-3">
      <h2 className="text-base font-semibold">{t("apps.chat.githubRecovery.rotationTitle")}</h2>
      <p className="text-sm">{rotationAlreadyCommitted ? t("apps.chat.githubRecovery.rotationCommitted") : <>{t("apps.chat.githubRecovery.rotationIntroPrefix")} <a href={gitHubAppSettingsUrl(endpoint)} target="_blank" rel="noreferrer" className="underline">{t("apps.chat.githubRecovery.githubAppSettingsLink")}</a>{t("apps.chat.githubRecovery.rotationIntroSuffix")}</>}</p>
      <p className="text-sm text-muted-foreground">{t("apps.chat.githubRecovery.rotationWarning")}</p>
      <Button type="button" variant="outline" disabled={pending} onClick={() => void generateSecret()}>{rotationSecret || rotationAlreadyCommitted ? t("apps.chat.githubRecovery.generateAnother") : t("apps.chat.githubRecovery.generateSecret")}</Button>
      {rotationUncertain && <p role="status" className="text-sm">{t("apps.chat.githubRecovery.rotationUnconfirmed")}</p>}
      {rotationUncertain && rotationSecret && <Button type="button" variant="outline" disabled={pending} onClick={async () => {
        setPending(true);
        try { if (await checkSavedRotation(rotationGeneration ?? undefined)) setError(""); }
        finally { setPending(false); }
      }}>{t("apps.chat.githubRecovery.checkSavedStatus")}</Button>}
      {rotationSecret && !rotationUncertain && <div className="space-y-2">
        <Label htmlFor="github-rotation-secret">{t("apps.chat.githubRecovery.newSecretLabel")}</Label>
        <Input id="github-rotation-secret" type="password" autoComplete="off" disabled={pending} readOnly value={rotationSecret} />
        {!pending && <CopyText text={rotationSecret} ariaLabel={t("apps.chat.githubRecovery.copySecret")} className="text-sm underline">{t("apps.chat.githubRecovery.copySecret")}</CopyText>}
      </div>}
    </section>}
    {error && <div role="alert" className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
      <p className="font-medium">{rotateWebhookSecret ? t("apps.chat.githubRecovery.rotationFailedTitle") : replace ? t("apps.chat.githubRecovery.reconnectAppFailedTitle") : t("apps.chat.githubRecovery.reconnectSavedFailedTitle")}</p>
      <p className="break-words">{error}</p>
      <p>{rotateWebhookSecret ? t("apps.chat.githubRecovery.rotationFailedHint") : t("apps.chat.githubRecovery.reconnectFailedHint")}</p>
    </div>}
    {reconnect && !rotateWebhookSecret && !credentialFields && <Button variant="link" className="h-auto p-0" disabled={pending} onClick={() => { setReplace(!replace); setError(""); }}>
      {replace ? t("apps.chat.githubRecovery.useSavedCredentials") : t("apps.chat.githubRecovery.replaceCredentials")}
    </Button>}
    {replace && <div className="space-y-6">
      <div className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">{reconnect ? t("apps.chat.githubRecovery.replaceSameAppTitle") : t("apps.chat.githubRecovery.connectExistingAppTitle")}</h2>
        <p><a href={gitHubAppSettingsUrl(endpoint)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">{t("apps.chat.githubRecovery.openGitHubAppSettings")}<ExternalLink className="size-3.5" /></a>{t("apps.chat.githubRecovery.choosePrefix")} <strong>{appName}</strong>.</p>
        <p className="text-muted-foreground">{t("apps.chat.githubRecovery.orgSettingsHint")}</p>
        {credentialFields && <p className="text-muted-foreground">{t("apps.chat.githubRecovery.enterRequested")}</p>}
      </div>
      {needsPrivateKey && <div className="space-y-2">
        <CredentialLabel id="github-app-id" label={t("apps.chat.githubRecovery.appIdLabel")} help={t("apps.chat.githubRecovery.appIdHelp")} />
        <p id="github-app-id-help" className="text-sm text-muted-foreground">{t("apps.chat.githubRecovery.copyAppIdPrefix")} <strong>{t("apps.chat.githubRecovery.appIdLabel")}</strong>{t("apps.chat.githubRecovery.copyAppIdSuffix")}{reconnect && ` ${t("apps.chat.githubRecovery.savedIdFilled")}`}</p>
        <Input id="github-app-id" aria-describedby="github-app-id-help" inputMode="numeric" value={credentials.appId} disabled={pending} aria-invalid={appIdInvalid} onChange={event => setCredentials({ ...credentials, appId: event.target.value })} />
        {appIdInvalid && <p role="alert" className="text-sm text-destructive">{t("apps.chat.githubRecovery.appIdInvalid")}</p>}
      </div>}
      {needsPrivateKey && <div className="space-y-2">
        <CredentialLabel id="github-private-key" label={t("apps.chat.githubRecovery.privateKeyLabel")} help={t("apps.chat.githubRecovery.privateKeyHelp")} />
        <ol id="github-private-key-help" className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>{t("apps.chat.githubRecovery.keyStep1Prefix")} <strong>Credentials → Key pairs → New key</strong>{t("apps.chat.githubRecovery.keyStep1Middle")} <strong>Private keys → Generate a private key</strong>{t("apps.chat.githubRecovery.keyStep1Suffix")}</li>
          <li>{t("apps.chat.githubRecovery.keyStep2Prefix")} <strong>.pem</strong>{t("apps.chat.githubRecovery.keyStep2Suffix")}</li>
        </ol>
        <p className="text-sm text-muted-foreground">{t("apps.chat.githubRecovery.reusePem")}</p>
        <Input type="file" accept=".pem" aria-label={t("apps.chat.githubRecovery.uploadPemAria")} disabled={pending} onChange={async event => {
          const file = event.target.files?.[0];
          if (!file) return;
          setFileError("");
          try {
            const privateKey = await file.text();
            setCredentials(current => ({ ...current, privateKey }));
            setPrivateKeyDraft("");
          } catch { setFileError(t("apps.chat.githubRecovery.fileReadError")); }
        }} />
        <Input id="github-private-key" type="password" autoComplete="off" placeholder={keyLoaded ? t("apps.chat.githubRecovery.pasteReplacement") : t("apps.chat.githubRecovery.pasteComplete")} aria-describedby="github-private-key-help" disabled={pending} value={privateKeyDraft} aria-invalid={keyInvalid}
          onPaste={event => { event.preventDefault(); setCredentials({ ...credentials, privateKey: event.clipboardData.getData("text") }); setPrivateKeyDraft(""); setFileError(""); }}
          onChange={event => { setPrivateKeyDraft(event.target.value); setCredentials({ ...credentials, privateKey: event.target.value }); }} />
        {keyLoaded && <p role="status" className="text-sm">{t("apps.chat.githubRecovery.keyLoaded")}</p>}
        {keyInvalid && <p role="alert" className="text-sm text-destructive">{t("apps.chat.githubRecovery.keyInvalid")}</p>}
        {fileError && <p role="alert" className="text-sm text-destructive">{fileError}</p>}
        <a className="inline-flex items-center gap-1 text-sm underline" href="https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/managing-private-keys-for-github-apps" target="_blank" rel="noreferrer">{t("apps.chat.githubRecovery.keyInstructionsLink")}<ExternalLink className="size-3.5" /></a>
      </div>}
      {needsWebhookSecret && <div className="space-y-2">
        <CredentialLabel id="github-webhook-secret" label={t("apps.chat.githubRecovery.webhookSecretLabel")} help={t("apps.chat.githubRecovery.webhookSecretHelp")} />
        <p className="text-sm text-muted-foreground">{t("apps.chat.githubRecovery.webhookSecretHint")}</p>
        <Input id="github-webhook-secret" type="password" autoComplete="off" disabled={pending} value={credentials.webhookSecret} onChange={event => setCredentials({ ...credentials, webhookSecret: event.target.value })} />
      </div>}
      {credentialFields?.includes("clientSecret") && <div className="space-y-2">
        <CredentialLabel id="github-client-secret" label={t("apps.chat.githubRecovery.clientSecretLabel")} help={t("apps.chat.githubRecovery.clientSecretHelp")} />
        <Input id="github-client-secret" type="password" autoComplete="off" disabled={pending} value={credentials.clientSecret ?? ""} onChange={event => setCredentials({ ...credentials, clientSecret: event.target.value })} />
      </div>}
    </div>}
    <SetupWizardFooter onSaveExit={onExit} disabled={pending}>
      <Button aria-label={actionLabel} disabled={pending || incomplete || rotationUncertain || (rotateWebhookSecret && !rotationSecret && !rotationAlreadyCommitted)} onClick={() => void connect()}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        <span className="sm:hidden" aria-hidden="true">{pending ? t("apps.chat.githubRecovery.checkingShort") : reconnect ? t("apps.chat.githubRecovery.reconnect") : t("apps.chat.githubRecovery.connect")}</span>
        <span className="hidden sm:inline" aria-hidden="true">{actionLabel}</span>
      </Button>
    </SetupWizardFooter>
  </div>;
}
