import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { accessApi } from "../api/access";
import { ApiError } from "../api/client";
import { authApi } from "../api/auth";
import { queryKeys } from "../lib/queryKeys";
import { t, useTranslation } from "@/i18n";

function cliAuthRetryDelay(error: unknown): number {
  const body = error instanceof ApiError && error.body && typeof error.body === "object"
    ? error.body as { details?: unknown } : null;
  const details = body?.details && typeof body.details === "object"
    ? body.details as { retryAfterSeconds?: unknown } : null;
  const milliseconds = typeof details?.retryAfterSeconds === "number" ? details.retryAfterSeconds * 1000 : Number.NaN;
  return Number.isFinite(milliseconds) && milliseconds > 0 ? Math.max(1000, milliseconds) : 60_000;
}

function isCliAuthRateLimit(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 429;
}

export function CliAuthPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const challengeId = (params.id ?? "").trim();
  const token = (searchParams.get("token") ?? "").trim();
  const currentPath = useMemo(
    () => `/cli-auth/${encodeURIComponent(challengeId)}${token ? `?token=${encodeURIComponent(token)}` : ""}`,
    [challengeId, token],
  );

  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });
  const challengeQueryKey = useMemo(() => ["cli-auth-challenge", challengeId, token] as const, [challengeId, token]);
  const retryWindowEndsAt = useMemo(() => Date.now() + 10 * 60_000, [challengeId, token]);
  const challengeQuery = useQuery({
    queryKey: challengeQueryKey,
    queryFn: () => accessApi.getCliAuthChallenge(challengeId, token),
    enabled: challengeId.length > 0 && token.length > 0,
    retry: (failureCount, error) => {
      if (!isCliAuthRateLimit(error) || failureCount >= 3) return false;
      const knownChallenge = queryClient.getQueryData<{ expiresAt: string }>(challengeQueryKey);
      const knownExpiry = Date.parse(knownChallenge?.expiresAt ?? "");
      const deadline = Number.isFinite(knownExpiry) ? Math.min(knownExpiry, retryWindowEndsAt) : retryWindowEndsAt;
      return Date.now() + cliAuthRetryDelay(error) < deadline;
    },
    retryDelay: (_failureCount, error) => cliAuthRetryDelay(error),
  });

  const approveMutation = useMutation({
    mutationFn: () => accessApi.approveCliAuthChallenge(challengeId, token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      await challengeQuery.refetch();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => accessApi.cancelCliAuthChallenge(challengeId, token),
    onSuccess: async () => {
      await challengeQuery.refetch();
    },
  });

  if (!challengeId || !token) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-destructive">{t("pages2.cliAuth.invalidUrl")}</div>;
  }

  const waitingForRateLimit = isCliAuthRateLimit(challengeQuery.failureReason) && challengeQuery.isFetching;
  if (sessionQuery.isLoading || challengeQuery.isLoading || waitingForRateLimit) {
    return <div role="status" className="mx-auto max-w-xl py-10 text-sm text-muted-foreground">
      {waitingForRateLimit ? t("pages2.cliAuth.rateLimited") : t("pages2.cliAuth.loadingChallenge")}
    </div>;
  }

  if (challengeQuery.error) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <Card className="block p-6">
          <h1 className="text-lg font-semibold">{t("pages2.cliAuth.challengeUnavailable")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {challengeQuery.error instanceof Error ? challengeQuery.error.message : t("pages2.boardClaim.challengeInvalid")}
          </p>
        </Card>
      </div>
    );
  }

  const challenge = challengeQuery.data;
  if (!challenge) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-destructive">{t("pages2.cliAuth.challengeUnavailable")}</div>;
  }

  if (challenge.status === "approved") {
    return (
      <div className="mx-auto max-w-xl py-10">
        <Card className="block p-6">
          <h1 className="text-xl font-semibold">{t("pages2.cliAuth.approved")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("pages2.cliAuth.approvedBody")}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            {t("pages2.cliAuth.commandLabel")} <span className="font-mono text-foreground">{challenge.command}</span>
          </p>
        </Card>
      </div>
    );
  }

  if (challenge.status === "cancelled" || challenge.status === "expired") {
    return (
      <div className="mx-auto max-w-xl py-10">
        <Card className="block p-6">
          <h1 className="text-xl font-semibold">
            {challenge.status === "expired" ? t("pages2.cliAuth.expired") : t("pages2.cliAuth.cancelled")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("pages2.cliAuth.restartHint")}
          </p>
        </Card>
      </div>
    );
  }

  if (challenge.requiresSignIn || !sessionQuery.data) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <Card className="block p-6">
          <h1 className="text-xl font-semibold">{t("pages2.boardClaim.signInRequired")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("pages2.cliAuth.signInBody")}
          </p>
          <Button asChild className="mt-4">
            <Link to={`/auth?next=${encodeURIComponent(currentPath)}`}>{t("pages2.boardClaim.signInCta")}</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl py-10">
      <Card className="block p-6">
        <h1 className="text-xl font-semibold">{t("pages2.cliAuth.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("pages2.cliAuth.body")}
        </p>

        <div className="mt-5 space-y-3 text-sm">
          <div>
            <div className="text-muted-foreground">{t("pages2.cliAuth.commandLabel")}</div>
            <div className="font-mono text-foreground">{challenge.command}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{t("pages2.cliAuth.client")}</div>
            <div className="text-foreground">{challenge.clientName ?? "paperclipai cli"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{t("pages2.cliAuth.requestedAccess")}</div>
            <div className="text-foreground">
              {challenge.requestedAccess === "instance_admin_required" ? t("pages2.cliAccess.instanceAdmin") : t("pages2.cliAccess.board")}
            </div>
          </div>
          {challenge.requestedCompanyName && (
            <div>
              <div className="text-muted-foreground">{t("pages2.cliAuth.auditOrg")}</div>
              <div className="text-foreground">{challenge.requestedCompanyName}</div>
            </div>
          )}
        </div>

        {(approveMutation.error || cancelMutation.error) && (
          <p className="mt-4 text-sm text-destructive">
            {(approveMutation.error ?? cancelMutation.error) instanceof Error
              ? ((approveMutation.error ?? cancelMutation.error) as Error).message
              : t("pages2.cliAuth.updateFailed")}
          </p>
        )}

        {!challenge.canApprove && (
          <p className="mt-4 text-sm text-destructive">
            {challenge.requestedAccess === "instance_admin_required"
              ? t("pages2.cliAuth.needsAdmin")
              : t("pages2.cliAuth.noAccess")}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <Button
            onClick={() => approveMutation.mutate()}
            disabled={!challenge.canApprove || approveMutation.isPending || cancelMutation.isPending}
          >
            {approveMutation.isPending ? t("pages2.cliAuth.approving") : t("pages2.cliAuth.approveCta")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => cancelMutation.mutate()}
            disabled={approveMutation.isPending || cancelMutation.isPending}
          >
            {cancelMutation.isPending ? t("pages2.cliAuth.cancelling") : t("pages2.cliAuth.cancel")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
