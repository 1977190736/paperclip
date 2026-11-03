import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";

export function LegacyBoardSendNotice({ onDiscard }: { onDiscard: () => void }) {
  const { t } = useTranslation();
  return <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button size="sm" variant="outline">{t("connections.legacyNotice.entryButton")}</Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{t("connections.legacyNotice.title")}</AlertDialogTitle>
        <AlertDialogDescription>
          {t("connections.legacyNotice.description")}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{t("connections.legacyNotice.keepRecord")}</AlertDialogCancel>
        <AlertDialogAction onClick={onDiscard}>{t("connections.legacyNotice.discardRecord")}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
