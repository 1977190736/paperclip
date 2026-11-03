import { SpekoPhoneLine } from "@/components/voice/SpekoPhoneLine";
import { SpekoIncomingCalls } from "@/components/voice/SpekoIncomingCalls";
import { SpekoCallActivityItem, SpekoUnapprovedCallActivityItem, useSpekoCallHistory } from "@/components/voice/SpekoCallHistory";
import { SpekoPhoneCallback } from "@/components/voice/SpekoPhoneCallback";
import { deriveInitials } from "@/components/Identity";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { agentAvatarUrl } from "@/lib/agent-avatar-url";
import { resolveAgentAppearance } from "@paperclipai/shared";
import { SlackTestMessageButton } from "./SlackTestMessageButton";
import { slackConversationUrl } from "./slack/conversation-url";
import { useAccountIdentity } from "@/api/companies-query";
import { AgentAvatar } from "@/components/AgentAvatar";
import { SlackSetupAdvanced } from "./SlackAppDetails";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SlackToolsSettings, SlackSearchAccess } from "./SlackToolSettings";
import { ChatCommunicationInstructions } from "./ChatCommunicationInstructions";
import { ChatExecutionDefaults } from "./ChatExecutionDefaults";
import { agentsApi } from "@/api/agents";
import { ChatConversationList } from "./ChatConversationList";
import { GitHubConnectionRecoveryNotice } from "./GitHubConnectionRecovery";
import { GitHubBotManagement, GitHubReviews } from "./GitHubBotManagement";
import { GitHubBotMention, GitHubAppIdentityActions } from "./GitHubAppIdentity";
import { GitHubConnectionComplete, type GitHubConnectionCompleteLocationState } from "./GitHubConnectionComplete";
import { EmailEndpointSettings } from "./EmailEndpointSetup";
import { EmailConnectionAccess } from "@/components/EmailConnectionAccess";
import { emailApi } from "@/api/email";
import { toolsApi } from "@/api/tools";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  Check,
  Activity as ActivityIcon,
  Copy,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  Unlink,
} from "lucide-react";
import {
  chatEndpointsApi,
  type ChatActivityItem,
  type ChatEndpoint,
  type ChatEndpointResource,
  type ChatProvider,
} from "@/api/chatEndpoints";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { AppLogo } from "../AppLogo";
import { StatusBadge } from "@/components/StatusBadge";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useToast } from "@/context/ToastContext";
import { formatDateTime } from "@/lib/utils";
import { queryKeys } from "@/lib/queryKeys";
import { copyTextToClipboard } from "@/lib/clipboard";
import { Link, Navigate, useLocation, useNavigate, useParams } from "@/lib/router";
import { t, useTranslation } from "@/i18n";

const tabs = ["settings", "access", "reviews", "conversations", "activity"] as const;
type ChatTab = (typeof tabs)[number];
const tabLabelKeys: Record<ChatTab, string> = {
  settings: "apps.chat.detail.tab.settings",
  access: "apps.chat.detail.tab.access",
  reviews: "apps.chat.detail.tab.reviews",
  conversations: "apps.chat.detail.tab.conversations",
  activity: "apps.chat.detail.tab.activity",
};
const tabItems = tabs.map((value) => ({
  value,
  labelKey: tabLabelKeys[value],
}));
const providerNames: Record<ChatProvider, string> = {
  speko: "Speko",
  agentmail: "AgentMail",
  slack: "Slack",
  github: "GitHub",
  discord: "Discord",
  "microsoft-teams": "Microsoft Teams",
  telegram: "Telegram",
  "imessage-photon": "iMessage Photon",
};

const providerLifecycleGuidanceKeys: Record<
  ChatProvider,
  { reconnect: string; remove: string }
> = {
  speko: {
    reconnect: "apps.chat.detail.guidance.speko.reconnect",
    remove: "apps.chat.detail.guidance.speko.remove",
  },
  agentmail: { reconnect: "apps.chat.detail.guidance.agentmail.reconnect", remove: "apps.chat.detail.guidance.agentmail.remove" },
  slack: {
    reconnect: "apps.chat.detail.guidance.slack.reconnect",
    remove: "apps.chat.detail.guidance.slack.remove",
  },
  github: {
    reconnect: "apps.chat.detail.guidance.github.reconnect",
    remove: "apps.chat.detail.guidance.github.remove",
  },
  discord: {
    reconnect: "apps.chat.detail.guidance.discord.reconnect",
    remove: "apps.chat.detail.guidance.discord.remove",
  },
  "microsoft-teams": {
    reconnect: "apps.chat.detail.guidance.teams.reconnect",
    remove: "apps.chat.detail.guidance.teams.remove",
  },
  "imessage-photon": {
    reconnect: "apps.chat.detail.guidance.photon.reconnect",
    remove: "apps.chat.detail.guidance.photon.remove",
  },
  telegram: {
    reconnect: "apps.chat.detail.guidance.telegram.reconnect",
    remove: "apps.chat.detail.guidance.telegram.remove",
  },
};

const activityKindLabelKeys: Record<ChatActivityItem["kind"], string> = {
  delivery: "apps.chat.detail.kind.delivery",
  publication: "apps.chat.detail.kind.publication",
  action: "apps.chat.detail.kind.action",
  health: "apps.chat.detail.kind.health",
  repair: "apps.chat.detail.kind.repair",
};

const replayableFailureStates = new Set(["failed"]);
// Provider callbacks do not necessarily emit a Board activity event. Refresh
// only mounted operational views, and stop polling when the browser is hidden.
const liveChatQueryOptions = {
  staleTime: 0,
  refetchInterval: 5_000,
  refetchIntervalInBackground: false,
} as const;

export function isReplayEligible(item: ChatActivityItem): boolean {
  if (
    item.fileTransfer ||
    !item.replayable ||
    !replayableFailureStates.has(item.status)
  ) {
    return false;
  }
  if (item.kind === "delivery") return item.status === "failed";
  return item.kind === "publication";
}

export function activityResolutionActions(item: ChatActivityItem) {
  const offered = item.resolutionActions ?? [];
  if (!item.fileTransfer) return offered;
  if (
    item.kind !== "publication" ||
    !Number.isSafeInteger(item.fileTransfer.version) ||
    item.fileTransfer.version < 1
  )
    return [];
  if (
    ![
      "consent_unknown",
      "upload_unknown",
      "file_info_unknown",
      "conflict",
    ].includes(item.fileTransfer.phase)
  )
    return [];
  // Only the file-info stage can use ordinary visible-delivery resolution.
  // Earlier consent/upload evidence must not be fabricated by these buttons.
  return item.fileTransfer.phase === "file_info_unknown"
    ? offered
    : offered.filter((action) => action === "cancel");
}

export function activityResolutionDescription(item: ChatActivityItem): string {
  const phase = item.fileTransfer?.phase;
  if (phase === "file_info_unknown")
    return t("apps.chat.detail.resolution.fileInfoUnknown");
  if (phase === "consent_unknown")
    return t("apps.chat.detail.resolution.consentUnknown");
  if (phase)
    return t("apps.chat.detail.resolution.uploadUnknown");
  return t("apps.chat.detail.resolution.sendLost");
}

