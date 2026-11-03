import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toolsApi } from "@/api/tools";
import { useAccountIdentity } from "@/api/companies-query";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ToolConnection } from "@paperclipai/shared";
import { useTranslation } from "@/i18n";

export function ArcadeDiscoverySetup({ connection, onClose }: { connection: ToolConnection; onClose: () => void }) {
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState("");
  const [userId, setUserId] = useState("");
  const queries = useQueryClient();
  const { userId: viewingUserId, settled } = useAccountIdentity();
  const save = useMutation({ mutationFn: async () => {
      const result = await toolsApi.configureArcadeDiscovery(connection.id, { apiKey: apiKey.trim(), userId: userId.trim() });
      queries.setQueryData(queryKeys.tools.aggregatorApps(connection.id, viewingUserId), result);
    },
    onSuccess: onClose,
  });
  return <Dialog open onOpenChange={open => { if (!open && !save.isPending) onClose(); }}><DialogContent>
    <DialogHeader><DialogTitle>{t("apps.arcade.title")}</DialogTitle>
      <DialogDescription>{t("apps.arcade.desc", { name: connection.name })}</DialogDescription>
    </DialogHeader>
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); save.mutate(); }}>
      <div className="space-y-2"><Label htmlFor="arcade-discovery-key">{t("apps.arcade.apiKey")}</Label>
        <p className="text-xs text-muted-foreground">{t("apps.arcade.keyHintPrefix")} <a className="underline" href="https://app.arcade.dev" target="_blank" rel="noopener noreferrer">Arcade</a>{t("apps.arcade.keyHintSuffix")}</p>
        <Input id="arcade-discovery-key" type="password" autoComplete="off" required value={apiKey} onChange={event => setApiKey(event.target.value)} />
      </div>
      <div className="space-y-2"><Label htmlFor="arcade-discovery-user">{t("apps.arcade.userId")}</Label>
        <p className="text-xs text-muted-foreground">{t("apps.arcade.userIdHint")}</p>
        <Input id="arcade-discovery-user" autoComplete="off" required value={userId} onChange={event => setUserId(event.target.value)} />
      </div>
      {save.isError ? <p role="alert" className="text-sm text-destructive">{save.error instanceof Error ? save.error.message : t("apps.arcade.saveError")}</p> : null}
      <DialogFooter className="sm:justify-between"><Button type="button" variant="ghost" disabled={save.isPending} onClick={onClose}>{t("apps.common.cancel")}</Button>
        <Button type="submit" disabled={!settled || save.isPending || !apiKey.trim() || !userId.trim()}>{save.isPending ? t("apps.chat.instructions.saving") : t("apps.arcade.saveAndSync")}</Button>
      </DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
