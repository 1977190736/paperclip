import { InlineBanner } from "@/components/InlineBanner";
import { t } from "@/i18n";
import { webhookUrlWarningReason } from "@/lib/webhook-url-warning";


export function WebhookUrlWarning({ url }: { url: string }) {
  const reason = webhookUrlWarningReason(url);
  if (!reason) return null;
  const warning = {
    title: t(`comps1.webhookUrlWarning.${reason}.title`),
    message: t(`comps1.webhookUrlWarning.${reason}.message`),
  };
  return <InlineBanner tone="warning" title={warning.title}>
    <div className="space-y-2">
      <p>{warning.message}</p>
      <p>{t("comps1.webhookUrlWarning.localNote")}</p>
      <a className="underline underline-offset-4" href="https://docs.paperclip.ing/reference/deploy/https/" target="_blank" rel="noopener noreferrer">{t("comps1.webhookUrlWarning.docsLink")}</a>
    </div>
  </InlineBanner>;
}
