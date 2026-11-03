/**
 * Provider-neutral tool vocabulary shared by live status, transcript rows,
 * and canonical provider activity. Exact semantic tools get purpose-specific
 * copy; ACP kinds and normalized name prefixes cover future adapters.
 */
import {
  BookOpen,
  Brain,
  ChevronsLeftRightEllipsis,
  CircleHelp,
  Clock3,
  FilePenLine,
  Image,
  ListChecks,
  MessageSquareReply,
  Network,
  Search,
  SearchCode,
  ShieldCheck,
  Terminal,
  Wrench,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { t } from "@/i18n";
import { McpIcon } from "./McpIcon";

/** Lucide icons and hand-rolled SVGs (the MCP logo) share this shape. */
export type ToolIcon = ComponentType<SVGProps<SVGSVGElement>>;

export type ToolFamily =
  | "terminal"
  | "grep"
  | "search"
  | "read"
  | "edit"
  | "web"
  | "plan"
  | "question"
  | "agent"
  | "safety"
  | "image"
  | "wait"
  | "mcp"
  | "other";

export interface ToolTaxonomyEntry {
  family: ToolFamily;
  icon: ToolIcon;
  /** Progressive verb for the status pill, without the trailing ellipsis. */
  verbLabel: string;
}

export type ToolClassificationConfidence = "exact" | "kind" | "inferred" | "fallback" | "unnamed";

export interface ToolActivityPresentationInput {
  name?: string | null;
  transport?: string | null;
  namespace?: string | null;
  /** ACP kind or canonical operation. */
  operation?: string | null;
  target?: string | null;
  progress?: string | null;
}

export interface ToolSummaryGroup {
  key: string;
  singular: string;
  plural: string;
}

export interface ToolActivityPresentation {
  icon: ToolIcon;
  family: ToolFamily;
  runningLabel: string;
  completedLabel: string;
  failedLabel: string;
  interruptedLabel: string;
  displayName: string;
  sourceLabel?: string;
  technicalName?: string;
  confidence: ToolClassificationConfidence;
  summaryGroup: ToolSummaryGroup;
}

/** ACPX's placeholder title must never displace real lifecycle identity. */
const GENERIC_TOOL_NAMES = new Set(["tool", "tool call", "tool_call", "acp_tool"]);

export function isGenericToolName(name: string | undefined | null): boolean {
  const raw = (name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s*\((?:pending|in[_ -]?progress|completed|failed|cancelled|canceled)\)$/, "");
  return !raw || GENERIC_TOOL_NAMES.has(raw);
}

interface McpIdentity {
  namespace: string;
  name: string;
}

export function mcpToolIdentity(name: string): McpIdentity | null {
  const doubleUnderscore = name.match(/^mcp__(.+?)__(.+)$/i);
  if (doubleUnderscore) return { namespace: doubleUnderscore[1], name: doubleUnderscore[2] };
  const dotted = name.match(/^mcp\.([^.]+)\.(.+)$/i);
  return dotted ? { namespace: dotted[1], name: dotted[2] } : null;
}

function identifierWords(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function sentenceCase(words: readonly string[]): string {
  if (words.length === 0) return "";
  const text = words.map((word) => {
    if (["api", "id", "lsp", "mcp", "pr", "url"].includes(word)) return word.toUpperCase();
    return word;
  }).join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function humanizeToolName(name: string | undefined | null): string {
  const raw = (name ?? "").trim();
  if (isGenericToolName(raw)) return t("taskChat.tools.unnamed");
  const mcp = mcpToolIdentity(raw);
  return sentenceCase(identifierWords(mcp?.name ?? raw));
}

/** Humanized MCP tool segment for both mcp__server__tool and mcp.server.tool. */
export function mcpToolSegment(name: string): string | null {
  const identity = mcpToolIdentity(name);
  return identity ? humanizeToolName(identity.name) : null;
}

type Action =
  | "read" | "list" | "search" | "fetch" | "open" | "update" | "create"
  | "delete" | "move" | "run" | "request" | "post" | "start" | "stop"
  | "wait" | "finish" | "block" | "think" | "switch" | "other";

interface ExactAction {
  action: Action;
  /** i18n keys resolved to display copy at call time. */
  runningKey?: string;
  completedKey?: string;
  group?: ToolSummaryGroup;
  family?: ToolFamily;
}

const group = (key: string, singular: string, plural: string): ToolSummaryGroup => ({ key, singular, plural });

const exactKey = (name: string) => ({
  runningKey: `taskChat.tools.exact.${name}.running`,
  completedKey: `taskChat.tools.exact.${name}.completed`,
});

const EXACT_ACTIONS: Record<string, ExactAction> = {
  bash: { action: "run" },
  terminal: { action: "run" },
  shell: { action: "run" },
  command: { action: "run" },
  run: { action: "run" },
  execute: { action: "run" },
  exec_command: { action: "run" },
  apply_patch: { action: "update", ...exactKey("applyPatch") },
  read: { action: "read", ...exactKey("read") },
  write: { action: "update", ...exactKey("write") },
  edit: { action: "update", ...exactKey("edit") },
  notebook_read: { action: "read", ...exactKey("notebookRead") },
  notebook_edit: { action: "update", ...exactKey("notebookEdit") },
  glob: { action: "search", ...exactKey("glob") },
  grep: { action: "search", ...exactKey("grep"), family: "grep" },
  tool_search: { action: "search", ...exactKey("toolSearch"), group: group("tool_search", "tool search", "tool searches") },
  web_search: { action: "search", ...exactKey("webSearch"), family: "web" },
  web_fetch: { action: "fetch", ...exactKey("webFetch"), family: "web" },
  todo_write: { action: "update", ...exactKey("todoWrite"), family: "plan", group: group("task_operation", "task operation", "task operations") },
  task_create: { action: "create", ...exactKey("taskCreate"), family: "plan", group: group("task_operation", "task operation", "task operations") },
  task_update: { action: "update", ...exactKey("taskUpdate"), family: "plan", group: group("task_operation", "task operation", "task operations") },
  task_list: { action: "list", ...exactKey("taskList"), family: "plan", group: group("task_operation", "task operation", "task operations") },
  task_get: { action: "read", ...exactKey("taskGet"), family: "plan", group: group("task_operation", "task operation", "task operations") },
  enter_plan_mode: { action: "switch", ...exactKey("enterPlanMode"), family: "plan" },
  exit_plan_mode: { action: "switch", ...exactKey("exitPlanMode"), family: "plan" },
  skill: { action: "read", ...exactKey("skill") },
  ask_user_question: { action: "request", ...exactKey("requestInput"), family: "question" },
  request_human_input: { action: "request", ...exactKey("requestInput"), family: "question", group: group("task_operation", "task operation", "task operations") },
  agent: { action: "start", ...exactKey("startSubagent"), family: "agent" },
  task: { action: "start", ...exactKey("startSubagent"), family: "agent" },
  task_output: { action: "read", ...exactKey("checkSubagentProgress"), family: "agent" },
  task_stop: { action: "stop", ...exactKey("stopSubagent"), family: "agent" },
  send_message: { action: "post", ...exactKey("messageSubagent"), family: "agent" },
  spawn_agent: { action: "start", ...exactKey("startSubagent"), family: "agent" },
  wait_agent: { action: "wait", ...exactKey("checkSubagentProgress"), family: "agent" },
  wait_threads: { action: "wait", ...exactKey("checkTaskProgress"), family: "agent" },
  interrupt_agent: { action: "stop", ...exactKey("interruptSubagent"), family: "agent" },
  report_findings: { action: "post", ...exactKey("reportFindings"), family: "safety" },
  guardian_review: { action: "think", ...exactKey("reviewSafety"), family: "safety" },
  lsp: { action: "read", ...exactKey("inspectCodeIntelligence") },
  compact_conversation: { action: "think", ...exactKey("compactContext") },
  image_generation: { action: "create", ...exactKey("generateImage"), family: "image" },
  view_image: { action: "read", ...exactKey("viewImage"), family: "image" },
  multi_tool_use_parallel: { action: "run", ...exactKey("runToolsParallel") },
  get_task_context: { action: "read", ...exactKey("readTaskContext") },
  get_task_history: { action: "read", ...exactKey("readTaskHistory") },
  list_documents: { action: "list", ...exactKey("listDocuments") },
  read_document: { action: "read", ...exactKey("readDocument") },
  list_document_revisions: { action: "list", ...exactKey("listDocumentRevisions") },
  report_progress: { action: "post", ...exactKey("reportProgress") },
  answer_status_question: { action: "post", ...exactKey("answerStatusQuestion") },
  write_document: { action: "update", ...exactKey("writeDocument") },
  register_deliverable: { action: "create", ...exactKey("registerDeliverable") },
  finish_task: { action: "finish", ...exactKey("reportCompletion") },
  paperclip_finish: { action: "finish", ...exactKey("reportCompletion") },
  block_task: { action: "block", ...exactKey("reportBlocker") },
  paperclip_block: { action: "block", ...exactKey("reportBlocker") },
  request_review: { action: "request", ...exactKey("requestReview") },
  list_agents: { action: "list", ...exactKey("listAgents") },
  get_agent: { action: "read", ...exactKey("readAgentDetails") },
  search_tasks: { action: "search", ...exactKey("searchTasks") },
  list_approvals: { action: "list", ...exactKey("listApprovals") },
  get_approval: { action: "read", ...exactKey("readApproval") },
  get_approval_context: { action: "read", ...exactKey("readApprovalContext") },
  get_workspace_runtime: { action: "read", ...exactKey("readWorkspaceStatus") },
  control_workspace_service: { action: "run", ...exactKey("controlWorkspaceService") },
  set_dependencies: { action: "update", ...exactKey("updateTaskDependencies") },
  set_task_title: { action: "update", ...exactKey("nameTask") },
  create_task: { action: "create", ...exactKey("taskCreate") },
  request_approval: { action: "request", ...exactKey("requestApproval") },
  decide_approval: { action: "update", ...exactKey("decideApproval") },
  comment_on_approval: { action: "post", ...exactKey("commentOnApproval") },
  schedule_wake: { action: "create", ...exactKey("scheduleWake"), family: "wait" },
  generic_api_request: { action: "request", ...exactKey("callPaperclipApi") },
};

const ACTION_PREFIXES: Record<Action, readonly string[]> = {
  read: ["get", "read", "inspect", "view"],
  list: ["list", "glob"],
  search: ["find", "search", "grep", "query", "lookup"],
  fetch: ["fetch", "browse"],
  open: ["open"],
  update: ["write", "edit", "update", "set", "patch", "upsert", "sync"],
  create: ["create", "add", "register", "upload"],
  delete: ["delete", "remove"],
  move: ["move", "rename"],
  run: ["run", "execute", "bash", "shell", "command"],
  request: ["request", "ask", "prompt"],
  post: ["send", "message", "comment", "report", "answer"],
  start: ["start", "spawn", "delegate"],
  stop: ["stop", "cancel", "interrupt"],
  wait: ["wait", "sleep", "poll"],
  finish: ["finish", "complete"],
  block: ["block"],
  think: ["think", "reason", "compact", "review"],
  switch: ["switch", "enter", "exit"],
  other: [],
};

const OPERATION_ACTIONS: Record<string, Action> = {
  read: "read",
  edit: "update",
  delete: "delete",
  move: "move",
  search: "search",
  list: "list",
  execute: "run",
  think: "think",
  fetch: "fetch",
  switch_mode: "switch",
};

function normalizedKey(name: string): string {
  return identifierWords(name).join("_");
}

function inferredAction(words: readonly string[]): Action | null {
  const first = words[0];
  if (!first) return null;
  for (const [action, prefixes] of Object.entries(ACTION_PREFIXES) as Array<[Action, readonly string[]]>) {
    if (prefixes.includes(first)) return action;
  }
  return null;
}

function actionFamily(action: Action): ToolFamily {
  if (action === "run") return "terminal";
  if (action === "read" || action === "list") return "read";
  if (action === "search") return "search";
  if (action === "fetch" || action === "open") return "web";
  if (["update", "create", "delete", "move"].includes(action)) return "edit";
  if (action === "request") return "question";
  if (action === "start" || action === "stop") return "agent";
  if (action === "wait") return "wait";
  return "other";
}

const FAMILY_ICONS: Record<ToolFamily, ToolIcon> = {
  terminal: Terminal,
  grep: SearchCode,
  search: Search,
  read: BookOpen,
  edit: FilePenLine,
  web: ChevronsLeftRightEllipsis,
  plan: ListChecks,
  question: CircleHelp,
  agent: Network,
  safety: ShieldCheck,
  image: Image,
  wait: Clock3,
  mcp: McpIcon,
  other: Wrench,
};

function actionCopy(action: Action, object: string | undefined): { running: string; completed: string } {
  const base = `taskChat.tools.action.${action}`;
  if (object) {
    return {
      running: t(`${base}.runningObject`, { object }),
      completed: t(`${base}.completedObject`, { object }),
    };
  }
  return { running: t(`${base}.running`), completed: t(`${base}.completed`) };
}

function defaultSummaryGroup(action: Action): ToolSummaryGroup {
  switch (action) {
    case "run": return group("command", "command", "commands");
    case "read":
    case "list": return group("read", "read", "reads");
    case "search": return group("search", "search", "searches");
    case "update":
    case "create":
    case "delete":
    case "move": return group("file_change", "file change", "file changes");
    case "start":
    case "stop": return group("delegation", "delegation", "delegations");
    case "wait": return group("wait", "wait", "waits");
    default: return group("tool_action", "tool action", "tool actions");
  }
}

function paperclipSummaryGroup(action: Action): ToolSummaryGroup {
  if (action === "read" || action === "list") return group("paperclip_read", "Paperclip read", "Paperclip reads");
  return group("task_operation", "task operation", "task operations");
}

/**
 * Resolve one tool into status-specific copy and iconography. Precedence is:
 * exact aliases, canonical ACP operation/kind, normalized verb, then a named
 * fallback. MCP remains visible as the source icon without losing semantics.
 */
export function toolActivityPresentation(input: ToolActivityPresentationInput): ToolActivityPresentation {
  const rawName = (input.name ?? "").trim();
  const parsedMcp = mcpToolIdentity(rawName);
  const namespace = (input.namespace ?? parsedMcp?.namespace ?? "").trim();
  // The name itself is authoritative for historical ACPX records that were
  // persisted as builtin before MCP transport normalization existed.
  const transport = (parsedMcp ? "mcp" : input.transport ?? "builtin").toLowerCase();
  const semanticName = (parsedMcp?.name ?? rawName).trim();
  const words = identifierWords(semanticName);
  const key = normalizedKey(semanticName);
  const exact = EXACT_ACTIONS[key];
  const operationAction = OPERATION_ACTIONS[(input.operation ?? "").trim().toLowerCase()];
  const inferred = inferredAction(words);
  const action = exact?.action ?? operationAction ?? inferred ?? "other";
  const confidence: ToolClassificationConfidence = exact
    ? "exact"
    : operationAction
      ? "kind"
      : inferred
        ? "inferred"
        : isGenericToolName(semanticName)
          ? "unnamed"
          : "fallback";
  const displayName = isGenericToolName(semanticName) ? t("taskChat.tools.unnamed") : humanizeToolName(semanticName);
  const identifierLikeName = /^[A-Za-z][A-Za-z0-9_.:-]*$/.test(semanticName);
  const objectWords = inferred && identifierLikeName && words.length > 1 ? words.slice(1) : [];
  const object = objectWords.length ? sentenceCase(objectWords).replace(/^./, (letter) => letter.toLowerCase()) : undefined;
  const copy = exact?.runningKey && exact?.completedKey
    ? { running: t(exact.runningKey), completed: t(exact.completedKey) }
    : action === "other"
      ? isGenericToolName(semanticName)
        ? { running: t("taskChat.tools.runningUnnamedTool"), completed: t("taskChat.tools.ranUnnamedTool") }
        : { running: t("taskChat.tools.runningNamed", { name: displayName }), completed: t("taskChat.tools.ranNamed", { name: displayName }) }
      : actionCopy(action, exact ? undefined : object);
  const semanticFamily = exact?.family ?? actionFamily(action);
  const family = transport === "mcp" ? "mcp" : semanticFamily;
  const sourceLabel = namespace
    ? humanizeToolName(namespace)
    : transport === "mcp"
      ? "MCP"
      : undefined;
  const summaryGroup = namespace.toLowerCase() === "paperclip"
    ? paperclipSummaryGroup(action)
    : exact?.group ?? defaultSummaryGroup(action);

  return {
    icon: FAMILY_ICONS[family],
    family,
    runningLabel: copy.running,
    completedLabel: copy.completed,
    failedLabel: `${copy.completed} · ${t("taskChat.tools.failedSuffix")}`,
    interruptedLabel: `${copy.running} · ${t("taskChat.tools.interruptedSuffix")}`,
    displayName,
    sourceLabel,
    technicalName: rawName || undefined,
    confidence,
    summaryGroup,
  };
}

/** Compact compatibility mapping used by legacy tool rows and live pills. */
export function toolTaxonomy(name: string | undefined | null): ToolTaxonomyEntry {
  const presentation = toolActivityPresentation({ name });
  return {
    family: presentation.family,
    icon: presentation.icon,
    verbLabel: presentation.runningLabel,
  };
}

/** Icons for tool-free informative statuses. */
export function statusLabelIcon(label: string | undefined | null): ToolIcon | null {
  const raw = (label ?? "").trim().toLowerCase();
  if (raw === "thinking") return Brain;
  if (raw === "responding" || raw.startsWith("responding (")) return MessageSquareReply;
  return null;
}
