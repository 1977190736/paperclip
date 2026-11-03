import { Globe } from "lucide-react";

import { cn } from "@/lib/utils";
import { changeLocale, i18n, useTranslation } from "@/i18n";

type LanguageToggleVariant = "compact-menu-action";

interface LanguageToggleProps {
  className?: string;
  /**
   * `compact-menu-action`: compact label + icon row — matches the
   * surrounding actions in `SidebarAccountMenu`.
   */
  variant?: LanguageToggleVariant;
  /**
   * Called after the language changes. Surfaces like a popover menu use
   * this to dismiss the menu once the user has acted.
   */
  onAfterChange?: () => void;
}

const OTHER_NATIVE_NAME: Record<string, "en" | "zh-CN"> = {
  en: "zh-CN",
  "zh-CN": "en",
};

/**
 * Canonical language-toggle widget. Renders the *other* supported language in
 * its native name and switches to it on click, mirroring how `ThemeToggle`
 * describes the target state rather than the current one.
 */
export function LanguageToggle({ className, variant = "compact-menu-action", onAfterChange }: LanguageToggleProps) {
  const { t } = useTranslation();
  const current = i18n.language || "en";
  const target = OTHER_NATIVE_NAME[current] ?? "zh-CN";
  const label = target === "zh-CN" ? t("language.nativeNameZhCn") : t("language.nativeNameEn");
  const ariaLabel = t("language.switchLabel");

  function handleClick() {
    void changeLocale(target);
    onAfterChange?.();
  }

  if (variant === "compact-menu-action") {
    return (
      <button
        type="button"
        className={cn(
          "flex h-(--profile-popover-row-height) w-full items-center gap-(--profile-popover-row-gap) rounded-lg px-2.5 text-left text-(length:--text-compact) font-medium leading-(--profile-popover-label-line-height) text-foreground transition-colors hover:bg-accent",
          className,
        )}
        onClick={handleClick}
        aria-label={ariaLabel}
      >
        <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
          <Globe className="size-4" />
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </button>
    );
  }

  return null;
}
