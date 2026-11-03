import type { TaskInterruptionPresentation } from "@paperclipai/shared";
import { AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { useSecondTick } from "../hooks/useSecondTick";
import { TaskProjectAccessNotice } from "./TaskProjectAccessNotice";
import { useTranslation } from "@/i18n";

/** One ordinary interruption surface. Technical records remain in diagnostics. */
export function ExecutionBlockerNotice({ presentation, canRetry, onRetry, optimistic, takingLonger, error, className, issueId, agentName, projectName }: {
  presentation: TaskInterruptionPresentation | null | undefined;
  canRetry: boolean;
  onRetry: () => void;
  optimistic?: boolean;
  takingLonger?: boolean;
  error?: Error | null;
  className?: string;
  issueId?: string;
  agentName?: string;
  projectName?: string;
}) {
  useSecondTick(presentation?.state === "retry_scheduled");
  const { t } = useTranslation();
  if (presentation?.projectAccess && !optimistic && !takingLonger) return <TaskProjectAccessNotice
    access={presentation.projectAccess} issueId={issueId} agentName={agentName} projectName={projectName}
    canRetry={canRetry && presentation.canRetry} onRetry={onRetry} error={error} className={className} />;
  if (error && !optimistic && !takingLonger) return <div role="alert" className={cn("flex items-center justify-between gap-2 text-sm text-destructive", className)}><span>{error.message}</span>{canRetry && <Button variant="outline" size="sm" onClick={onRetry}>{t("agentConfig.common.retry")}</Button>}</div>;
  if (takingLonger) return <div role="status" className={cn("flex items-center justify-between gap-2 text-sm text-muted-foreground", className)}><span>{t("comps3.blockerNotice.takingLonger")}</span>{canRetry && <Button variant="outline" size="sm" onClick={onRetry}>{t("agentConfig.common.retry")}</Button>}</div>;
  if (optimistic || !presentation || presentation.responsibility !== "system" ||
      !["failed", "retry_scheduled"].includes(presentation.state)) return null;
  const seconds = Math.max(0, Math.ceil((Date.parse(presentation.nextRetryAt ?? "") - Date.now()) / 1000));
  return (
    <div className={cn(presentation.state === "failed" && "pt-4", className)}>
      <div role="status" aria-label={t("comps3.blockerNotice.taskStatusAria")} className={cn(
        "flex items-center justify-between gap-3 text-sm",
        presentation.state === "failed" ? "rounded-lg bg-destructive/10 p-4 text-foreground" : "text-muted-foreground",
      )}>
        {presentation.state === "failed" && <AlertCircle className="size-5 shrink-0 text-destructive" aria-hidden="true" />}
        <span className="min-w-0 flex-1">{presentation.state === "retry_scheduled"
          ? t("comps3.blockerNotice.retryIn", { when: seconds > 60 ? t("comps3.blockerNotice.minutesShort", { number: Math.ceil(seconds / 60) }) : t("comps3.blockerNotice.secondsShort", { number: seconds }) })
          : t("comps3.blockerNotice.failedNote")}</span>
        {canRetry && presentation.canRetry && <Button variant="outline" size="sm" className="shrink-0" onClick={onRetry}>{t("agentConfig.common.retry")}</Button>}
      </div>
    </div>
  );
}
