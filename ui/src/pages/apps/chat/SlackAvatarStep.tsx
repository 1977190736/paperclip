import { useId, useState } from "react";
import {
  Download,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";

export interface SlackAvatarProps {
  agentName: string;
  appName: string;
  avatarUrl: string;
}

/** Manual fallback shared by Slack onboarding and its Settings page. */
export function SlackAvatarContent({
  agentName,
  appName,
  avatarUrl,
  compact = false,
}: SlackAvatarProps & { compact?: boolean }) {
  const id = useId();
  const { t } = useTranslation();
  const filename = `${appName.replace(/[^a-zA-Z0-9_-]+/g, "-") || "agent"}-avatar.png`;
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    setDownloadError(false);
    try {
      const response = await fetch(avatarUrl);
      if (
        !response.ok ||
        !response.headers.get("content-type")?.startsWith("image/png")
      )
        throw new Error("Avatar unavailable");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch {
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  };
  return (
    <div className="space-y-8">
      <section
        aria-labelledby={`${id}-download`}
        className="flex flex-col items-start gap-6 sm:flex-row sm:items-center"
      >
        <img
          src={avatarUrl}
          width={512}
          height={512}
          alt={t("apps.chat.avatar.avatarAlt", { name: agentName })}
          className="size-40 shrink-0 rounded-lg bg-muted object-contain"
        />
        <div className="space-y-3">
          <div className="space-y-1">
            <h2 id={`${id}-download`} className="text-sm font-semibold">
              {compact
                ? t("apps.chat.avatar.downloadTitle")
                : t("apps.chat.avatar.downloadTitleNumbered")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("apps.chat.avatar.specs")}
            </p>
          </div>
          <Button variant="outline" asChild>
            <a
              href={avatarUrl}
              download={filename}
              aria-disabled={downloading}
              onClick={(event) => {
                event.preventDefault();
                void download();
              }}
            >
              {downloading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {t("apps.chat.avatar.download")}
            </a>
          </Button>
          {downloadError && (
            <p role="alert" className="text-sm text-destructive">
              {t("apps.chat.avatar.downloadError")}
            </p>
          )}
        </div>
      </section>

      <details open={compact ? undefined : true} className="space-y-4">
        <summary
          className={
            compact
              ? "cursor-pointer text-sm underline underline-offset-4"
              : "hidden"
          }
        >
          {t("apps.chat.avatar.howToUpload")}
        </summary>
        <section aria-labelledby={`${id}-upload`} className="space-y-4">
          <div className="space-y-1">
            <h2 id={`${id}-upload`} className="text-sm font-semibold">
              {compact ? t("apps.chat.avatar.uploadTitle") : t("apps.chat.avatar.uploadTitleNumbered")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("apps.chat.avatar.uploadHint")}
            </p>
          </div>
          <ol className="list-decimal space-y-3 pl-5 text-sm">
            <li>
              <a
                href="https://api.slack.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                {t("apps.chat.avatar.step1Link")}{" "}
                <ExternalLink className="inline size-3" />
              </a>{" "}
              {t("apps.chat.avatar.step1Suffix", { name: appName })}
            </li>
            <li>
              {t("apps.chat.avatar.step2Prefix")} <strong>{t("apps.chat.avatar.basicInformation")}</strong>{t("apps.chat.avatar.step2Middle")}{" "}
              <strong>{t("apps.chat.avatar.displayInformation")}</strong>{t("apps.chat.avatar.step2Suffix")}
            </li>
            <li>
              {t("apps.chat.avatar.step3Prefix")} <strong>{t("apps.chat.avatar.appIconPreview")}</strong>{t("apps.chat.avatar.step3Middle")}{" "}
              <span className="break-all font-mono text-xs">{filename}</span>{t("apps.chat.avatar.step3Suffix")}
            </li>
            <li>
              {t("apps.chat.avatar.step4Prefix")} <strong>{t("apps.chat.avatar.saveChanges")}</strong>{t("apps.chat.avatar.step4Suffix")}
            </li>
          </ol>
        </section>
      </details>
    </div>
  );
}


export function SlackAvatarSettings(props: SlackAvatarProps) {
  const { t } = useTranslation();
  return (
    <section className="space-y-4" aria-label={t("apps.chat.avatar.sectionAria")}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t("apps.chat.avatar.agentAvatarTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("apps.chat.avatar.recognizeHint", { name: props.agentName })}
        </p>
      </div>
      <SlackAvatarContent {...props} compact />
    </section>
  );
}
