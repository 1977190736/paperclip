/**
 * Shared error classification and user-facing copy.
 *
 * Every surface that reacts to a failed request asks two questions: "is this a
 * blip that will fix itself?" and "what do I tell the user?". This module is
 * the single answer to both, so retry policy, the connectivity banner, toasts,
 * and inline errors agree with each other.
 *
 * Classification is structural on purpose: it reads `status`, `code`, `body`,
 * and `name` instead of importing `ApiError`/`ApiUnavailableError`, so the API
 * client can depend on this module without an import cycle, and errors thrown
 * by hand-rolled fetches (health, uploads) classify the same way.
 */
import { t } from "@/i18n";

export type ErrorKind =
  | "transient"
  | "auth"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "invalid"
  | "aborted"
  | "unknown";

export interface ErrorDescription {
  title: string;
  body: string;
  /** True when trying the same request again later can succeed. */
  retryable: boolean;
}

export interface DescribeErrorOptions {
  /**
   * What the user was doing, as an English verb-phrase IDENTIFIER (e.g.
   * "save the comment") — never display text. Known fragments are localized;
   * unknown ones fall back to the English title template.
   */
  action?: string;
}

/** HTTP statuses that mean "the server or a proxy will likely recover". */
const TRANSIENT_STATUSES = new Set([408, 425, 429, 502, 503, 504]);

/**
 * Error codes that mean "temporarily unavailable" regardless of the HTTP status
 * they arrive with. The Cloud gateway has sent `tenant_app_unavailable` with
 * non-5xx statuses, so these are matched by code, never by status alone.
 */
const TRANSIENT_CODES = new Set([
  "tenant_app_unavailable",
  "tenant_app_starting",
  // Plugin bridge (`PluginBridgeErrorCode`).
  "WORKER_UNAVAILABLE",
  "TIMEOUT",
]);

/** Transient errors that say "the whole server is unreachable", not one route. */
const CONNECTIVITY_STATUSES = new Set([502, 503, 504]);
const CONNECTIVITY_CODES = new Set(["tenant_app_unavailable", "tenant_app_starting"]);

// --- Copy table ---------------------------------------------------------------
//
// The only place user-facing error copy lives. Keys are server error codes (the
// raw `body.error`/`body.code`) or an `ErrorKind` fallback. Never return a raw
// code to the user: anything not in this table falls back to its kind's copy.
// Copy resolves through i18n at call time; the English strings below live
// verbatim in the base locale packs under `errors.*`.

const UNAVAILABLE_BODY_KEY = "errors.unavailableBody";

const CODE_COPY_KEYS: Record<string, { titleKey: string; bodyKey: string }> = {
  tenant_app_unavailable: {
    titleKey: "errors.code.tenantAppUnavailable.title",
    bodyKey: "errors.code.tenantAppUnavailable.body",
  },
  tenant_app_starting: {
    titleKey: "errors.code.tenantAppStarting.title",
    bodyKey: "errors.code.tenantAppStarting.body",
  },
  WORKER_UNAVAILABLE: {
    titleKey: "errors.code.workerUnavailable.title",
    bodyKey: "errors.code.workerUnavailable.body",
  },
  TIMEOUT: {
    titleKey: "errors.code.timeout.title",
    bodyKey: "errors.code.timeout.body",
  },
  // Issue-thread interaction resolution (moved from lib/interaction-resolution-error.ts).
  interaction_audience_denied: {
    titleKey: "errors.code.interactionAudienceDenied.title",
    bodyKey: "errors.code.interactionAudienceDenied.body",
  },
  interaction_forbidden: {
    titleKey: "errors.code.interactionForbidden.title",
    bodyKey: "errors.code.interactionForbidden.body",
  },
  interaction_settled: {
    titleKey: "errors.code.interactionSettled.title",
    bodyKey: "errors.code.interactionSettled.body",
  },
  interaction_submit_failed: {
    titleKey: "errors.code.interactionSubmitFailed.title",
    bodyKey: "errors.code.interactionSubmitFailed.body",
  },
};

