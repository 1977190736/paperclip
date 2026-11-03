import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { connectionInstructionsConfig, type ToolConnection } from "@paperclipai/shared";
import { toolsApi } from "@/api/tools";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineBanner } from "@/components/InlineBanner";
import { useTranslation } from "@/i18n";

export function HonchoWorkspaceSettings({ connection, canConfigure }: { connection: ToolConnection; canConfigure: boolean }) {
  const { t } = useTranslation();
  const id = useId();
  const client = useQueryClient();
  const connectionConfig = connectionInstructionsConfig(connection);
  const config = (connectionConfig.methodConfig ?? {}) as Record<string, unknown>;
  const saved = typeof config.workspaceId === "string" ? config.workspaceId : "";
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? saved;
  const mutation = useMutation({
    mutationFn: () => toolsApi.updateConnection(connection.id, { config: { ...connectionConfig, methodConfig: { ...config, workspaceId: value.trim() } } }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["tools"] }); setDraft(null); },
  });
  return <section className="space-y-3" aria-label={t("connections.honcho.heading")}>
    <label htmlFor={id} className="text-sm font-medium">{t("connections.honcho.heading")}</label>
    <Input id={id} value={value} maxLength={512} disabled={!canConfigure || mutation.isPending} placeholder={t("connections.honcho.workspaceId")} onChange={(event) => setDraft(event.target.value)} />
    {!value.trim() && <InlineBanner tone="warning">{t("connections.honcho.workspaceRequired")}</InlineBanner>}
    {mutation.isError && <div role="alert"><InlineBanner tone="danger">{mutation.error.message}</InlineBanner></div>}
    {draft !== null && draft !== saved && <div className="flex items-center justify-between">
      <Button variant="ghost" disabled={mutation.isPending} onClick={() => { setDraft(null); mutation.reset(); }}>{t("connections.honcho.cancel")}</Button>
      <Button disabled={!canConfigure || mutation.isPending || !value.trim()} onClick={() => mutation.mutate()}>{mutation.isPending ? t("connections.honcho.saving") : t("connections.honcho.saveWorkspace")}</Button>
    </div>}
  </section>;
}
