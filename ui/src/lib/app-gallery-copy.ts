/**
 * Prosumer copy for the Apps surface (PAP-10856).
 *
 * The P1a gallery manifest carries developer-flavoured taglines and credential
 * labels (e.g. "Connect Zapier-hosted MCP actions", "Zapier MCP token"). Those
 * strings would fail the vocabulary gate from PAP-10827 — no "MCP", "server",
 * "profile", "policy", "gateway", or "transport" anywhere on this surface. So
 * the UI never renders the raw manifest copy directly: it looks up plain copy
 * here, and `sanitizeProsumerCopy` is a final backstop for any free-text we do
 * surface (app names, fallback taglines).
 */

import { t } from "@/i18n";

/** Words that must never appear in prosumer-facing copy on the Apps surface. */
const BANNED_WORDS = [
  "mcp",
  "server",
  "profile",
  "policy",
  "gateway",
  "transport",
  "stdio",
  "endpoint",
];

const BANNED_RE = new RegExp(`\\b(${BANNED_WORDS.join("|")})s?\\b`, "gi");

/**
 * Strip banned vocabulary from a free-text string as a last-resort backstop.
 * Prefer curated copy below; this only protects against manifest text we can't
 * fully control (e.g. a newly added gallery app with no curated entry yet).
 */
export function sanitizeProsumerCopy(text: string): string {
  return text
    .replace(BANNED_RE, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,])/g, "$1")
    .trim();
}

export interface AppCopy {
  /** Two short lines for the gallery card (M2). */
  tagline: string;
  /** Single line for the connect step header (M3b). */
  short: string;
}

/**
 * Curated prosumer copy keyed by gallery key. Taken from the M-series wires
 * (https://happy-grove-jzyc.here.now/). Apps without an entry fall back to a
 * generic, gate-safe line.
 */
const CURATED_APP_KEYS = [
  "zapier",
  "github",
  "slack",
  "notion",
  "railway",
  "posthog",
  "ditto",
  "gauge",
  "neon",
  "superagent",
  "linear",
  "google-sheets",
  "gmail",
  "google-drive",
  "google-docs",
  "google-slides",
  "google-calendar",
  "google-chat",
  "google-people",
  "google-workspace-search",
  "hubspot",
  "intercom",
  "figma",
  "stripe",
  "context7",
] as const;

const CURATED_APP_KEY_SET: ReadonlySet<string> = new Set(CURATED_APP_KEYS);

function curatedCopyFor(key: string): AppCopy | null {
  if (!CURATED_APP_KEY_SET.has(key)) return null;
  return {
    tagline: t(`libui.appsGallery.apps.${key}.tagline`),
    short: t(`libui.appsGallery.apps.${key}.short`),
  };
}

/** Curated, gate-safe copy for a gallery app. */
export function appCopyFor(key: string, fallbackTagline?: string | null): AppCopy {
  const curated = curatedCopyFor(key);
  if (curated) return curated;
  if (fallbackTagline) {
    const cleaned = sanitizeProsumerCopy(fallbackTagline);
    if (cleaned) return { tagline: cleaned, short: cleaned };
  }
  return {
    tagline: t("libui.appsGallery.generic.tagline"),
    short: t("libui.appsGallery.generic.short"),
  };
}

/**
 * Label for a single credential field on the key-paste step (M3b). The raw
 * manifest label can contain banned vocab ("Zapier MCP token"), so for the
 * common single-field case we present "Your {App} key" per the wires; multi-
 * field apps fall back to a sanitized version of the manifest label.
 */
export function credentialFieldLabel(
  appName: string,
  rawLabel: string,
  fieldCount: number,
): string {
  if (/^Paste your\b/.test(rawLabel)) return sanitizeProsumerCopy(rawLabel);
  if (fieldCount <= 1) return t("libui.appsGallery.credentialField", { app: appName });
  const cleaned = sanitizeProsumerCopy(rawLabel);
  return cleaned || t("libui.appsGallery.credentialField", { app: appName });
}
