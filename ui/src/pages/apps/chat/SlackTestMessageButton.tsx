import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Send } from "lucide-react";
import type { SlackTestMessageResult } from "@paperclipai/shared";
import { chatEndpointsApi } from "@/api/chatEndpoints";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/i18n";
import { queryKeys } from "@/lib/queryKeys";

export function SlackTestMessageButton({ endpointId }: { endpointId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [accounts, setAccounts] = useState<Extract<SlackTestMessageResult, { status: "connection_required" }>["accounts"] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [invitationExpired, setInvitationExpired] = useState(false);
  const [search, setSearch] = useState("");
  const send = useMutation({
    mutationFn: (input: { slackUserId?: string; accountCursor?: string; requestId?: string }) => chatEndpointsApi.sendSlackTestMessage(endpointId, { requestId, ...input }),
    onSuccess: (result, input) => {
      if (result.status === "connection_required") {
        setAccounts(previous => input.accountCursor ? [...new Map([...(previous ?? []), ...result.accounts].map(account => [account.id, account])).values()] : result.accounts);
        setNextCursor(result.nextCursor);
        return;
      }
      setAccounts(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.chatEndpoints.principals(endpointId) });
    },
  });
  const sent = send.data?.status === "sent";
  const pendingConnection = send.data?.status === "connection_pending" ? send.data : null;
  useEffect(() => {
    setInvitationExpired(false);
    if (!pendingConnection) return;
    const timer = setTimeout(() => setInvitationExpired(true), Math.max(0, new Date(pendingConnection.expiresAt).getTime() - Date.now()));
    return () => clearTimeout(timer);
  }, [pendingConnection?.expiresAt]);
  const principals = useQuery({
    queryKey: queryKeys.chatEndpoints.principals(endpointId),
    queryFn: () => chatEndpointsApi.listPrincipals(endpointId),
    enabled: Boolean(pendingConnection) && !invitationExpired, refetchInterval: pendingConnection && !invitationExpired ? 3000 : false,
  });
  const confirmed = Boolean(pendingConnection && principals.data?.some(link => link.principalId === pendingConnection.principalId && link.status === "linked"));
  useEffect(() => {
    if (confirmed && !send.isPending && !send.isError) send.mutate({ slackUserId: selected });
  }, [confirmed, send.isPending, send.isError]);
  const reset = () => { setRequestId(crypto.randomUUID()); send.reset(); };
  const startTest = () => {
    if (invitationExpired) {
      const next = crypto.randomUUID(); setRequestId(next);
      send.mutate({ requestId: next, slackUserId: selected });
    } else send.mutate({});
  };
  return <div className="space-y-2">
      <Button variant="outline" disabled={send.isPending || sent || Boolean(pendingConnection && !invitationExpired)} onClick={startTest}>
        {send.isPending ? <Loader2 className="size-4 animate-spin" /> : sent ? <Check className="size-4" /> : <Send className="size-4" />}
        {send.isPending ? t("apps.chat.testMessage.sending") : sent ? t("apps.chat.testMessage.sent") : invitationExpired ? t("apps.chat.testMessage.requestNewInvitation") : pendingConnection ? t("apps.chat.testMessage.waitingConnection") : t("apps.chat.testMessage.sendTest")}
      </Button>
    {pendingConnection && <p role="status" className="text-sm text-muted-foreground">{invitationExpired ? t("apps.chat.testMessage.invitationExpired") : t("apps.chat.testMessage.openInvitation")}</p>}
    {send.isError && <div role="alert" className="max-w-sm text-sm text-destructive">
      {send.error.message} <button className="underline" onClick={reset}>{t("apps.common.dismiss")}</button>
    </div>}
    <Dialog open={accounts !== null} onOpenChange={(open) => { if (!open && !send.isPending) setAccounts(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("apps.chat.slackSetup.steps.connectAccount")}</DialogTitle>
          <DialogDescription>{t("apps.chat.testMessage.dialogDescription")}</DialogDescription>
        </DialogHeader>
        <Input aria-label={t("apps.chat.testMessage.findAria")} placeholder={t("apps.chat.testMessage.findPlaceholder")} value={search} onChange={event => setSearch(event.target.value)} />
        <div className="max-h-64 space-y-1 overflow-y-auto" role="radiogroup" aria-label={t("apps.chat.testMessage.groupAria")}>
          {accounts?.filter(account => `${account.name} ${account.id}`.toLowerCase().includes(search.toLowerCase())).map(account =>
            <label key={account.id} className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 text-sm">
              <input type="radio" name="slack-account" value={account.id} checked={selected === account.id} onChange={() => setSelected(account.id)} />
              <span>{account.name} <span className="text-muted-foreground">({account.id})</span></span>
            </label>)}
          {accounts?.length === 0 && <p className="text-sm text-muted-foreground">{t("apps.chat.testMessage.noAccounts")}</p>}
        </div>
        {nextCursor && <Button variant="ghost" disabled={send.isPending} onClick={() => send.mutate({ accountCursor: nextCursor })}>{t("apps.chat.testMessage.loadMore")}</Button>}
        {send.isError && <p role="alert" className="text-sm text-destructive">{send.error.message}</p>}
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" disabled={send.isPending} onClick={() => setAccounts(null)}>{t("apps.common.cancel")}</Button>
          <Button disabled={!selected || send.isPending} onClick={() => send.mutate({ slackUserId: selected })}>{send.isPending ? t("apps.chat.testMessage.sendingInvitation") : t("apps.chat.testMessage.sendInvitation")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}
