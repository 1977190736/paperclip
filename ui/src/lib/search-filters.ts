import {
  COMPANY_SEARCH_SORTS,
  type CompanySearchSort,
} from "@paperclipai/shared";
import type { ParsedSearchQuery } from "./search-query-parser";
import { t } from "@/i18n";

/**
 * The issue-scoped filter model for /search. This is the SAME shape the query
 * parser (search-query-parser.ts) and the URL round-trip already use — we build
 * the P2 filter-bar UI directly on top of it rather than inventing a second
 * scheme. `sort` lives alongside the filters but is tracked separately (it is not
 * part of the parser's filter set).
 */
export type SearchFilters = ParsedSearchQuery["filters"];

// Sort/window labels resolve through i18n at access time (consumers index the
// records directly), so both records are wrapped in proxies that translate on
// read while keys stay untouched.
const SORT_LABELS_BASE: Record<CompanySearchSort, string> = {
  relevance: "Relevance",
  updated: "Recently updated",
  created: "Newest created",
  priority: "Priority",
};

export const SORT_LABELS: Record<CompanySearchSort, string> = new Proxy(SORT_LABELS_BASE, {
  get(target, prop, receiver) {
    if (typeof prop === "string" && Object.hasOwn(target, prop)) {
      return t(`libui.searchFilters.sort.${prop}`);
    }
    return Reflect.get(target, prop, receiver);
  },
});

const UPDATED_WITHIN_LABELS_BASE: Record<string, string> = {
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};

const UPDATED_WITHIN_KEYS: Record<string, string> = {
  "24h": "24h",
  "7d": "7d",
  "30d": "30d",
  "90d": "90d",
};

export const UPDATED_WITHIN_LABELS: Record<string, string> = new Proxy(UPDATED_WITHIN_LABELS_BASE, {
  get(target, prop, receiver) {
    if (typeof prop === "string" && UPDATED_WITHIN_KEYS[prop]) {
      return t(`libui.searchFilters.updatedWithin.${UPDATED_WITHIN_KEYS[prop]}`);
    }
    return Reflect.get(target, prop, receiver);
  },
});

export function updatedWithinLabel(value: string): string {
  const key = UPDATED_WITHIN_KEYS[value];
  return key ? t(`libui.searchFilters.updatedWithin.${key}`) : t("libui.searchFilters.updatedWithin.fallback", { value });
}

const SORT_SET = new Set<string>(COMPANY_SEARCH_SORTS);

export function parseSearchSort(params: URLSearchParams): CompanySearchSort {
  const raw = params.get("sort");
  return raw && SORT_SET.has(raw) ? (raw as CompanySearchSort) : "relevance";
}

/** Count active filter *dimensions* (assignee counts once regardless of shape). */
export function countActiveFilters(filters: SearchFilters): number {
  let count = 0;
  if (filters.status?.length) count += 1;
  if (filters.priority?.length) count += 1;
  if (filters.assigneeAgentId !== undefined || filters.assigneeUserId) count += 1;
  if (filters.projectId) count += 1;
  if (filters.labelId) count += 1;
  if (filters.updatedWithin || filters.updatedAfter) count += 1;
  return count;
}

// ---------------------------------------------------------------------------
// Assignee: the UI treats assignee as a single choice, but the wire model splits
// it across assigneeAgentId (string | null) and assigneeUserId (string). These
// helpers translate between a single opaque token and that split representation.
//   "me"          → assigneeUserId = currentUserId
//   "none"        → assigneeAgentId = null (unassigned)
//   "agent:<id>"  → assigneeAgentId
//   "user:<id>"   → assigneeUserId
// ---------------------------------------------------------------------------

export function assigneeToken(filters: SearchFilters, currentUserId: string | null): string | undefined {
  if (filters.assigneeAgentId === null) return "none";
  if (typeof filters.assigneeAgentId === "string") return `agent:${filters.assigneeAgentId}`;
  if (filters.assigneeUserId) {
    return filters.assigneeUserId === currentUserId ? "me" : `user:${filters.assigneeUserId}`;
  }
  return undefined;
}

export function applyAssigneeToken(
  filters: SearchFilters,
  token: string | undefined,
  currentUserId: string | null,
): SearchFilters {
  const next: SearchFilters = { ...filters };
  delete next.assigneeAgentId;
  delete next.assigneeUserId;
  if (!token) return next;
  if (token === "none") {
    next.assigneeAgentId = null;
  } else if (token === "me") {
    if (currentUserId) next.assigneeUserId = currentUserId;
  } else if (token.startsWith("agent:")) {
    next.assigneeAgentId = token.slice("agent:".length);
  } else if (token.startsWith("user:")) {
    next.assigneeUserId = token.slice("user:".length);
  }
  return next;
}

export interface FilterChipLookups {
  agentName: (id: string) => string | undefined;
  userName: (id: string) => string | undefined;
  projectName: (id: string) => string | undefined;
  labelName: (id: string) => string | undefined;
  currentUserId: string | null;
}

