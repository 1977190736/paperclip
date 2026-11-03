import { ShieldCheck, ShieldX, ArrowRight } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { useTranslation } from "@/i18n";

export interface ProjectAccessNoticeProps {
  agentName?: string;
  projectName?: string;
  ready: boolean;
  canManage: boolean;
  canRetry: boolean;
  onManage: () => void;
  onRetry: () => void;
  error?: Error | null;
  className?: string;
}

export function ProjectAccessNotice({ agentName, projectName, ready, canManage, canRetry, onManage, onRetry, error, className }: ProjectAccessNoticeProps) {
  const { t } = useTranslation();
  const resolvedAgentName = agentName ?? t("comps3.projectAccess.thisAgent");
  return <section role={ready ? "status" : "alert"} aria-label={t("comps3.projectAccess.title")} className={cn("space-y-4 rounded-lg border border-border p-4", className)}>
    <div className="flex items-start gap-3">
      {ready ? <ShieldCheck className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden /> : <ShieldX className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />}
      <div className="min-w-0 space-y-2">
        <h3 className="text-sm font-semibold">{ready ? t("comps3.projectAccess.readyTitle") : t("comps3.projectAccess.blockedTitle", { name: resolvedAgentName })}</h3>
        <p className="text-sm text-muted-foreground">{ready
          ? t("comps3.projectAccess.readyBody")
          : t("comps3.projectAccess.blockedBody", { project: projectName ?? t("comps3.projectAccess.aProject") })}</p>
        {!ready && !canManage && <p className="text-sm text-muted-foreground">{t("comps3.projectAccess.noManageNote")}</p>}
      </div>
    </div>
    <div className="flex flex-wrap gap-2 pl-8">
      {ready ? canRetry && <Button size="sm" onClick={onRetry}>{t("comps3.projectAccess.retryTask")}<ArrowRight className="size-4" aria-hidden /></Button>
        : <Button size="sm" variant="outline" onClick={onManage}>{canManage ? t("comps3.projectAccess.manage") : t("comps3.projectAccess.view")}<ArrowRight className="size-4" aria-hidden /></Button>}
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error.message}</p>}
    {!ready && <details className="pl-8 text-xs text-muted-foreground"><summary className="cursor-pointer">{t("comps3.projectAccess.runDetails")}</summary>
      <dl className="mt-3 grid grid-cols-2 gap-2"><dt>{t("comps3.projectAccess.stoppedDuring")}</dt><dd>{t("comps3.projectAccess.workspaceSetup")}</dd><dt>{t("comps3.projectAccess.reason")}</dt><dd>{t("comps3.projectAccess.reasonValue")}</dd><dt>{t("comps3.projectAccess.providerStarted")}</dt><dd>{t("comps3.projectAccess.no")}</dd></dl>
    </details>}
  </section>;
}
