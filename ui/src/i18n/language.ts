import { DEFAULT_LOCALE, supportedLocales } from "./locales";

/**
 * Storage key for the user's explicit language choice. Mirrors the pattern
 * used by `ThemeContext` for `paperclip.theme`: no stored value means "follow
 * the browser", and an explicit choice always wins until it is cleared.
 */
export const LANGUAGE_STORAGE_KEY = "paperclip.language";

export function isSupportedLocale(locale: string): boolean {
  return (supportedLocales as string[]).includes(locale);
}

function norm(value: string) {
  return value.toLowerCase();
}

function baseLanguage(value: string) {
  return norm(value).split("-")[0];
}

/**
 * Resolve the initial UI language:
 * 1. An explicit user choice persisted in localStorage.
 * 2. The best match among the browser's preferred languages (exact tag
 *    first, then base language, e.g. `zh-TW` → `zh-CN`).
 * 3. The default locale (`en`).
 */
export function detectLocale(): string {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (stored && isSupportedLocale(stored)) return stored;
    } catch {
      // Ignore restricted-storage environments.
    }
  }

  const candidates =
    typeof navigator !== "undefined"
      ? (navigator.languages?.length ? Array.from(navigator.languages) : navigator.language ? [navigator.language] : [])
      : [];

  for (const candidate of candidates) {
    const exact = supportedLocales.find((locale) => norm(locale) === norm(candidate));
    if (exact) return exact;
  }
  for (const candidate of candidates) {
    const base = baseLanguage(candidate);
    const match = supportedLocales.find((locale) => baseLanguage(locale) === base);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}

export function persistLocale(locale: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
  } catch {
    // Ignore local storage write failures in restricted environments.
  }
}

/** Keep `<html lang>` in sync so assistive tech and font stacks follow along. */
export function applyDocumentLanguage(locale: string) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
}
