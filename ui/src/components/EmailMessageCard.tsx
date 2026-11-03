import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, Paperclip } from "lucide-react";
import type {
  EmailMessage,
  EmailPublicationSummary,
  EmailThreadSummary,
} from "@paperclipai/shared";
import { useEmailThread } from "@/hooks/useEmailThread";
import { issuesApi } from "@/api/issues";
import { useTranslation } from "@/i18n";
const EmailContext = createContext<EmailThreadSummary | null>(null);
export function EmailThreadProvider({
  companyId,
  issueId,
  children,
}: {
  companyId: string;
  issueId: string;
  children: ReactNode;
}) {
  const thread = useEmailThread(companyId, issueId);
  return (
    <EmailContext.Provider value={thread.data ?? null}>
      {children}
    </EmailContext.Provider>
  );
}
export function useEmailComment(commentId: string) {
  const thread = useContext(EmailContext);
  const message = thread?.messages.find((m) => m.commentId === commentId);
  return message && thread ? (
    <EmailMessageCard
      message={message}
      publication={thread.publications.find(
        (p) => p.providerMessageId === message.providerMessageId,
      )}
      issueId={thread.issueId}
    />
  ) : null;
}
export function EmailMessageCard({
  message,
  publication,
  issueId,
  contextNotice = false,
}: {
  contextNotice?: boolean;
  message: EmailMessage;
  publication?: EmailPublicationSummary;
  issueId: string;
}) {
  const { t } = useTranslation();
  const attachments = useQuery({
    queryKey: ["email-attachments", issueId],
    queryFn: () => issuesApi.listAttachments(issueId),
    enabled: message.attachmentIds.length > 0,
  });
  return (
    <article
      aria-label={
        message.direction === "inbound" ? t("comps2.email.emailReceived") : t("comps2.email.emailSent")
      }
      className={contextNotice ? "task-context-notice space-y-3" : "space-y-4 rounded-xl border border-border bg-card p-5"}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Mail className="size-4" />
          {message.direction === "inbound" ? t("comps2.email.emailReceived") : t("comps2.email.emailSent")}
        </span>
        <span className="text-xs text-muted-foreground">
          {new Date(message.timestamp).toLocaleString()}
        </span>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {message.from}
          {message.direction === "inbound" && (
            <span className="ml-2 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
              {t("comps2.email.external")}
            </span>
          )}
        </p>
        <p className="break-words text-xs text-muted-foreground">
          {t("comps2.email.toPrefix")}{message.to.join(", ")}
        </p>
        {!!message.cc?.length && (
          <p className="break-words text-xs text-muted-foreground">
            {t("comps2.email.ccPrefix")}{message.cc.join(", ")}
          </p>
        )}
        <p className="text-sm font-semibold">{message.subject}</p>
      </div>
      <div className="whitespace-pre-wrap break-words text-sm">
        {message.text || t("comps2.email.noTextBody")}
      </div>
      {!!message.attachmentIds.length && (
        <div className="flex flex-wrap gap-2">
          {message.attachmentIds.map((id) => {
            const attachment = attachments.data?.find((a) => a.id === id);
            return (
              <a
                key={id}
                href={`/api/attachments/${id}/content`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs"
              >
                <Paperclip className="size-3.5" />
                {attachment?.originalFilename ?? t("comps2.email.openAttachment")}
              </a>
            );
          })}
        </div>
      )}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">{t("comps2.email.details")}</summary>
        <div className="space-y-2 pt-3">
          {!!message.bcc?.length && <p>{t("comps2.email.bccPrefix")}{message.bcc.join(", ")}</p>}
          <p className="break-all">{t("comps2.email.messageIdPrefix")}{message.providerMessageId}</p>
          {message.fullText !== message.text && (
            <div className="whitespace-pre-wrap break-words">
              {message.fullText}
            </div>
          )}
        </div>
      </details>
      {publication && (
        <p className="border-t border-border pt-3 text-xs text-muted-foreground">
          {publication.outcome === "delivered"
            ? t("comps2.email.delivered")
            : publication.outcome === "failed"
              ? t("comps2.email.deliveryFailed")
              : publication.outcome === "uncertain"
                ? t("comps2.email.deliveryUncertain")
                : publication.outcome === "queued"
                  ? t("comps2.email.queued")
                  : t("comps2.email.sent")}
          {publication.error ? ` · ${publication.error}` : ""}
        </p>
      )}
      {attachments.error && (
        <p role="alert" className="text-xs text-destructive">
          {t("comps2.email.attachmentsLoadError")}
        </p>
      )}
    </article>
  );
}