const KIND_COPY_KEYS: Record<ErrorKind, { titleKey: string; bodyKey: string }> = {
  // Moved from `ApiUnavailableError` (api/response.ts).
  transient: { titleKey: "errors.kind.transient.title", bodyKey: "errors.kind.transient.body" },
  auth: { titleKey: "errors.kind.auth.title", bodyKey: "errors.kind.auth.body" },
  forbidden: { titleKey: "errors.kind.forbidden.title", bodyKey: "errors.kind.forbidden.body" },
  not_found: { titleKey: "errors.kind.notFound.title", bodyKey: "errors.kind.notFound.body" },
  conflict: { titleKey: "errors.kind.conflict.title", bodyKey: "errors.kind.conflict.body" },
  invalid: { titleKey: "errors.kind.invalid.title", bodyKey: "errors.kind.invalid.body" },
  aborted: { titleKey: "errors.kind.aborted.title", bodyKey: "errors.kind.aborted.body" },
  unknown: { titleKey: "errors.kind.unknown.title", bodyKey: "errors.kind.unknown.body" },
};

/**
 * `action` fragments passed by callers, mapped to i18n keys. The fragment is an
 * English verb-phrase IDENTIFIER, never display text: pass the same English
 * phrase the original code used, not a translated string.
 */
const ACTION_COPY_KEYS: Record<string, string> = {
  "post the comment": "errors.action.postTheComment",
  "check the monitor": "errors.action.checkTheMonitor",
  "save the document": "errors.action.saveTheDocument",
  "approve this request": "errors.action.approveThisRequest",
  "reject this request": "errors.action.rejectThisRequest",
  "create the task": "errors.action.createTheTask",
  "request a revision": "errors.action.requestARevision",
  "resubmit this request": "errors.action.resubmitThisRequest",
  "upload the file": "errors.action.uploadTheFile",
  "send this message": "errors.action.sendThisMessage",
  "load this goal": "errors.action.loadThisGoal",
  "load workspaces": "errors.action.loadWorkspaces",
  "load your chats": "errors.action.loadYourChats",
  "load this case": "errors.action.loadThisCase",
  "load plugin extensions": "errors.action.loadPluginExtensions",
};

/** Copy for a specific code or kind, for callers that build their own messages. */
export function errorCopy(key: string): { title: string; body: string } {
  const coded = CODE_COPY_KEYS[key] ?? KIND_COPY_KEYS[key as ErrorKind] ?? KIND_COPY_KEYS.unknown;
  return { title: t(coded.titleKey), body: t(coded.bodyKey) };
}

// --- Field extraction -------------------------------------------------------------

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** The HTTP status an error carries, if any. */
export function errorStatus(err: unknown): number | null {
  const status = record(err)?.status;
  return typeof status === "number" && Number.isFinite(status) ? status : null;
}

/**
 * Every server-provided code on an error: `ApiError.code` (the raw
 * `body.error`), `body.code`, and `body.details.code`. Plugin bridge errors put
 * their code on `body.code`; HttpErrors put a machine code on `details.code`.
 */
export function errorCodes(err: unknown): string[] {
  const error = record(err);
  if (!error) return [];
  const body = record(error.body);
  const codes = [
    stringField(error.code),
    stringField(body?.error),
    stringField(body?.code),
    stringField(record(body?.details)?.code),
  ];
  return [...new Set(codes.filter((code): code is string => code !== null))];
}

/**
 * True for a machine code (`tenant_app_unavailable`, `WORKER_UNAVAILABLE`,
 * `TIMEOUT`) rather than a sentence a person wrote. Single readable words such
 * as "Forbidden" are not codes.
 */
export function isRawErrorCode(value: string): boolean {
  const text = value.trim();
  if (!text || /\s/.test(text)) return false;
  return /^[A-Za-z0-9]+(?:[_.][A-Za-z0-9]+)+$/.test(text) || /^[A-Z][A-Z0-9_]{2,}$/.test(text);
}

/** A server message that is safe to show: not a raw code, not a generic status line. */
function readableServerMessage(err: unknown): string | null {
  const error = record(err);
  const candidates = [stringField(record(error?.body)?.message), stringField(record(error?.body)?.error)];
  if (err instanceof Error) candidates.push(stringField(err.message));
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (isRawErrorCode(candidate)) continue;
    if (/^Request failed: \d+$/.test(candidate)) continue;
    if (candidate === t(UNAVAILABLE_BODY_KEY)) continue;
    return candidate;
  }
  return null;
}

// --- Classification ---------------------------------------------------------------

function isAbortError(err: unknown): boolean {
  const name = record(err)?.name;
  return name === "AbortError" || name === "CancelledError";
}

function isNetworkTypeError(err: unknown): boolean {
  // Fetch uses different network-failure messages across browsers. Do not
  // classify arbitrary TypeErrors (programming bugs) as outages.
  return err instanceof TypeError && /fetch|network|load failed/i.test(err.message);
}

