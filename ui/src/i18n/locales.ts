import type { Resource } from "i18next";

import { assertValidLocaleMessages } from "./locale-validation";

export const DEFAULT_LOCALE = "en" as const;

// Locale files come in two shapes:
//   en.json            — the base file for a locale
//   zh-CN.dashboard.json — an area-scoped part, deep-merged into its locale
// The second form keeps large language packs reviewable per feature area and
// lets parallel work streams own disjoint key subtrees. Part files must not
// overlap keys with each other; conflicts throw at startup.
const localeModules = import.meta.glob("./locales/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepMergeInto(target: Record<string, unknown>, part: Record<string, unknown>, path: string[]) {
  for (const [key, value] of Object.entries(part)) {
    if (!(key in target)) {
      target[key] = value;
      continue;
    }
    if (isPlainObject(target[key]) && isPlainObject(value)) {
      deepMergeInto(target[key] as Record<string, unknown>, value, [...path, key]);
      continue;
    }
    throw new Error(
      `Locale part files define overlapping key ${[...path, key].join(".")}`,
    );
  }
}

export const localeMessages: Record<string, unknown> = {};
for (const [path, messages] of Object.entries(localeModules)) {
  const match = path.match(/\/([A-Za-z0-9_-]+?)(?:\.([A-Za-z0-9_-]+))?\.json$/);
  if (!match) {
    throw new Error(`Invalid locale file path: ${path}`);
  }
  const [, locale] = match;
  if (!isPlainObject(messages)) {
    throw new Error(`Invalid locale file (not an object): ${path}`);
  }
  const existing = localeMessages[locale];
  if (existing === undefined) {
    localeMessages[locale] = messages;
    continue;
  }
  deepMergeInto(existing as Record<string, unknown>, messages, []);
}

if (!(DEFAULT_LOCALE in localeMessages)) {
  throw new Error(`Missing default locale messages for ${DEFAULT_LOCALE}`);
}

for (const [locale, messages] of Object.entries(localeMessages)) {
  try {
    // The merged English tree is the canonical key reference — base en.json
    // alone would flag every area-part key as "not defined in English".
    assertValidLocaleMessages(messages, localeMessages[DEFAULT_LOCALE]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid ${locale} locale messages: ${message}`);
  }
}

export const supportedLocales = Object.keys(localeMessages);

export const i18nextResources: Resource = Object.fromEntries(
  Object.entries(localeMessages).map(([locale, messages]) => [locale, { translation: messages }]),
) as Resource;

export type SupportedLocale = keyof typeof localeMessages;