export function isResolutionEligible(item: ChatActivityItem): boolean {
  return (
    (item.kind === "publication" || item.kind === "action") &&
    item.status === "delivery_unknown" &&
    activityResolutionActions(item).length > 0
  );
}

export function isIndividuallyToggleableResource(
  provider: ChatProvider,
  resourceType: string,
): boolean {
  return !(
    provider === "microsoft-teams" &&
    (resourceType === "direct_message" || resourceType === "group_chat")
  );
}

function activityDetailLabel(item: ChatActivityItem): string {
  return replayableFailureStates.has(item.status) ? t("apps.chat.detail.reason") : t("apps.chat.detail.details");
}

export function connectionHealthPresentation(
  endpoint: Pick<ChatEndpoint, "status" | "healthMessage" | "lastError">,
) {
  // Health events outlive pause/removal. They are history, not lifecycle state.
  const lifecycleMessageKeys: Partial<Record<ChatEndpoint["status"], string>> = {
    draft: "apps.chat.detail.lifecycle.draft",
    verifying: "apps.chat.detail.lifecycle.verifying",
    paused: "apps.chat.detail.lifecycle.paused",
    attention: "apps.chat.detail.lifecycle.attention",
    revoked: "apps.chat.detail.lifecycle.revoked",
    archived: "apps.chat.detail.lifecycle.archived",
  };
  const lifecycleMessage =
    endpoint.status === "active" ? null : lifecycleMessageKeys[endpoint.status] ? t(lifecycleMessageKeys[endpoint.status]!) : undefined;
  return {
    message: lifecycleMessage ?? endpoint.healthMessage ?? null,
    previousHealth: lifecycleMessage ? (endpoint.healthMessage ?? null) : null,
    error: endpoint.lastError ?? null,
    errorLabel: ["active", "attention", "revoked"].includes(endpoint.status)
      ? t("apps.chat.detail.reason")
      : t("apps.chat.detail.lastReportedError"),
  };
}