function isApiUnavailableError(err: unknown): boolean {
  return record(err)?.name === "ApiUnavailableError";
}

export function classifyError(err: unknown): ErrorKind {
  if (err === null || err === undefined) return "unknown";
  if (isAbortError(err)) return "aborted";
  if (isApiUnavailableError(err) || isNetworkTypeError(err)) return "transient";
  if (errorCodes(err).some((code) => TRANSIENT_CODES.has(code))) return "transient";

  const status = errorStatus(err);
  if (status === null) return "unknown";
  if (TRANSIENT_STATUSES.has(status)) return "transient";
  if (status === 401) return "auth";
  if (status === 403) return "forbidden";
  if (status === 404 || status === 410) return "not_found";
  if (status === 409 || status === 412) return "conflict";
  if (status >= 400 && status < 500) return "invalid";
  return "unknown";
}

export function isTransientError(err: unknown): boolean {
  return classifyError(err) === "transient";
}

/**
 * A transient error that means the server as a whole is unreachable (network
 * drop, proxy 5xx, gateway "app unavailable"), as opposed to one route being
 * busy (429, a plugin worker restarting). Only these move the app-wide
 * connectivity state; per-route blips are left to query retry.
 */
export function isConnectivityError(err: unknown): boolean {
  if (isApiUnavailableError(err) || isNetworkTypeError(err)) return true;
  if (errorCodes(err).some((code) => CONNECTIVITY_CODES.has(code))) return true;
  const status = errorStatus(err);
  if (status === null || !CONNECTIVITY_STATUSES.has(status)) return false;
  // A plugin worker 503 is one route, not the server.
  return !errorCodes(err).some((code) => TRANSIENT_CODES.has(code) && !CONNECTIVITY_CODES.has(code));
}

/** HTTP 4xx other than the transient ones; retrying the same request cannot help. */
export function isClientError(err: unknown): boolean {
  const kind = classifyError(err);
  return kind === "auth" || kind === "forbidden" || kind === "not_found" || kind === "conflict" || kind === "invalid";
}

// --- Retry-After --------------------------------------------------------------------

const MAX_RETRY_AFTER_MS = 5 * 60_000;

/** Parse an HTTP `Retry-After` value (delta-seconds or HTTP-date) into milliseconds. */
export function parseRetryAfter(value: string | null | undefined, now = Date.now()): number | null {
  if (!value) return null;
  const text = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    return Math.min(Math.round(Number(text) * 1000), MAX_RETRY_AFTER_MS);
  }
  const date = Date.parse(text);
  if (Number.isNaN(date)) return null;
  return Math.min(Math.max(0, date - now), MAX_RETRY_AFTER_MS);
}

/** The server-requested delay carried by an error, if any. */
export function errorRetryAfterMs(err: unknown): number | null {
  const value = record(err)?.retryAfterMs;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

// --- Copy -----------------------------------------------------------------------------

/**
 * User-facing copy for any error. Never returns a raw `snake_case` code:
 * known codes use the table above, readable server messages pass through for
 * client errors, and everything else uses the copy for its kind.
 */
export function describeError(err: unknown, options: DescribeErrorOptions = {}): ErrorDescription {
  const kind = classifyError(err);
  const retryable = kind === "transient" || kind === "unknown";
  const coded = errorCodes(err).map((code) => CODE_COPY_KEYS[code]).find(Boolean);
  const fallback = KIND_COPY_KEYS[kind];

  let body: string;
  if (coded) body = t(coded.bodyKey);
  else if (kind === "transient" || kind === "aborted") body = t(fallback.bodyKey);
  else body = readableServerMessage(err) ?? t(fallback.bodyKey);

  const actionKey = options.action ? ACTION_COPY_KEYS[options.action] : undefined;
  const title = options.action && kind !== "transient"
    ? actionKey
      ? t("errors.actionTitleTemplate", { action: t(actionKey) })
      : `Couldn't ${options.action}`
    : (coded ? t(coded.titleKey) : t(fallback.titleKey));
  return { title, body, retryable };
}

/**
 * The `message` for an `ApiError` built from an HTTP response: the server's own
 * text when it is readable, otherwise copy from the table. Keeps raw codes out
 * of every `{error.message}` render and `toast(err.message)` call.
 */
export function apiErrorMessage(status: number, body: unknown): string {
  const raw = stringField(record(body)?.error);
  if (raw && !isRawErrorCode(raw)) return raw;
  return describeError({ status, body, code: raw }).body;
}
