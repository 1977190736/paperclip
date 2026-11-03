import { heartbeatsApi } from "@/api/heartbeats";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiConnectionsApi } from "@/api/ai-connections";
import { toolsApi } from "@/api/tools";
import { useNavigate } from "@/lib/router";
import { AiConnectionAccountControls } from "./AiConnectionAccountControls";
import { AiConnectionUsagePanel } from "./AiConnectionUsagePanel";
import { AiConnectionAccountDetails } from "./AiConnectionAccountDetails";
import type { ToolConnection, AiConnectionMetadata } from "@paperclipai/shared";
import { aiMethodLabel } from "./model";
import { queryKeys } from "@/lib/queryKeys";
import { retryTransientOnly } from "@/lib/query-client";
import { describeError } from "@/api/errors";
import { useTranslation } from "@/i18n";

export function ManagedAiConnectionRow({
  connection,
}: {
  connection: ToolConnection;
}) {
  const { t } = useTranslation();
  const metadata = connection.config?.ai as AiConnectionMetadata | undefined;
  if (!metadata) return null;
  return (
    <p className="text-xs text-muted-foreground">
      {metadata.routing ? metadata.routing.kind === "bedrock" ? `${t("connections.model.bedrock")} · ${metadata.routing.region}` : metadata.routing.kind === "openrouter" ? "OpenRouter" : metadata.routing.baseUrl : aiMethodLabel(metadata.provider, metadata.method)} ·{" "}
      {connection.credentialPolicy === "per_user"
        ? t("connections.model.personal")
        : t("connections.model.companyShared")}
    </p>
  );
}
export function ManagedAiConnectionDetails({
  connection,
}: {
  connection: ToolConnection;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const navigate = useNavigate();
  const runs = useQuery({
    queryKey: ["ai-connection-active-runs", connection.id],
    queryFn: () =>
      aiConnectionsApi.activeRuns(connection.companyId, connection.id),
  });
  const accounts = useQuery({
    queryKey: ["ai-connections", connection.companyId],
    queryFn: ({ signal }) => aiConnectionsApi.list(connection.companyId, undefined, { signal }),
    retry: retryTransientOnly(1),
  });
  const grants = useQuery({
    queryKey: queryKeys.tools.connectionGrants(connection.id),
    queryFn: ({ signal }) => toolsApi.listConnectionGrants(connection.id, { signal }),
    retry: retryTransientOnly(1),
  });
  const refresh = () => client.invalidateQueries();
  const makeDefault = useMutation({
    mutationFn: (id: string) =>
      aiConnectionsApi.setDefault(connection.companyId, id),
    onSuccess: refresh,
  });
  const revoke = useMutation({
    mutationFn: (id: string) =>
      toolsApi.revokeConnectionGrant(connection.id, id),
    onSuccess: refresh,
  });
  const stop = useMutation({
    mutationFn: (id: string) => heartbeatsApi.cancel(id),
    onSuccess: refresh,
  });
  const account = accounts.data?.connections.find(
    (a) => a.id === connection.id,
  );
  const grant = grants.data?.grants.find((g) => g.id === account?.grantId);
  const loadError = accounts.error ?? grants.error;
  const error = makeDefault.error ?? stop.error;
  const loadFailure = loadError ? (
    <div role="alert" className="space-y-2">
      <p className="text-sm text-destructive">{describeError(loadError).body}</p>
      <Button
        variant="outline"
        size="sm"
        disabled={accounts.isFetching || grants.isFetching}
        onClick={() => {
          if (accounts.error) void accounts.refetch();
          if (grants.error) void grants.refetch();
        }}
      >
        {t("connections.aiPool.retry")}
      </Button>
    </div>
  ) : null;
  if ((!account || !grant) && loadFailure) return loadFailure;
  if (!account || !grant)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {accounts.isPending || grants.isPending
          ? t("connections.aiManaged.loadingAccount")
          : t("connections.aiManaged.accountUnavailable")}
      </p>
    );
  return (
    <div className="space-y-4">
      {loadFailure}
      {error && <p role="alert" className="text-sm text-destructive">{error.message}</p>}
      <AiConnectionAccountDetails account={account} grant={grant} />
      {account.routing && <details className="rounded-lg border border-border p-4"><summary className="cursor-pointer text-sm font-medium">{t("connections.aiManaged.providerSettings")}</summary><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><dt className="text-muted-foreground">{t("connections.aiManaged.destination")}</dt><dd className="break-all">{account.routing.baseUrl ?? (account.routing.kind === "bedrock" ? account.routing.region : "OpenRouter")}</dd><dt className="text-muted-foreground">{t("connections.aiProviderSetup.apiFormat")}</dt><dd>{account.routing.kind === "openrouter" ? t("connections.aiManaged.selectedByHarness") : account.routing.protocol}</dd><dt className="text-muted-foreground">{t("connections.aiProviderSetup.authentication")}</dt><dd>{account.routing.auth}</dd><dt className="text-muted-foreground">{t("connections.model.models")}</dt><dd>{account.routing.models.map(m => m.label ?? m.id).join(", ") || t("connections.aiManaged.enterModelOnAgent")}</dd></dl></details>}
      <AiConnectionAccountControls
        account={account}
        grant={grant}
        currentUserId={accounts.data!.currentUserId}
        onMakeDefault={() => makeDefault.mutate(grant.id)}
        onRevoke={() => revoke.mutateAsync(grant.id).then(() => undefined)}
        revocationDetails={
          <div className="space-y-2">
            {runs.error && (
              <p role="alert">
                {t("connections.aiManaged.loadActiveRunsFailed")}
              </p>
            )}
            {runs.data?.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span>
                  {run.agentName} · {run.status}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={stop.isPending}
                  onClick={() => stop.mutate(run.id)}
                >
                  {t("connections.aiManaged.stopRun")}
                </Button>
              </div>
            ))}
          </div>
        }
        onReconnect={() =>
          navigate(
            `/apps/connect?source=${account.provider}&reconnect=${connection.id}&method=ai-${account.method}`,
          )
        }
      />
      <AiConnectionUsagePanel key={`${account.id}:${account.grantId}:${account.status}`} account={account} />
    </div>
  );
}