export function ChatEndpointDetail() {
  const { t } = useTranslation();
  const { userId, settled: identitySettled } = useAccountIdentity();
  const { endpointId = "", tab: routeTab, reviewId } = useParams<{
    endpointId: string;
    tab?: string;
    reviewId?: string;
  }>();
  const tab = reviewId ? "reviews" : (routeTab ?? "settings");
  const activeTab = tabs.includes(tab as ChatTab) ? (tab as ChatTab) : null;
  const navigate = useNavigate();
  const location = useLocation();
  const heading = useRef<HTMLHeadingElement>(null);
  const completion = (location.state as GitHubConnectionCompleteLocationState | null)?.githubConnectionComplete;
  const { setBreadcrumbs } = useBreadcrumbs();
  const endpointQuery = useQuery({
    queryKey: queryKeys.chatEndpoints.detail(endpointId),
    queryFn: () => chatEndpointsApi.get(endpointId),
    enabled: Boolean(endpointId && activeTab),
    ...liveChatQueryOptions,
    refetchInterval:
      activeTab === "activity" || activeTab === "conversations"
        ? liveChatQueryOptions.refetchInterval
        : false,
  });
  const endpoint = endpointQuery.data;
  const avatarAgent = useQuery({
    queryKey: queryKeys.agents.detail(endpoint?.assignedAgentId ?? ""),
    queryFn: () => agentsApi.get(endpoint!.assignedAgentId),
    enabled: endpoint?.provider === "github",
  });
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const agentQuery = useQuery({
    queryKey: queryKeys.agents.detail(endpoint?.assignedAgentId ?? ""),
    queryFn: () => agentsApi.get(endpoint!.assignedAgentId, endpoint!.companyId),
    enabled: Boolean(endpoint?.assignedAgentId),
  });

  useEffect(() => {
    if (!endpoint || !activeTab) return;
    setBreadcrumbs([
      { label: t("apps.common.connectors"), href: "/apps" },
      {
        label: `${endpoint.assignedAgentName} · ${providerNames[endpoint.provider]}`,
        href: `/apps/chat/${endpoint.id}/settings`,
      },
      ...(reviewId ? [{ label: t("apps.chat.detail.tab.reviews"), href: `/apps/chat/${endpoint.id}/reviews` }, { label: t("apps.chat.detail.tab.review") }] : [{
        label: t(tabItems.find((item) => item.value === activeTab)?.labelKey ?? "apps.chat.detail.tab.settings"),
      }]),
    ]);
    return () => setBreadcrumbs([]);
  }, [activeTab, endpoint, reviewId, setBreadcrumbs, t]);

  if (!activeTab)
    return <Navigate replace to={`/apps/chat/${endpointId}/settings`} />;
  if (endpointQuery.isLoading)
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("apps.detailPage.loadingConnection")}
      </div>
    );
  if (endpointQuery.isError || !endpoint)
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">
          {t("apps.chat.detail.loadError")}
        </p>
        <Button variant="outline" onClick={() => endpointQuery.refetch()}>
          {t("apps.chat.defaults.tryAgain")}
        </Button>
      </div>
    );
  if (endpoint.provider === "agentmail" && activeTab === "settings")
    return <div className="space-y-7"><EmailEndpointSettings key={endpoint.id} endpointId={endpoint.id} companyId={endpoint.companyId} assignedAgentName={endpoint.assignedAgentName} /><EndpointExecutionDefaults endpoint={endpoint} /></div>;
  const setupIncomplete =
    endpoint.setup?.step !== "complete" &&
    !(endpoint.provider === "slack" && endpoint.setup?.step === "test") &&
    ["draft", "verifying", "attention", "revoked"].includes(endpoint.status);
  const slackAppId = endpoint.setup?.slackRegistration?.appId;
  const slackUrl = endpoint.provider === "slack"
    ? slackAppId ? `https://api.slack.com/apps/${encodeURIComponent(slackAppId)}/oauth` : "https://api.slack.com/apps"
    : null;

  return (
    <div className="max-w-5xl space-y-6 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <AgentAvatar agent={agentQuery.data ?? { id: endpoint.assignedAgentId, name: endpoint.assignedAgentName }} size={endpoint.provider === "github" ? 64 : 48} />
          <div className="min-w-0">
          <h1 ref={heading} tabIndex={-1} className={endpoint.provider === "speko" ? "flex items-center gap-3 text-xl font-bold" : "text-xl font-bold"}>
            {endpoint.provider === "speko" && <AppLogo name="Speko" brandKey="speko" size={36} />}
            {endpoint.provider === "github" ? (endpoint.botLabel ?? endpoint.assignedAgentName) : endpoint.assignedAgentName}{endpoint.provider === "speko" ? " in Speko" : ""}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {endpoint.provider === "github" ? <><AppLogo name="GitHub" brandKey="github" compact className="size-4! rounded-sm bg-transparent" /><Link to={`/agents/${endpoint.assignedAgentId}`} className="hover:underline">{endpoint.assignedAgentName}</Link>{endpoint.providerAccountLabel && <span>· {endpoint.providerAccountLabel}</span>}</> : endpoint.providerAccountLabel ?? (endpoint.provider === "agentmail" ? endpoint.botExternalId ?? t("apps.chat.detail.emailConnection") : t("apps.chat.detail.chatConnection"))}
          </p>
          {endpoint.provider === "github" && <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <GitHubBotMention endpoint={endpoint} />
            <GitHubAppIdentityActions endpoint={endpoint} avatarUrl={avatarAgent.data ? agentAvatarUrl(resolveAgentAppearance(avatarAgent.data.appearance, endpoint.assignedAgentId), 512, 1, "rest") : undefined} />
          </div>}
          {endpoint.provider === "imessage-photon" && endpoint.botExternalId && endpoint.photonAllocation !== "shared" && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span>{endpoint.botExternalId}</span>
              <Button variant="ghost" size="sm" aria-label={t("apps.chat.detail.copyNumberAria")} onClick={async () => {
                try { await copyTextToClipboard(endpoint.botExternalId!); setCopyStatus(t("apps.chat.try.numberCopied")); }
                catch { setCopyStatus(t("apps.chat.try.copyNumberError")); }
              }}><Copy className="size-4" />{t("apps.chat.detail.copyNumber")}</Button>
              <span role="status" className="text-muted-foreground">{copyStatus}</span>
            </div>
          )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {endpoint.provider === "speko" && <a href="https://platform.speko.ai/agents" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary underline">{t("apps.chat.detail.openSpeko")}<ExternalLink className="size-3.5" aria-hidden="true" /></a>}
          {endpoint.provider === "slack" && !setupIncomplete && <Button asChild variant="outline"><a href={slackConversationUrl(endpoint, identitySettled ? userId : null)} target="_blank" rel="noopener noreferrer">{t("apps.chat.slackIdentity.openSlack")} <ExternalLink className="size-4" /></a></Button>}
          {slackUrl && <Button asChild variant="outline"><a href={slackUrl} target="_blank" rel="noopener noreferrer">{t("apps.chat.detail.openSlackConfig")} <ExternalLink className="size-4" /></a></Button>}
          {setupIncomplete ? (
            <Button
              variant="outline"
              onClick={() =>
                navigate(
                  `/apps/chat/connect?provider=${endpoint.provider}&purpose=chat&resume=${endpoint.id}`,
                )
              }
            >
              {t("apps.browse.finishSetup")}
            </Button>
          ) : null}
          {endpoint.status !== "active" && <StatusBadge status={endpoint.status} className={endpoint.provider === "speko" ? "text-foreground" : undefined} />}
        </div>
      </header>
      {endpoint.provider === "github" && <GitHubConnectionRecoveryNotice endpoint={endpoint} />}
      {activeTab === "settings" && endpoint.provider === "speko" && endpoint.status === "active" && <div className="space-y-6"><SpekoPhoneCallback companyId={endpoint.companyId} endpointId={endpoint.id} /><SpekoPhoneLine companyId={endpoint.companyId} endpointId={endpoint.id} /><SpekoIncomingCalls companyId={endpoint.companyId} endpointId={endpoint.id} agentId={endpoint.assignedAgentId} /></div>}
      {endpoint.provider === "slack" && <SlackTestMessageButton key={endpoint.id} endpointId={endpoint.id} />}
      {endpoint.provider === "github" && <div hidden={activeTab !== "settings" && activeTab !== "access"}>
        <GitHubBotManagement key={endpoint.id} endpoint={endpoint} view={activeTab === "access" ? "access" : "settings"} />
      </div>}
      {activeTab === "settings" && endpoint.provider !== "github" && <Settings endpointId={endpoint.id} endpoint={endpoint} />}
      {activeTab === "settings" && <EndpointExecutionDefaults endpoint={endpoint} />}
      {activeTab === "reviews" && endpoint.provider === "github" && <GitHubReviews endpointId={endpoint.id} reviewId={reviewId} />}
      {activeTab === "access" && endpoint.provider === "speko" && (
        <section className="max-w-3xl space-y-3">
          <h2 className="text-lg font-semibold">{t("apps.chat.detail.privateVoiceTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("apps.chat.detail.privateVoiceDesc1")}</p>
          <p className="text-sm text-muted-foreground">{t("apps.chat.detail.privateVoiceDesc2")}</p>
        </section>
      )}
{activeTab === "access" && endpoint.provider === "agentmail" && <EmailAccess endpoint={endpoint} />}
{activeTab === "access" && endpoint.provider !== "speko" && endpoint.provider !== "github" && endpoint.provider !== "agentmail" && (
        <Access
          endpointId={endpoint.id}
          allowUnlinked={endpoint.allowUnlinkedPeople}
          endpoint={endpoint}
        />
      )}
      {activeTab === "conversations" && (
        <Conversations endpointId={endpoint.id} provider={endpoint.provider} />
      )}
      {activeTab === "activity" && (
        <Activity endpointId={endpoint.id} endpoint={endpoint} />
      )}
      {endpoint.provider === "github" && activeTab === "settings" && endpoint.status === "active" &&
        endpoint.setup?.step === "complete" && completion?.endpointId === endpoint.id && (
        <GitHubConnectionComplete
          endpoint={endpoint}
          agent={avatarAgent.data}
          runtimeChecks={completion.runtimeChecks}
          onClose={() => {
            const { githubConnectionComplete: _complete, ...rest } = location.state as GitHubConnectionCompleteLocationState;
            navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, { replace: true, state: rest });
          }}
          onCloseAutoFocus={() => heading.current?.focus()}
        />
      )}
    </div>
  );
}

function EndpointExecutionDefaults({ endpoint }: { endpoint: ChatEndpoint }) {
  const queryClient = useQueryClient();
  return <section className="max-w-3xl py-5"><ChatExecutionDefaults
    key={endpoint.id}
    companyId={endpoint.companyId}
    value={endpoint.executionDefaults}
    onSave={async (executionDefaults) => {
      const next = await chatEndpointsApi.update(endpoint.id, { executionDefaults });
      queryClient.setQueryData(queryKeys.chatEndpoints.detail(endpoint.id), next);
    }}
  /></section>;
}

function EmailAccess({ endpoint }: { endpoint: ChatEndpoint }) {
  const connection = useQuery({
    queryKey: queryKeys.tools.connection(endpoint.connectionId ?? ""),
    queryFn: () => toolsApi.getConnection(endpoint.connectionId!),
    enabled: Boolean(endpoint.connectionId),
  });
  const agents = useQuery({
    queryKey: queryKeys.agents.list(endpoint.companyId),
    queryFn: () => agentsApi.list(endpoint.companyId),
  });
  if (!endpoint.connectionId || agents.isError || connection.isError) return (
    <div className="space-y-3">
      <p role="alert" className="text-sm text-destructive">{t("apps.chat.detail.accessLoadError")}</p>
      <Button variant="outline" onClick={() => { void agents.refetch(); void connection.refetch(); }}>{t("apps.chat.defaults.tryAgain")}</Button>
    </div>
  );
  if (agents.isPending || connection.isPending) return <p role="status" className="text-sm text-muted-foreground">{t("apps.chat.detail.loadingAccess")}</p>;
  const sourceId = connection.data.config?.credentialConnectionId;
  const credentialId = typeof sourceId === "string" ? sourceId : endpoint.connectionId;
  return <section className="max-w-3xl space-y-4">
    <h2 className="text-lg font-semibold">{t("apps.chat.detail.tab.access")}</h2>
    {credentialId !== endpoint.connectionId && <p className="text-sm text-muted-foreground">{t("apps.chat.detail.agentmailAccountNote")}</p>}
    <EmailConnectionAccess key={credentialId} companyId={endpoint.companyId} connectionId={credentialId} agents={agents.data} />
  </section>;
}

function Settings({
  endpointId,
  endpoint,
}: {
  endpointId: string;
  endpoint: Awaited<ReturnType<typeof chatEndpointsApi.get>>;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const resourcesQuery = useQuery({
    queryKey: queryKeys.chatEndpoints.resources(endpointId),
    queryFn: () => chatEndpointsApi.listResources(endpointId),
    enabled: endpoint.provider !== "speko",
    ...(endpoint.provider === "slack" ? liveChatQueryOptions : {}),
  });
  const saveResources = useMutation({
    mutationFn: (resource: Pick<ChatEndpointResource, "id" | "enabled">) =>
      chatEndpointsApi.updateResources(endpointId, [resource]),
    onSuccess: (resources) =>
      queryClient.setQueryData(
        queryKeys.chatEndpoints.resources(endpointId),
        resources,
      ),
    onError: (error) =>
      pushToast({
        title: t("apps.chat.detail.destinationUpdateFailed"),
        body: error instanceof Error ? error.message : t("apps.chat.setup.toastRetryBody"),
        tone: "error",
      }),
  });
  const updateEndpoint = useMutation({
    mutationFn: chatEndpointsApi.update.bind(null, endpointId),
    onSuccess: (next) =>
      queryClient.setQueryData(
        queryKeys.chatEndpoints.detail(endpointId),
        next,
      ),
    onError: (error) =>
      pushToast({
        title: t("apps.chat.detail.settingsUpdateFailed"),
        body: error instanceof Error ? error.message : t("apps.chat.setup.toastRetryBody"),
        tone: "error",
      }),
  });
  if (endpoint.provider === "speko") return null;
  const resources = resourcesQuery.data ?? [];
  const destinationResources = resources.filter((resource) =>
    isIndividuallyToggleableResource(endpoint.provider, resource.type),
  );
  const toggleResource = (resource: ChatEndpointResource, enabled: boolean) =>
    // A cached inventory must not overwrite another operator's unrelated edits.
    saveResources.mutate({ id: resource.id, enabled });
  return (
    <section className="max-w-3xl space-y-7">
      {endpoint.provider === "imessage-photon" && <p className="text-sm text-muted-foreground">{endpoint.photonAllocation === "shared" ? t("apps.chat.detail.photonSharedNote") : t("apps.chat.detail.photonDedicatedNote")}</p>}
      {endpoint.provider === "telegram" && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{t("apps.chat.detail.telegramCommandTitle")}</h2>
          <div className="rounded-lg border border-border p-3 text-sm">
            <code>
              /task@
              {endpoint.botUsername?.replace(/^@/, "") ?? "bot_username"}{" "}
              &lt;request&gt;
            </code>
            <p className="mt-2 text-muted-foreground">
              {t("apps.chat.detail.telegramCommandNote")}
            </p>
          </div>
        </div>
      )}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{endpoint.provider === "slack" ? t("apps.chat.detail.allowedChannels") : t("apps.chat.detail.destinations")}</h3>
        {resourcesQuery.isError ? <p role="alert" className="text-sm text-destructive">{t("apps.chat.detail.channelsLoadError")} <button className="underline" onClick={() => void resourcesQuery.refetch()}>{t("apps.chat.defaults.tryAgain")}</button></p> : resourcesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t("apps.chat.detail.loadingDestinations")}</p>
        ) : destinationResources.length === 0 && endpoint.provider !== "slack" ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            {t("apps.chat.detail.noDestinations")}
          </p>
        ) : (
          <div className={endpoint.provider === "slack" ? "space-y-1" : "divide-y divide-border border-y border-border"}>
            {destinationResources.map((resource) => (
              <div key={resource.id} className="py-3 space-y-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {resource.label}
                  </p>
                  {(resource.availability !== "available" || resource.detail) && <p className="text-xs text-muted-foreground">
                    {resource.availability === "available"
                      ? resource.detail
                      : t("apps.chat.detail.unavailableAtProvider")}
                  </p>}
                  {resource.participants?.length ? <p className="mt-1 break-words text-xs text-muted-foreground">{t("apps.chat.detail.participants", { list: resource.participants.join(", ") })}</p> : null}
                </div>
                <ToggleSwitch
                  aria-label={t("apps.chat.detail.enableResourceAria", { label: resource.label })}
                  checked={resource.enabled}
                  disabled={
                    endpoint.photonAllocation === "shared" ||
                    resource.availability !== "available" ||
                    saveResources.isPending
                  }
                  onCheckedChange={(enabled) =>
                    toggleResource(resource, enabled)
                  }
                />
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">{t("apps.chat.defaults.title")}</summary>
                <div className="pt-3"><ChatExecutionDefaults
                  companyId={endpoint.companyId}
                  value={resource.executionDefaults}
                  resource
                  onSave={async (executionDefaults) => {
                    const next = await chatEndpointsApi.updateResources(endpointId, [{ id: resource.id, executionDefaults }]);
                    queryClient.setQueryData(queryKeys.chatEndpoints.resources(endpointId), next);
                  }}
                /></div>
              </details>
              </div>
            ))}
            {endpoint.provider === "slack" && (
              <p className="py-3 text-sm text-muted-foreground">
                {t("apps.chat.detail.inviteToChannel", { name: endpoint.assignedAgentName })}
              </p>
            )}
          </div>
        )}
      </div>
      {endpoint.provider !== "github" && (
        <div className="space-y-3">
          <SettingToggle
            label={t("apps.chat.detail.allowDirectMessages")}
            detail={
              endpoint.provider === "discord"
                ? t("apps.chat.detail.discordDmDetail")
                : undefined
            }
            checked={endpoint.allowDirectMessages ?? false}
            pending={updateEndpoint.isPending}
            onChange={(allowDirectMessages) =>
              updateEndpoint.mutate({ allowDirectMessages })
            }
          />
          {endpoint.provider === "slack" && (
            <SettingToggle
              label={t("apps.chat.detail.requireAtMention")}
              detail={t("apps.chat.detail.requireAtMentionDetail")}
              checked={endpoint.requireAtMention ?? false}
              pending={updateEndpoint.isPending}
              onChange={(requireAtMention) =>
                updateEndpoint.mutate({ requireAtMention })
              }
            />
          )}
          {endpoint.provider === "microsoft-teams" && (
            <SettingToggle
              label={t("apps.chat.detail.allowGroupChats")}
              detail={t("apps.chat.detail.allowGroupChatsDetail")}
              checked={endpoint.allowGroupChats ?? false}
              pending={updateEndpoint.isPending}
              onChange={(allowGroupChats) =>
                updateEndpoint.mutate({ allowGroupChats })
              }
            />
          )}
        </div>
      )}
      {endpoint.provider === "slack" && <ChatCommunicationInstructions
        key={endpoint.id}
        value={endpoint.communicationInstructions ?? ""}
        onSave={async (communicationInstructions) => {
          const next = await chatEndpointsApi.update(endpointId, { communicationInstructions });
          queryClient.setQueryData(queryKeys.chatEndpoints.detail(endpointId), next);
        }}
      />}
      {endpoint.provider === "slack" && <SlackSetupAdvanced label={t("apps.chat.detail.slackTools")}><SlackToolsSettings companyId={endpoint.companyId} endpointId={endpointId} /></SlackSetupAdvanced>}
    </section>
  );
}

