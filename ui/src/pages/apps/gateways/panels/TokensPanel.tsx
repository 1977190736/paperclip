import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, KeyRound, Plus } from "lucide-react";
import type {
  ToolMcpGatewayToken,
  ToolMcpGatewayTokenAction,
  ToolMcpGatewayTokenCreated,
  ToolMcpGatewayWithTokens,
} from "@paperclipai/shared";
import { toolsApi } from "@/api/tools";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { useToast } from "@/context/ToastContext";
import { copyTextToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import { RelativeTime } from "@/pages/tools/shared";
import { gatewaysQueryKey } from "../NewGatewayDialog";
import {
  defaultGatewayTokenName,
  maskedTokenLabel,
  toDate,
  tokenStatus,
  type TokenStatus,
} from "../gateway-helpers";
import { t, useTranslation } from "@/i18n";

const DEFAULT_ACTIONS: ToolMcpGatewayTokenAction[] = ["tools/list", "tools/call"];
const TOKEN_PAGE_SIZE = 10;

function defaultExpiry(): string {
  return new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const STATUS_CLASS: Record<TokenStatus, string> = {
  active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  expiring: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  expired: "border-border bg-muted text-muted-foreground",
  revoked: "border-foreground bg-foreground text-background",
};

function StatusBadge({ status }: { status: TokenStatus }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        STATUS_CLASS[status],
      )}
    >
      {t(tokenStatusLabelKey(status))}
    </span>
  );
}

function tokenStatusLabelKey(status: TokenStatus): string {
  switch (status) {
    case "active": return "apps.gateways.tokens.status.active";
    case "expiring": return "apps.gateways.tokens.status.expiring";
    case "expired": return "apps.gateways.tokens.status.expired";
    case "revoked": return "apps.gateways.tokens.status.revoked";
  }
}

function TokenField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-(length:--text-micro) font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-foreground">{value}</dd>
    </div>
  );
}

function ExpiryValue({ token }: { token: ToolMcpGatewayToken }) {
  const expiresAt = toDate(token.expiresAt);
  if (!expiresAt) return <>{t("apps.gateways.tokens.noExpiry")}</>;
  if (expiresAt.getTime() <= Date.now()) {
    return <><span className="font-medium text-foreground">{t("apps.identity.status.expired")}</span> <RelativeTime value={token.expiresAt} /></>;
  }
  return <>{t("apps.gateways.tokens.expiresPrefix")} <RelativeTime value={token.expiresAt} /></>;
}

