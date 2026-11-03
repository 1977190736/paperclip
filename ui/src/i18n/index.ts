import i18n, { type InitOptions, type TOptions } from "i18next";
import { initReactI18next, useTranslation as useReactI18nextTranslation } from "react-i18next";

import { DEFAULT_LOCALE, i18nextResources, supportedLocales } from "./locales";
import { applyDocumentLanguage, detectLocale, persistLocale } from "./language";

const initialLocale = detectLocale();

const i18nextOptions: InitOptions = {
  resources: i18nextResources,
  lng: initialLocale,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: supportedLocales,
  defaultNS: "translation",
  interpolation: { escapeValue: false },
  returnObjects: false,
  initAsync: false,
};

void i18n.use(initReactI18next).init(i18nextOptions).catch((error: unknown) => {
  console.error("Failed to initialize i18next", error);
});

// Keep `<html lang>` in sync whenever the active language changes (including
// the initial application above).
i18n.on("languageChanged", (locale) => {
  applyDocumentLanguage(locale);
});
applyDocumentLanguage(initialLocale);

/**
 * Switch the UI language and remember the choice. Persisting before
 * `changeLanguage` means a reload — even one triggered mid-flight — keeps the
 * user's explicit selection.
 */
export function changeLocale(locale: string) {
  persistLocale(locale);
  return i18n.changeLanguage(locale);
}

export function t(key: string, options: TOptions = {}) {
  return i18n.t(key, options);
}

export const useTranslation = useReactI18nextTranslation;
export { i18n };