function SettingToggle({
  label,
  detail,
  checked,
  pending,
  onChange,
}: {
  label: string;
  detail?: string;
  checked: boolean;
  pending: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
      <ToggleSwitch
        aria-label={label}
        checked={checked}
        disabled={pending}
        onCheckedChange={onChange}
      />
    </div>
  );
}

function Access({
  endpointId,
  allowUnlinked,
  endpoint,
}: {
  endpointId: string;
  allowUnlinked: boolean;
  endpoint: ChatEndpoint;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [confirmationUrl, setConfirmationUrl] = useState<string | null>(null);
  const [joinCommandCopied, setJoinCommandCopied] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [confirmationFor, setConfirmationFor] = useState<string | null>(null);
  const joinCommand = `${endpoint.setup?.slackApp?.command ?? endpoint.setup?.command ?? "/paperclip"} connect`;
  const linksQuery = useQuery({
    queryKey: queryKeys.chatEndpoints.principals(endpointId),
    queryFn: () => chatEndpointsApi.listPrincipals(endpointId),
    refetchInterval: 5000,
  });
  const updatePolicy = useMutation({
    mutationFn: (value: boolean) =>
      chatEndpointsApi.update(endpointId, { allowUnlinkedPeople: value }),
    onSuccess: (next) =>
      queryClient.setQueryData(
        queryKeys.chatEndpoints.detail(endpointId),
        next,
      ),
    onError: (error) => pushToast({ title: t("apps.chat.detail.accessUpdateFailed"), body: error instanceof Error ? error.message : t("apps.chat.setup.toastRetryBody"), tone: "error" }),
  });
  const createIntent = useMutation({
    mutationFn: (principalId: string) =>
      chatEndpointsApi.createLinkIntent(endpointId, principalId),
    onSuccess: ({ confirmationUrl }) => {
      setConfirmationUrl(
        new URL(confirmationUrl, window.location.origin).toString(),
      );

    },
    onError: (error) =>
      pushToast({
        title: t("apps.chat.detail.identityLinkFailed"),
        body: error instanceof Error ? error.message : t("apps.chat.setup.toastRetryBody"),
        tone: "error",
      }),
  });
  const revoke = useMutation({
    mutationFn: (principalId: string) =>
      chatEndpointsApi.revokeLink(endpointId, principalId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.chatEndpoints.principals(endpointId) }),
    onError: (error) => pushToast({ title: t("apps.detailPage.disconnectFailedTitle"), body: error instanceof Error ? error.message : t("apps.chat.setup.toastRetryBody"), tone: "error" }),
  });
  const links = linksQuery.data ?? [];
  return (
    <section className="max-w-3xl space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("apps.chat.githubAccess.people")}</h2>
        {endpoint.provider === "slack" && <Dialog>
          <DialogTrigger asChild><Button>{t("apps.chat.detail.invitePeople")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("apps.chat.detail.inviteDialogTitle", { name: endpoint.assignedAgentName })}</DialogTitle>
              <DialogDescription>{t("apps.chat.detail.inviteDialogDesc")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <ol className="list-decimal space-y-3 pl-5">
                <li>{t("apps.chat.detail.inviteStep1")} <code className="font-mono">{joinCommand}</code>{t("apps.chat.detail.inviteStep1Suffix")}</li>
                <li>{t("apps.chat.detail.inviteStep2")}</li>
                <li>{t("apps.chat.detail.inviteStep3")}</li>
              </ol>
              <p className="text-muted-foreground">{t("apps.chat.detail.inviteExpiry")}</p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button variant="ghost" onClick={() => {
                  void copyTextToClipboard(joinCommand).then(() => setJoinCommandCopied(true), () => pushToast({ title: t("apps.chat.slackIdentity.copyError"), tone: "error" }));
                }}>{joinCommandCopied ? <Check className="size-4" /> : <Copy className="size-4" />}{joinCommandCopied ? t("apps.chat.common.copied") : t("apps.chat.slackIdentity.copyCommand")}</Button>
                <Button onClick={() => {
                  const workspace = endpoint.providerAccountId ? `https://app.slack.com/client/${encodeURIComponent(endpoint.providerAccountId)}` : "https://app.slack.com/";
                  void copyTextToClipboard(t("apps.chat.detail.invitationText", { name: endpoint.assignedAgentName, workspace, command: joinCommand })).then(() => setInviteCopied(true), () => pushToast({ title: t("apps.chat.detail.inviteCopyFailed"), tone: "error" }));
                }}>{inviteCopied ? <Check className="size-4" /> : <Copy className="size-4" />}{inviteCopied ? t("apps.chat.detail.invitationCopied") : t("apps.chat.detail.copyInvitation")}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>}
      </div>
      <p className="text-sm text-muted-foreground">{t("apps.chat.detail.linkedPermissions")} <Link className="underline underline-offset-4" to="/company/settings/members">{t("apps.chat.detail.manageMembers")}</Link></p>
      {confirmationUrl && (
        <div className="space-y-2 border-y border-border py-3">
          <p className="text-sm font-medium">{t("apps.chat.detail.confirmPrefix")} {confirmationFor ?? t("apps.chat.detail.thisAccount")}</p>
          <p className="text-xs text-muted-foreground">{t("apps.chat.detail.confirmNote")}</p>
          <p className="break-all text-xs text-muted-foreground">
            {confirmationUrl}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void copyTextToClipboard(confirmationUrl).then(
                () =>
                  pushToast({
                    title: t("apps.chat.detail.linkCopiedTitle"),
                    tone: "success",
                  }),
                () =>
                  pushToast({
                    title: t("apps.chat.detail.linkCopyFailedTitle"),
                    body: t("apps.chat.setup.copyToastBody"),
                    tone: "error",
                  }),
              );
            }}
          >
            <Copy />
            {t("apps.chat.detail.copyLink")}
          </Button>
        </div>
      )}
      <div className="space-y-2">
        {linksQuery.isPending ? <p role="status" className="text-sm text-muted-foreground">{t("apps.chat.detail.loadingPeople")}</p> : linksQuery.isError ? <p role="alert" className="text-sm text-destructive">{t("apps.chat.detail.peopleLoadError")} <button className="underline" onClick={() => void linksQuery.refetch()}>{t("apps.chat.defaults.tryAgain")}</button></p> : links.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            {t("apps.chat.detail.noLinkedAccounts")}
          </p>
        ) : (
          <div role="list" aria-label={t("apps.chat.githubAccess.people")} className="divide-y divide-border border-y border-border">
            {links.map((link) => (
              <div
                key={link.id}
                role="listitem"
                className="flex flex-wrap items-center gap-3 py-3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Avatar aria-hidden="true">
                    {link.paperclipUserImage && <AvatarImage src={link.paperclipUserImage} alt="" />}
                    <AvatarFallback>{deriveInitials(link.paperclipUserLabel ?? link.externalLabel)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm" title={link.paperclipUserLabel ?? link.externalLabel}>{link.paperclipUserLabel ?? link.externalLabel}</p>
                    {(link.status !== "linked" || link.externalLabel !== link.paperclipUserLabel) && <p className="text-xs text-muted-foreground">
                      {link.status === "revoked" ? t("apps.chat.detail.disconnectedStatus") : link.status === "linked"
                        ? link.externalLabel
                        : t("apps.chat.detail.waitingConfirmation")}
                    </p>}
                  </div>
                </div>
                {link.status === "linked" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate(link.principalId)}
                  >
                    <Unlink />
                    {t("apps.chat.detail.disconnectButton")}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={createIntent.isPending}
                    onClick={() => { setConfirmationUrl(null); setConfirmationFor(link.externalLabel); createIntent.mutate(link.principalId); }}
                  >
                    {t("apps.chat.detail.createConfirmationLink")}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <SlackSetupAdvanced label={t("apps.chat.detail.guestAccess")}>
        <SettingToggle label={t("apps.chat.detail.allowUnlinked")}
          detail={t("apps.chat.detail.allowUnlinkedDetail")}
          checked={allowUnlinked} pending={updatePolicy.isPending} onChange={value => updatePolicy.mutate(value)} />
      </SlackSetupAdvanced>
      {endpoint.provider === "slack" && <SlackSetupAdvanced label={t("apps.chat.slackTools.searchAccessTitle")}><SlackSearchAccess companyId={endpoint.companyId} endpointId={endpointId} /></SlackSetupAdvanced>}
    </section>
  );
}

function Conversations({
  endpointId,
  provider,
}: {
  endpointId: string;
  provider: ChatProvider;
}) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: queryKeys.chatEndpoints.conversations(endpointId),
    queryFn: () => chatEndpointsApi.listConversations(endpointId),
    ...liveChatQueryOptions,
  });
  return (
    <section className="space-y-4">
      {query.isPending ? <p role="status" className="text-sm text-muted-foreground">{t("apps.chat.detail.loadingConversations")}</p> : query.isError ? (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-destructive">{t("apps.chat.detail.conversationsLoadError")}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>{t("apps.chat.defaults.tryAgain")}</Button>
        </div>
      ) : <ChatConversationList rows={query.data ?? []} provider={provider} />}
    </section>
  );
}

function Activity({
  endpointId,
  endpoint,
}: {
  endpointId: string;
  endpoint: Awaited<ReturnType<typeof chatEndpointsApi.get>>;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { pushToast } = useToast();
  const [removeOpen, setRemoveOpen] = useState(false);
  const [resolutionItem, setResolutionItem] = useState<ChatActivityItem | null>(
    null,
  );
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const cursor = cursors[cursors.length - 1];
  useEffect(() => setCursors([undefined]), [endpointId]);
  const query = useQuery({
    queryKey: [...queryKeys.chatEndpoints.activity(endpointId), cursor ?? null],
    queryFn: () => chatEndpointsApi.listActivityPage(endpointId, cursor),
    ...liveChatQueryOptions,
    refetchInterval: cursor ? false : liveChatQueryOptions.refetchInterval,
  });
  const calls = useSpekoCallHistory(endpoint.companyId, endpointId, endpoint.provider === "speko" && !cursor);
  const replay = useMutation({
    mutationFn: (item: ChatActivityItem) =>
      item.kind === "publication"
        ? chatEndpointsApi.replayPublication(endpointId, item.id)
        : chatEndpointsApi.replayDelivery(endpointId, item.id),
    onSuccess: async (_result, item) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.chatEndpoints.activity(endpointId),
      });
      pushToast({
        title: t(item.kind === "publication" ? "apps.chat.detail.publicationReplayQueued" : "apps.chat.detail.deliveryReplayQueued"),
        tone: "success",
      });
    },
    onError: (error) =>
      pushToast({
        title: t("apps.chat.detail.replayFailed"),
        body: error instanceof Error ? error.message : t("apps.chat.setup.toastRetryBody"),
        tone: "error",
      }),
  });
  const resolveActivity = useMutation({
    mutationFn: (input: {
      item: ChatActivityItem;
      action: "mark_delivered" | "retry_anyway" | "cancel";
    }) => {
      if (input.item.kind === "publication") {
        return chatEndpointsApi.resolvePublication(
          endpointId,
          input.item.id,
          input.action,
          input.item.fileTransfer
            ? {
                phase: input.item.fileTransfer.phase,
                version: input.item.fileTransfer.version,
              }
            : undefined,
        );
      }
      return chatEndpointsApi.resolveAction(
        endpointId,
        input.item.id,
        input.action,
      );
    },
    onSuccess: async (_result, input) => {
      setResolutionItem(null);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.chatEndpoints.activity(endpointId),
      });
      pushToast({
        title:
          input.item.actionType === "slash_task_start" &&
          input.action === "retry_anyway"
            ? t("apps.chat.detail.taskStartRetried")
            : input.item.actionType === "slash_task_start"
              ? t("apps.chat.detail.taskStartCancelled")
              : input.item.actionType === "provider_effect" &&
                  input.action === "mark_delivered"
                ? t("apps.chat.detail.replyMarkedDelivered")
                : input.item.actionType === "provider_effect" &&
                    input.action === "retry_anyway"
                  ? t("apps.chat.detail.replyRetried")
                  : input.item.actionType === "provider_effect"
                    ? t("apps.chat.detail.replyCancelled")
                    : input.action === "mark_delivered"
                      ? t("apps.chat.detail.publicationMarkedDelivered")
                      : input.action === "retry_anyway"
                        ? t("apps.chat.detail.publicationQueuedForRetry")
                        : t("apps.chat.detail.publicationCancelled"),
        tone: "success",
      });
    },
    onError: (error) =>
      pushToast({
        title: t("apps.chat.detail.resolveFailed"),
        body: error instanceof Error ? error.message : t("apps.chat.setup.toastRetryBody"),
        tone: "error",
      }),
  });
  const lifecycle = useMutation({
    mutationFn: async (action: "pause" | "resume" | "remove") =>
      endpoint.provider === "agentmail"
        ? emailApi.control(endpointId, action)
        : chatEndpointsApi.setup(endpointId, { action }),
    onSuccess: async (next, action) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.chatEndpoints.list(next.companyId),
      });
      if (endpoint.provider === "agentmail") {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["email-inboxes", next.companyId] }),
          queryClient.invalidateQueries({ queryKey: queryKeys.chatEndpoints.detail(endpointId) }),
        ]);
      }
      if (action === "remove") {
        navigate("/apps");
        return;
      }
      if (endpoint.provider !== "agentmail") queryClient.setQueryData(queryKeys.chatEndpoints.detail(endpointId), next);
      pushToast({
        title: action === "pause" ? t("apps.chat.detail.pausedToast") : t("apps.chat.detail.resumedToast"),
        tone: "success",
      });
    },
    onError: (error) =>
      pushToast({
        title: t("apps.chat.detail.updateFailed"),
        body: error instanceof Error ? error.message : t("apps.chat.setup.toastRetryBody"),
        tone: "error",
      }),
  });
  const rows = query.data?.items ?? [];
  // Calls use their own caller-authorized API and appear once in recent activity.
  // Older connection-event pages retain the existing cursor contract.
  const activityEntries = [
    ...(!query.isError ? rows.map(item => ({ kind: "connection" as const, id: `connection:${item.id}`, createdAt: item.createdAt, item })) : []),
    ...(!cursor && !calls.error ? calls.entries.map(entry => ({ kind: "call" as const, id: `call:${entry.session.id}`, createdAt: entry.session.createdAt, entry })) : []),
    ...(!cursor && !calls.incomingError ? calls.unapprovedCalls.map(call => ({ kind: "unapproved_call" as const, id: `unapproved:${call.id}`, createdAt: call.createdAt, call })) : []),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));

  const { status } = endpoint;
  const health = connectionHealthPresentation(endpoint);
  const lifecycleAction = lifecycle.variables;
  const callbackSurfaceRows = endpoint.setup?.callbackSurfaces
    ? ([
        ["Events API", endpoint.setup.callbackSurfaces.events],
        ["Interactivity", endpoint.setup.callbackSurfaces.interactivity],
        ["Slash command", endpoint.setup.callbackSurfaces.slashCommands],
      ] as const)
    : [];
  return (
    <section className="space-y-5" aria-label={t("apps.chat.detail.activityAria")}>
      <h2 className="text-lg font-semibold">{t("apps.chat.detail.activityTitle")}</h2>
      {((status !== "active" && health.message) || health.error) && (
        <div
          className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${status === "attention" || status === "revoked" ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-border bg-muted/30 text-foreground"}`}
        >
          {(status === "attention" || status === "revoked") && (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div>
            {health.message && <p>{health.message}</p>}
            {health.previousHealth && (
              <p className="mt-1 text-xs opacity-80">
                <span className="font-medium">{t("apps.chat.detail.lastReportedHealth")}</span>{" "}
                {health.previousHealth}
              </p>
            )}
            {health.error && (
              <p className="mt-1 text-xs opacity-80">
                <span className="font-medium">{health.errorLabel}:</span>{" "}
                {health.error}
              </p>
            )}
          </div>
        </div>
      )}
      <details className="group rounded-lg border border-border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-medium chat-connection-health-summary">
          <span>{t("apps.chat.detail.healthControls")}</span>
          <span className="flex items-center gap-2">
            {endpoint.setup?.callbacksNeedUpdate && <span className="text-xs text-(--status-task-blocked)">{t("apps.chat.detail.callbacksNeedAttention")}</span>}
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="space-y-5 border-t border-border p-4">
      {endpoint.provider === "slack" && callbackSurfaceRows.length > 0 && (
        <div
          className="space-y-3 text-sm"
        >
          <p className="font-medium">{t("apps.chat.detail.callbackHealth")}</p>
          <p className="text-xs text-muted-foreground">
            {endpoint.setup?.callbacksNeedUpdate
              ? t("apps.chat.detail.callbacksUpdateHint")
              : t("apps.chat.detail.callbacksRecordedHint")}
          </p>
          <div className="divide-y divide-border border-y border-border">
            {callbackSurfaceRows.map(([label, surface]) => (
              <div key={label} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <p className="text-xs font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">
                  {surface.status === "current"
                    ? t("apps.chat.detail.surfaceCurrent")
                    : surface.status === "stale"
                      ? t("apps.chat.detail.surfaceStale")
                      : t("apps.chat.detail.surfaceNotObserved")}
                </p>
                {surface.observedAt && (
                  <p className="text-xs text-muted-foreground">
                    {t("apps.chat.detail.lastObservedPrefix")}{" "}
                    <time
                      dateTime={surface.observedAt}
                      title={surface.observedAt}
                      className="font-mono"
                    >
                      {formatDateTime(surface.observedAt, {
                        includeSeconds: true,
                      })}
                    </time>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {status !== "archived" && (
        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            {status === "active" && (
              <Button
                variant="outline"
                disabled={lifecycle.isPending}
                onClick={() => lifecycle.mutate("pause")}
              >
                {lifecycle.isPending && lifecycleAction === "pause" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Pause />
                )}
                {t("apps.chat.email.pause")}
              </Button>
            )}
            {status === "paused" && (
              <Button
                variant="outline"
                disabled={lifecycle.isPending}
                onClick={() => lifecycle.mutate("resume")}
              >
                {lifecycle.isPending && lifecycleAction === "resume" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Play />
                )}
                {t("apps.chat.email.resume")}
              </Button>
            )}
            {[
              "active",
              "paused",
              "attention",
              "revoked",
              "draft",
              "verifying",
            ].includes(status) && (
              <Button
                variant="outline"
                disabled={lifecycle.isPending}
                onClick={() =>
                  navigate(
                    endpoint.provider === "agentmail" && status !== "draft" && status !== "verifying"
                      ? `/apps/chat/${endpoint.id}/settings`
                      : `/apps/chat/connect?provider=${endpoint.provider}&purpose=chat&resume=${endpoint.id}${status === "draft" || status === "verifying" ? "" : "&reconnect=1"}`,
                  )
                }
              >
                <RefreshCw />
                {status === "draft" || status === "verifying"
                  ? t("apps.browse.finishSetup")
                  : t("apps.detail.advanced.reconnect")}
              </Button>
            )}
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={lifecycle.isPending}
              onClick={() => setRemoveOpen(true)}
            >
              <Trash2 />
              {t("apps.browse.removeConnection")}
            </Button>
          </div>
          {status !== "draft" && status !== "verifying" && (
            <p className="text-xs text-muted-foreground">
              {t(providerLifecycleGuidanceKeys[endpoint.provider].reconnect)}
            </p>
          )}
        </div>
      )}
        </div>
      </details>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">{t("apps.detail.activity.title")}</h3>
          {endpoint.provider === "speko" && !cursor && <Button size="sm" variant="ghost" onClick={() => { void query.refetch(); calls.onRetry(); }} disabled={query.isFetching || calls.loading}>{t("apps.common.refresh")}</Button>}
        </div>
        {endpoint.provider === "agentmail" && rows.some((item) => item.kind === "publication" && item.status === "delivery_unknown") && (
          <p className="text-sm text-muted-foreground">
            {t("apps.chat.detail.reviewDeliveryPrefix")}{" "}
            <Link to={`/apps/chat/${endpointId}/conversations`} className="underline underline-offset-4">{t("apps.chat.detail.conversationsTask")}</Link>.
          </p>
        )}
        <div className="divide-y divide-border border-y border-border">
          {(query.isLoading || calls.loading) && (
            <div className="flex items-center gap-2 py-5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("apps.chat.detail.loadingActivity")}
            </div>
          )}
          {query.isError && (
            <div className="flex flex-wrap items-center justify-between gap-3 py-4">
              <p className="text-sm text-destructive" role="alert">
                {t("apps.chat.detail.activityLoadError")}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => query.refetch()}
              >
                {t("apps.chat.defaults.tryAgain")}
              </Button>
            </div>
          )}
          {endpoint.provider === "speko" && !cursor && [
            calls.error && t("apps.chat.detail.callActivityError", { error: calls.error }),
            calls.incomingError && t("apps.chat.detail.unapprovedCallsError", { error: calls.incomingError }),
            calls.endError && t("apps.chat.detail.callEndError", { error: calls.endError }),
          ].filter(Boolean).map((message) => <div key={String(message)} className="flex flex-wrap items-center justify-between gap-3 py-4"><p role="alert" className="text-sm text-destructive">{message}</p><Button size="sm" variant="outline" onClick={calls.onRetry}>{t("apps.chat.detail.retryCalls")}</Button></div>)}
          {activityEntries.map(entry => {
            if (entry.kind === "call") return <SpekoCallActivityItem key={entry.id} entry={entry.entry} presentation="activity" onEnd={calls.onEnd} ending={calls.endingSessionId === entry.entry.session.id} />;
            if (entry.kind === "unapproved_call") return <SpekoUnapprovedCallActivityItem key={entry.id} call={entry.call} presentation="activity" />;
            const item = entry.item;
            return (
              <div
                key={entry.id}
                data-activity-kind="connection"
                className="flex items-start gap-3 px-2 py-3 transition-colors hover:bg-accent/50"
              >
                <span className="mt-0.5 text-muted-foreground" aria-hidden="true">
                  {item.kind === "delivery" ? <ArrowDownLeft className="size-4" /> : item.kind === "publication" ? <ArrowUpRight className="size-4" /> : <ActivityIcon className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="min-w-0 flex-1 text-sm font-medium">{item.summary}</p>
                    <StatusBadge status={item.status} />
                    <time dateTime={item.createdAt} title={item.createdAt} className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {formatDateTime(item.createdAt, { includeSeconds: true })}
                    </time>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{t(activityKindLabelKeys[item.kind])}</p>
                  {item.fileTransfer && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.fileTransfer.filename} —{" "}
                      {item.fileTransfer.phase.replaceAll("_", " ")}
                    </p>
                  )}
                  {item.detail && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {activityDetailLabel(item)}:
                      </span>{" "}
                      {item.detail}
                    </p>
                  )}
                </div>
                {endpoint.provider !== "agentmail" && isReplayEligible(item) && (
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={t("apps.chat.detail.replayAria", { kind: item.kind })}
                    disabled={replay.isPending}
                    onClick={() => replay.mutate(item)}
                  >
                    {replay.isPending && replay.variables?.id === item.id ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <RefreshCw />
                    )}
                    {t("apps.chat.detail.replay")}
                  </Button>
                )}
                {endpoint.provider !== "agentmail" && isResolutionEligible(item) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setResolutionItem(item)}
                  >
                    {t("apps.chat.detail.resolve")}
                  </Button>
                )}
              </div>
            );
          })}
          {!query.isLoading && !query.isError && !calls.loading && !calls.error && !calls.incomingError && activityEntries.length === 0 && (
            <p className="py-5 text-sm text-muted-foreground">
              {t("apps.chat.detail.noActivity")}
            </p>
          )}
        </div>
      </div>
      <nav aria-label={t("apps.chat.detail.activityAria")} className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{t("apps.browse.pageOf", { n: cursors.length, total: cursors.length })}</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={cursors.length === 1 || query.isFetching} onClick={() => setCursors((pages) => pages.slice(0, -1))}>{t("apps.browse.previous")}</Button>
          <Button size="sm" variant="outline" disabled={!query.data?.nextCursor || query.isFetching || query.isError} onClick={() => { if (query.data?.nextCursor) setCursors((pages) => [...pages, query.data.nextCursor!]); }}>{t("apps.browse.next")}</Button>
        </div>
      </nav>
      <AlertDialog
        open={resolutionItem !== null}
        onOpenChange={(open) => !open && setResolutionItem(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {resolutionItem?.actionType === "slash_task_start"
                ? t("apps.chat.detail.resolveTaskStartTitle")
                : resolutionItem?.actionType === "provider_effect"
                  ? t("apps.chat.detail.resolveProviderReplyTitle")
                  : t("apps.chat.detail.resolveDeliveryTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {resolutionItem?.actionType === "slash_task_start"
                ? t("apps.chat.detail.resolveTaskStartDesc")
                : resolutionItem?.actionType === "provider_effect"
                  ? t("apps.chat.detail.resolveProviderReplyDesc")
                  : resolutionItem
                    ? activityResolutionDescription(resolutionItem)
                    : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:flex-wrap">
            <AlertDialogCancel disabled={resolveActivity.isPending}>
              {t("apps.chat.detail.keepUnresolved")}
            </AlertDialogCancel>
            {resolutionItem &&
              activityResolutionActions(resolutionItem).includes("cancel") && (
                <Button
                  variant="outline"
                  disabled={resolveActivity.isPending}
                  onClick={() =>
                    resolutionItem &&
                    resolveActivity.mutate({
                      item: resolutionItem,
                      action: "cancel",
                    })
                  }
                >
                  {resolutionItem.actionType === "slash_task_start"
                    ? t("apps.chat.detail.cancelTaskStart")
                    : resolutionItem.actionType === "provider_effect"
                      ? t("apps.chat.detail.cancelProviderReply")
                      : resolutionItem.fileTransfer
                        ? t("apps.chat.detail.cancelFileTransfer")
                        : t("apps.chat.detail.cancelPublication")}
                </Button>
              )}
            {resolutionItem &&
              activityResolutionActions(resolutionItem).includes(
                "retry_anyway",
              ) && (
                <Button
                  variant="outline"
                  disabled={resolveActivity.isPending}
                  onClick={() =>
                    resolutionItem &&
                    resolveActivity.mutate({
                      item: resolutionItem,
                      action: "retry_anyway",
                    })
                  }
                >
                  {resolutionItem.fileTransfer
                    ? t("apps.chat.detail.retryFileNotification")
                    : t("apps.chat.detail.retryAnyway")}
                </Button>
              )}
            {resolutionItem &&
              activityResolutionActions(resolutionItem).includes(
                "mark_delivered",
              ) && (
                <AlertDialogAction
                  disabled={resolveActivity.isPending}
                  onClick={(event) => {
                    event.preventDefault();
                    if (resolutionItem) {
                      resolveActivity.mutate({
                        item: resolutionItem,
                        action: "mark_delivered",
                      });
                    }
                  }}
                >
                  {t("apps.chat.detail.markDelivered")}
                </AlertDialogAction>
              )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("apps.chat.detail.removeConnectionTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("apps.chat.detail.removeConnectionDesc", { name: endpoint.assignedAgentName, provider: providerNames[endpoint.provider] })}{" "}
              {t(providerLifecycleGuidanceKeys[endpoint.provider].remove)}
              {endpoint.provider === "slack" && (
                <> <a
                  href={endpoint.setup?.slackRegistration?.managementUrl ?? "https://api.slack.com/apps"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >{t("apps.chat.slack.openAppSettings")}</a>{t("apps.chat.detail.manageSlackAppSuffix")}</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("apps.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={lifecycle.isPending}
              onClick={() => lifecycle.mutate("remove")}
            >
              {lifecycle.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {t("apps.browse.removeConnection")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