export function TokensPanel({
  companyId,
  gateway,
  onTokenCreated,
}: {
  companyId: string;
  gateway: ToolMcpGatewayWithTokens;
  onTokenCreated?: (token: ToolMcpGatewayTokenCreated) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [minting, setMinting] = useState(false);
  const [name, setName] = useState("");
  const [ownerNote, setOwnerNote] = useState("");
  const [expiresAt, setExpiresAt] = useState(defaultExpiry());
  const [created, setCreated] = useState<ToolMcpGatewayTokenCreated | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [revokeName, setRevokeName] = useState("");
  const [confirmToken, setConfirmToken] = useState<{ id: string; name: string } | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: gatewaysQueryKey(companyId) });
  const tokens = useMemo(
    () => [...gateway.tokens].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [gateway.tokens],
  );
  const pageCount = Math.max(1, Math.ceil(tokens.length / TOKEN_PAGE_SIZE));
  const visibleTokens = tokens.slice((historyPage - 1) * TOKEN_PAGE_SIZE, historyPage * TOKEN_PAGE_SIZE);

  useEffect(() => {
    setHistoryPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const createMutation = useMutation({
    mutationFn: () =>
      toolsApi.createGatewayToken(companyId, gateway.id, {
        name: name.trim(),
        clientLabel: name.trim(),
        ownerNote: ownerNote.trim(),
        allowedActions: DEFAULT_ACTIONS,
        expiresAt: expiresAt ? `${expiresAt}T23:59:59.000Z` : null,
      }),
    onSuccess: async (token) => {
      setCreated(token);
      setRevealed(true);
      setMinting(false);
      setName("");
      setOwnerNote("");
      setExpiresAt(defaultExpiry());
      pushToast({
        title: t("apps.gateways.tokens.issuedTitle"),
        body: t("apps.gateways.tokens.issuedBody"),
        tone: "success",
      });
      onTokenCreated?.(token);
      await invalidate();
    },
    onError: (error) =>
      pushToast({
        title: t("apps.gateways.tokens.issueFailedTitle"),
        body: error instanceof Error ? error.message : String(error),
        tone: "error",
      }),
  });

  const revokeMutation = useMutation({
    mutationFn: (tokenId: string) => toolsApi.revokeGatewayToken(companyId, tokenId),
    onSuccess: async (token) => {
      setConfirmToken(null);
      setRevokeName("");
      pushToast({ title: t("apps.gateways.tokens.revokedTitle"), body: t("apps.gateways.tokens.revokedBody", { name: token.name }), tone: "success" });
      await invalidate();
    },
    onError: (error) =>
      pushToast({
        title: t("apps.gateways.tokens.revokeFailedTitle"),
        body: error instanceof Error ? error.message : String(error),
        tone: "error",
      }),
  });

  async function copyToken(value: string) {
    try {
      await copyTextToClipboard(value);
      pushToast({ title: t("apps.chat.common.copied"), body: t("apps.gateways.tokens.accessToken"), tone: "success" });
    } catch (error) {
      pushToast({
        title: t("apps.chat.location.copyFailed"),
        body: error instanceof Error ? error.message : t("apps.gateways.clipboardUnavailable"),
        tone: "error",
      });
    }
  }

  function startIssuing() {
    if (!minting && !name.trim()) setName(defaultGatewayTokenName(gateway));
    setMinting((value) => !value);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate();
  }

  function startRevoke(token: ToolMcpGatewayToken) {
    setConfirmToken({ id: token.id, name: token.name });
    setRevokeName("");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl space-y-1">
          <p className="text-sm text-muted-foreground">
            {t("apps.gateways.tokens.intro")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("apps.gateways.tokens.runtimeNote")}
          </p>
        </div>
        <Button size="sm" onClick={startIssuing}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t("apps.gateways.tokens.issueToken")}
        </Button>
      </div>

      {minting ? (
        <form className="space-y-3" onSubmit={submit}>
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <label className="space-y-1.5 text-sm">
              <span className="text-xs font-medium text-muted-foreground">{t("apps.gateways.tokens.name")}</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
              <span className="text-xs text-muted-foreground">{t("apps.gateways.tokens.nameHint")}</span>
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-xs font-medium text-muted-foreground">{t("apps.gateways.tokens.expires")}</span>
              <Input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} required />
            </label>
          </div>
          <label className="block space-y-1.5 text-sm">
            <span className="text-xs font-medium text-muted-foreground">{t("apps.gateways.tokens.ownerNote")}</span>
            <Input
              value={ownerNote}
              onChange={(event) => setOwnerNote(event.target.value)}
              placeholder={t("apps.gateways.tokens.ownerNotePlaceholder")}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setMinting(false)}>
              {t("apps.common.cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={createMutation.isPending || !name.trim()}>
              {createMutation.isPending ? t("apps.gateways.tokens.issuing") : t("apps.gateways.tokens.issueToken")}
            </Button>
          </div>
        </form>
      ) : null}

      {created ? (
        <div className="space-y-2 border-y border-border py-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-foreground">{t("apps.gateways.tokens.newTokenTitle")}</div>
              <div className="text-xs text-muted-foreground">
                {t("apps.gateways.tokens.newTokenDesc")}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setCreated(null)} aria-label={t("apps.gateways.tokens.dismissAria")}>
              {t("apps.common.dismiss")}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-muted px-3 py-2 font-mono text-xs text-foreground">
              {revealed ? created.token : maskedTokenLabel(created)}
            </code>
            {revealed ? (
              <Button variant="outline" size="sm" onClick={() => void copyToken(created.token)}>
                <Copy className="mr-1 h-3.5 w-3.5" />
                {t("apps.common.copy")}
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setRevealed(true)}>{t("apps.gateways.tokens.show")}</Button>
            )}
          </div>
        </div>
      ) : null}

      <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="h-auto w-full justify-between px-0 py-1 hover:bg-transparent">
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              {t("apps.gateways.tokens.history")}
              <span className="font-normal text-muted-foreground">{tokens.length}</span>
            </span>
            {historyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-3">
          {tokens.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">{t("apps.gateways.tokens.noneYet")}</p>
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
                <table className="w-full min-w-(--sz-44rem) text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-(length:--text-micro) font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5">{t("apps.gateways.tokens.colToken")}</th>
                      <th className="px-4 py-2.5">{t("apps.gateways.tokens.colOwner")}</th>
                      <th className="px-4 py-2.5">{t("apps.gateways.tokens.colCreated")}</th>
                      <th className="px-4 py-2.5">{t("apps.connections.colLastUsed")}</th>
                      <th className="px-4 py-2.5">{t("apps.gateways.tokens.colExpiry")}</th>
                      <th className="px-4 py-2.5">{t("apps.detail.test.dtStatus")}</th>
                      <th className="px-4 py-2.5 text-right" />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTokens.map((token) => {
                      const status = tokenStatus(token);
                      return (
                        <tr key={token.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">{token.name}</div>
                            <div className="font-mono text-xs text-muted-foreground">{maskedTokenLabel(token)}</div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{token.clientLabel || token.ownerNote || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground"><RelativeTime value={token.createdAt} /></td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {token.lastUsedAt ? <RelativeTime value={token.lastUsedAt} /> : "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground"><ExpiryValue token={token} /></td>
                          <td className="px-4 py-3"><StatusBadge status={status} /></td>
                          <td className="px-4 py-3 text-right">
                            {status !== "revoked" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                onClick={() => startRevoke(token)}
                              >
                                {t("apps.detail.advanced.revoke")}
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 sm:hidden">
                {visibleTokens.map((token) => {
                  const status = tokenStatus(token);
                  return (
                    <div key={token.id} className="border-b border-border py-3 last:border-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-foreground">{token.name}</div>
                          <div className="font-mono text-xs text-muted-foreground">{maskedTokenLabel(token)}</div>
                        </div>
                        <StatusBadge status={status} />
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <TokenField label={t("apps.gateways.tokens.colOwner")} value={token.clientLabel || token.ownerNote || "—"} />
                        <TokenField label={t("apps.gateways.tokens.colCreated")} value={<RelativeTime value={token.createdAt} />} />
                        <TokenField label={t("apps.connections.colLastUsed")} value={token.lastUsedAt ? <RelativeTime value={token.lastUsedAt} /> : "—"} />
                        <TokenField label={t("apps.gateways.tokens.colExpiry")} value={<ExpiryValue token={token} />} />
                      </dl>
                      {status !== "revoked" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-3 w-full text-xs text-destructive hover:text-destructive"
                          onClick={() => startRevoke(token)}
                        >
                          {t("apps.detail.advanced.revoke")}
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {pageCount > 1 ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {t("apps.gateways.tokens.pageOf", { n: historyPage, total: pageCount, count: tokens.length })}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={historyPage === 1}
                      onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                      aria-label={t("apps.gateways.tokens.prevPageAria")}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={historyPage === pageCount}
                      onClick={() => setHistoryPage((page) => Math.min(pageCount, page + 1))}
                      aria-label={t("apps.gateways.tokens.nextPageAria")}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CollapsibleContent>
      </Collapsible>

      {confirmToken ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md space-y-3 rounded-lg border border-border bg-card p-5 shadow-lg">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t("apps.gateways.tokens.revokeTitle")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("apps.gateways.tokens.revokeDesc", { name: confirmToken.name })}
              </p>
            </div>
            <Input
              value={revokeName}
              onChange={(event) => setRevokeName(event.target.value)}
              placeholder={confirmToken.name}
              aria-label={t("apps.gateways.tokens.confirmAria")}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setConfirmToken(null);
                  setRevokeName("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={revokeName.trim() !== confirmToken.name || revokeMutation.isPending}
                onClick={() => revokeMutation.mutate(confirmToken.id)}
              >
                {revokeMutation.isPending ? t("apps.gateways.tokens.revoking") : t("apps.gateways.tokens.revokeToken")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
