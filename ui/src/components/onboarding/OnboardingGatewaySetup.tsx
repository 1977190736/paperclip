import { useState } from "react";
import type { AiConnectionBinding } from "@paperclipai/shared";
import { AiProviderSetup } from "../ai-connections/AiProviderSetup";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { useTranslation } from "@/i18n";

export function OnboardingGatewaySetup({
  companyId,
  agentId,
  environmentId,
  adapterType,
  disabled,
  onComplete,
}: {
  companyId: string;
  agentId?: string;
  environmentId?: string;
  adapterType: "codex_local" | "claude_local";
  disabled?: boolean;
  onComplete: (binding: Exclude<AiConnectionBinding, { mode: "responsible_user" }>) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return <>
    <Button type="button" variant="ghost" disabled={disabled} onClick={() => setOpen(true)}>
      {t("comps3.onboardingGateway.useCustom")}
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-(--sz-85vh) overflow-y-auto sm:max-w-2xl" onKeyDown={event => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{t("comps3.onboardingGateway.title")}</DialogTitle>
          <DialogDescription>{t("comps3.onboardingGateway.description")}</DialogDescription>
        </DialogHeader>
        <AiProviderSetup companyId={companyId} agentId={agentId} environmentId={environmentId}
          initialProvider="gateway" initialProtocol={adapterType === "codex_local" ? "responses" : "messages"}
          submitLabel={t("comps3.onboardingGateway.saveConnection")} onCancel={() => setOpen(false)}
          onComplete={binding => { setOpen(false); onComplete(binding); }} />
      </DialogContent>
    </Dialog>
  </>;
}
