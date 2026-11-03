import { AlertTriangle } from "lucide-react";
import type { ToolProfileWithDetails } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ProfileActionDialogKind = "archive" | "delete" | "restore";

export function ProfileActionDialog({
  kind,
  profile,
  pending,
  onClose,
  onArchive,
  onRestore,
  onDelete,
}: {
  kind: ProfileActionDialogKind | null;
  profile: ToolProfileWithDetails | null;
  pending: boolean;
  onClose: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  if (!kind || !profile) return null;

  const defaultDeleteBlocked = kind === "delete" && profile.summary.isCompanyDefault;
  const copy = {
    archive: {
      title: t("tools.profileActionDialog.archive.title"),
      body: t("tools.profileActionDialog.archive.body", { count: profile.summary.appliesToAgentCount }),
      confirm: t("tools.profileActionDialog.archive.confirm"),
      action: onArchive,
    },
    restore: {
      title: t("tools.profileActionDialog.restore.title"),
      body: t("tools.profileActionDialog.restore.body"),
      confirm: t("tools.profileActionDialog.restore.confirm"),
      action: onRestore,
    },
    delete: {
      title: t("tools.profileActionDialog.delete.title"),
      body: defaultDeleteBlocked
        ? t("tools.profileActionDialog.delete.bodyDefaultBlocked")
        : t("tools.profileActionDialog.delete.body", { count: profile.summary.assignmentCount }),
      confirm: t("tools.profileActionDialog.delete.confirm"),
      action: onDelete,
    },
  }[kind];

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        {defaultDeleteBlocked ? (
          <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t("tools.profileActionDialog.reassignFirst")}</span>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t("agentConfig.common.cancel")}</Button>
          <Button
            variant={kind === "delete" ? "destructive" : "default"}
            disabled={pending || defaultDeleteBlocked}
            onClick={copy.action}
          >
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