export interface FilterChip {
  id: string;
  label: string;
  remove: (filters: SearchFilters) => SearchFilters;
}

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function assigneeChipLabel(filters: SearchFilters, lookups: FilterChipLookups): string {
  if (filters.assigneeAgentId === null) return t("libui.searchFilters.assignee.unassigned");
  if (typeof filters.assigneeAgentId === "string") {
    return lookups.agentName(filters.assigneeAgentId) ?? t("libui.searchFilters.assignee.agent");
  }
  if (filters.assigneeUserId) {
    if (filters.assigneeUserId === lookups.currentUserId) return t("libui.searchFilters.assignee.me");
    return lookups.userName(filters.assigneeUserId) ?? t("libui.searchFilters.assignee.user");
  }
  return t("libui.searchFilters.assignee.assignee");
}

/** Removable chip descriptors for the active-filter row. */
export function buildFilterChips(filters: SearchFilters, lookups: FilterChipLookups): FilterChip[] {
  const chips: FilterChip[] = [];
  for (const status of filters.status ?? []) {
    chips.push({
      id: `status:${status}`,
      label: t("libui.searchFilters.chips.status", { value: humanize(status) }),
      remove: (current) => {
        const next = { ...current };
        const remaining = (current.status ?? []).filter((value) => value !== status);
        if (remaining.length > 0) next.status = remaining;
        else delete next.status;
        return next;
      },
    });
  }
  // PAP-411: priority controls are hidden from the UI, but the priority filter
  // DSL (`priority:high`) stays functional at the data layer per board decision.
  // A priority filter can therefore still enter the query via URL round-trip or
  // typed DSL, so we always render a removable chip for it — otherwise a restored
  // priority filter would silently narrow results with no way to see or clear it.
  for (const priority of filters.priority ?? []) {
    chips.push({
      id: `priority:${priority}`,
      label: t("libui.searchFilters.chips.priority", { value: humanize(priority) }),
      remove: (current) => {
        const next = { ...current };
        const remaining = (current.priority ?? []).filter((value) => value !== priority);
        if (remaining.length > 0) next.priority = remaining;
        else delete next.priority;
        return next;
      },
    });
  }
  if (filters.assigneeAgentId !== undefined || filters.assigneeUserId) {
    chips.push({
      id: "assignee",
      label: t("libui.searchFilters.chips.assignee", { value: assigneeChipLabel(filters, lookups) }),
      remove: (current) => {
        const next = { ...current };
        delete next.assigneeAgentId;
        delete next.assigneeUserId;
        return next;
      },
    });
  }
  if (filters.projectId) {
    chips.push({
      id: "project",
      label: t("libui.searchFilters.chips.project", { value: lookups.projectName(filters.projectId) ?? t("libui.searchFilters.fallback.project") }),
      remove: (current) => {
        const next = { ...current };
        delete next.projectId;
        return next;
      },
    });
  }
  if (filters.labelId) {
    chips.push({
      id: "label",
      label: t("libui.searchFilters.chips.label", { value: lookups.labelName(filters.labelId) ?? t("libui.searchFilters.fallback.label") }),
      remove: (current) => {
        const next = { ...current };
        delete next.labelId;
        return next;
      },
    });
  }
  if (filters.updatedWithin) {
    chips.push({
      id: "updated",
      label: t("libui.searchFilters.chips.updated", { value: updatedWithinLabel(filters.updatedWithin) }),
      remove: (current) => {
        const next = { ...current };
        delete next.updatedWithin;
        delete next.updatedAfter;
        return next;
      },
    });
  }
  return chips;
}

/** Human label for a backend zero-results loosen suggestion. */
export function describeLoosenSuggestion(filterKey: string, values: string[], lookups: FilterChipLookups): string {
  switch (filterKey) {
    case "status":
      return t("libui.searchFilters.loosen.status", { values: values.map(humanize).join(", ") });
    case "priority":
      return t("libui.searchFilters.loosen.priority", { values: values.map(humanize).join(", ") });
    case "assigneeAgentId":
      return t("libui.searchFilters.loosen.assignee", { values: values.map((id) => lookups.agentName(id) ?? t("libui.searchFilters.assignee.agent")).join(", ") });
    case "assigneeUserId":
      return t("libui.searchFilters.loosen.assignee", { values: values.map((id) => (id === lookups.currentUserId ? t("libui.searchFilters.assignee.me") : lookups.userName(id) ?? t("libui.searchFilters.assignee.user"))).join(", ") });
    case "projectId":
      return t("libui.searchFilters.loosen.project", { values: values.map((id) => lookups.projectName(id) ?? t("libui.searchFilters.fallback.project")).join(", ") });
    case "labelId":
      return t("libui.searchFilters.loosen.label", { values: values.map((id) => lookups.labelName(id) ?? t("libui.searchFilters.fallback.label")).join(", ") });
    case "updatedWithin":
    case "updatedAfter":
      return t("libui.searchFilters.loosen.updated");
    default:
      return humanize(filterKey);
  }
}

/** Clear the filter dimension a loosen suggestion refers to. */
export function clearFilterDimension(filters: SearchFilters, filterKey: string): SearchFilters {
  const next: SearchFilters = { ...filters };
  switch (filterKey) {
    case "status":
      delete next.status;
      break;
    case "priority":
      delete next.priority;
      break;
    case "assigneeAgentId":
    case "assigneeUserId":
      delete next.assigneeAgentId;
      delete next.assigneeUserId;
      break;
    case "projectId":
      delete next.projectId;
      break;
    case "labelId":
      delete next.labelId;
      break;
    case "updatedWithin":
    case "updatedAfter":
      delete next.updatedWithin;
      delete next.updatedAfter;
      break;
    default:
      break;
  }
  return next;
}
