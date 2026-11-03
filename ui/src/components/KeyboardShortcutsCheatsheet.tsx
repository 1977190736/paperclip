import { useTranslation } from "@/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ShortcutEntry {
  keys: string[];
  labelKey: string;
  /** Render keys as a simultaneous chord (joined with "+") rather than a
   *  "then" sequence. */
  combo?: boolean;
}

interface ShortcutSection {
  id: string;
  shortcuts: ShortcutEntry[];
}

const sections: ShortcutSection[] = [
  {
    id: "inbox",
    shortcuts: [
      { keys: ["j"], labelKey: "moveDown" },
      { keys: ["↓"], labelKey: "moveDown" },
      { keys: ["k"], labelKey: "moveUp" },
      { keys: ["↑"], labelKey: "moveUp" },
      { keys: ["←"], labelKey: "collapseGroup" },
      { keys: ["→"], labelKey: "expandGroup" },
      { keys: ["Enter"], labelKey: "openItem" },
      { keys: ["a"], labelKey: "archiveItem" },
      { keys: ["y"], labelKey: "archiveItem" },
      { keys: ["r"], labelKey: "markRead" },
      { keys: ["U"], labelKey: "markUnread" },
    ],
  },
  {
    id: "taskDetail",
    shortcuts: [
      { keys: ["y"], labelKey: "quickArchive" },
      { keys: ["g", "i"], labelKey: "goToInbox" },
      { keys: ["g", "c"], labelKey: "focusComposer" },
    ],
  },
  {
    id: "decisions",
    shortcuts: [
      { keys: ["j"], labelKey: "moveDown" },
      { keys: ["↓"], labelKey: "moveDown" },
      { keys: ["k"], labelKey: "moveUp" },
      { keys: ["↑"], labelKey: "moveUp" },
      { keys: ["Enter"], labelKey: "openCloseDecision" },
      { keys: ["x"], labelKey: "dismissDecision" },
    ],
  },
  {
    id: "global",
    shortcuts: [
      { keys: ["/"], labelKey: "searchPage" },
      { keys: ["c"], labelKey: "newTask" },
      { keys: ["["], labelKey: "toggleSidebar" },
      { keys: ["]"], labelKey: "togglePanel" },
      { keys: ["?"], labelKey: "showShortcuts" },
    ],
  },
];

function KeyCap({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-xs font-medium text-foreground shadow-(--shadow-extract-10)">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsCheatsheetContent() {
  const { t } = useTranslation();
  return (
    <>
      <div className="divide-y divide-border border-t border-border">
        {sections.map((section) => (
          <div key={section.id} className="px-5 py-3">
            <h3 className="mb-2 text-(length:--text-micro) font-semibold uppercase tracking-wider text-muted-foreground">
              {t(`comps1.shortcuts.section.${section.id}`)}
            </h3>
            <div className="space-y-1.5">
              {section.shortcuts.map((shortcut) => (
                <div
                  key={shortcut.labelKey + shortcut.keys.join()}
                  className="flex items-center justify-between gap-4"
                >
                  <span className="text-sm text-foreground/90">{t(`comps1.shortcuts.label.${shortcut.labelKey}`)}</span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, i) => (
                      <span key={key} className="flex items-center gap-1">
                        {i > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {shortcut.combo ? "+" : t("comps1.shortcuts.then")}
                          </span>
                        )}
                        <KeyCap>{key}</KeyCap>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border px-5 py-3">
        <p className="text-xs text-muted-foreground">
          {t("comps1.shortcuts.pressPrefix")} <KeyCap>Esc</KeyCap> {t("comps1.shortcuts.pressSuffix")}
        </p>
      </div>
    </>
  );
}

export function KeyboardShortcutsCheatsheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden" showCloseButton={false}>
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base">{t("comps1.shortcuts.title")}</DialogTitle>
        </DialogHeader>
        <KeyboardShortcutsCheatsheetContent />
      </DialogContent>
    </Dialog>
  );
}
