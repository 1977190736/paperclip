/**
 * Single source of truth for adapter display metadata.
 *
 * Built-in adapters have entries in `adapterDisplayMap`. External (plugin)
 * adapters get sensible defaults derived from their type string via
 * `getAdapterDisplay()`.
 */
import type { ComponentType } from "react";
import { agentHarnessType } from "@paperclipai/shared";
import { t } from "@/i18n";
import {
  Bot,
  Code,
  Gem,
  Moon,
  MousePointer2,
  Sparkles,
  Terminal,
  Cpu,
} from "lucide-react";
import { OpenCodeLogoIcon } from "@/components/OpenCodeLogoIcon";
import { pendingAgentSetupDisplayAdapter } from "@/lib/agent-setup-choice";

// ---------------------------------------------------------------------------
// Type suffix parsing
// ---------------------------------------------------------------------------

// Suffixes stripped from type ids when deriving a human-readable label for
// unknown (plugin) adapter types. "_local" is a legacy qualifier from before
// first-class Environments and is never displayed; "_gateway" is re-appended
// as " (gateway)" to disambiguate gateway variants. Known adapters in
// `adapterDisplayMap` have final labels and never get a derived suffix.
const STRIPPED_TYPE_SUFFIXES = ["_local", "_gateway"] as const;

const DISPLAY_SUFFIXES: Record<string, string> = {
  _gateway: "gateway",
};

function getTypeSuffix(type: string): string | null {
  for (const [suffix, mode] of Object.entries(DISPLAY_SUFFIXES)) {
    if (type.endsWith(suffix)) return mode;
  }
  return null;
}

function withSuffix(label: string, suffix: string | null): string {
  return suffix ? `${label} (${suffix})` : label;
}

// ---------------------------------------------------------------------------
// Display metadata per adapter type
// ---------------------------------------------------------------------------

export interface AdapterDisplayInfo {
  label: string;
  /** i18n key resolved at render time; overrides `label` when set. */
  labelKey?: string;
  /** i18n key resolved at render time; overrides `description` when set. */
  descriptionKey?: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  recommended?: boolean;
  comingSoon?: boolean;
  disabledLabel?: string;
  disabledLabelKey?: string;
  experimental?: boolean;
  hideFromVisualSelection?: boolean;
}

function displayDescription(info: { description?: string; descriptionKey?: string }): string {
  if (info.descriptionKey) return t(info.descriptionKey);
  return info.description ?? t("tools.adapters.externalAdapter");
}

export function displayDisabledLabel(info: AdapterDisplayInfo): string | undefined {
  if (info.disabledLabelKey) return t(info.disabledLabelKey);
  return info.disabledLabel;
}

const adapterDisplayMap: Record<string, AdapterDisplayInfo> = {
  antigravity_runtime: { label: "Google Antigravity", descriptionKey: "tools.adapters.descriptions.antigravityRuntime", icon: Gem, hideFromVisualSelection: true },
  copilot_runtime: { label: "GitHub Copilot", descriptionKey: "tools.adapters.descriptions.copilotRuntime", icon: Code, hideFromVisualSelection: true },
  kimi_runtime: { label: "Kimi Code (Runner)", descriptionKey: "tools.adapters.descriptions.kimiRuntime", icon: Moon, hideFromVisualSelection: true },
  acpx_local: {
    label: "ACPX (retired)",
    descriptionKey: "tools.adapters.descriptions.acpxRetired",
    icon: Bot,
    comingSoon: true,
    disabledLabelKey: "tools.adapters.descriptions.acpxDisabled",
    hideFromVisualSelection: true,
  },
  claude_local: {
    label: "Claude Code",
    descriptionKey: "tools.adapters.descriptions.claudeLocal",
    icon: Sparkles,
    recommended: true,
  },
  codex_local: {
    label: "Codex",
    descriptionKey: "tools.adapters.descriptions.codexLocal",
    icon: Code,
    recommended: true,
  },
  paperclip_runner: {
    label: "Paperclip Runner",
    descriptionKey: "tools.adapters.descriptions.paperclipRunner",
    icon: Cpu,
    experimental: true,
  },
  gemini_local: {
    label: "Gemini CLI",
    descriptionKey: "tools.adapters.descriptions.geminiLocal",
    icon: Gem,
  },
  grok_local: {
    label: "Grok Build",
    descriptionKey: "tools.adapters.descriptions.grokLocal",
    icon: Bot,
  },
  kimi_local: {
    label: "Kimi Code",
    descriptionKey: "tools.adapters.descriptions.kimiLocal",
    icon: Moon,
  },
  hermes_gateway: {
    label: "Hermes Gateway",
    descriptionKey: "tools.adapters.descriptions.hermesGateway",
    icon: Bot,
    hideFromVisualSelection: true,
  },
  hermes_local: {
    label: "Hermes",
    descriptionKey: "tools.adapters.descriptions.hermesLocal",
    icon: Bot,
  },
  opencode_local: {
    label: "OpenCode",
    descriptionKey: "tools.adapters.descriptions.opencodeLocal",
    icon: OpenCodeLogoIcon,
  },
  pi_local: {
    label: "Pi",
    descriptionKey: "tools.adapters.descriptions.piLocal",
    icon: Terminal,
  },
  cursor: {
    label: "Cursor",
    descriptionKey: "tools.adapters.descriptions.cursor",
    icon: MousePointer2,
  },
  // Display-only choice: persisted as paperclip_runner with provider openai_dot.
  grok_bot: { label: "Grok Bot", experimental: true, icon: Bot, descriptionKey: "tools.adapters.descriptions.grokBot" },
  openai_dot: {
    label: "OpenAI Dot",
    descriptionKey: "tools.adapters.descriptions.openaiDot",
    icon: Bot,
    experimental: true,
  },
  muse: {
    label: "Muse — Personal agent",
    descriptionKey: "tools.adapters.descriptions.muse",
    icon: Bot,
    experimental: true,
  },
  cursor_cloud: {
    label: "Cursor Cloud",
    descriptionKey: "tools.adapters.descriptions.cursorCloud",
    icon: MousePointer2,
  },
  openclaw_gateway: {
    label: "OpenClaw Gateway",
    descriptionKey: "tools.adapters.descriptions.openclawGateway",
    icon: Bot,
    comingSoon: true,
    disabledLabelKey: "tools.adapters.descriptions.openclawDisabled",
    hideFromVisualSelection: true,
  },
  process: {
    label: "Process",
    labelKey: "tools.adapters.labels.process",
    descriptionKey: "tools.adapters.descriptions.process",
    icon: Cpu,
    comingSoon: true,
  },
  http: {
    label: "HTTP",
    descriptionKey: "tools.adapters.descriptions.http",
    icon: Cpu,
    comingSoon: true,
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function humanizeType(type: string): string {
  // Strip known type suffixes so "droid_local" → "Droid", not "Droid Local"
  let base = type;
  for (const suffix of STRIPPED_TYPE_SUFFIXES) {
    if (base.endsWith(suffix)) {
      base = base.slice(0, -suffix.length);
      break;
    }
  }
  return base.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getAdapterLabel(type: string): string {
  // Known labels are final — only unknown (plugin) types get a derived
  // suffix, so labels like "OpenClaw Gateway" don't become
  // "OpenClaw Gateway (gateway)".
  const known = adapterDisplayMap[type];
  if (known) return known.labelKey ? t(known.labelKey) : known.label;
  return withSuffix(humanizeType(type), getDisplaySuffixLabel(type));
}

function getDisplaySuffixLabel(type: string): string | null {
  const suffix = getTypeSuffix(type);
  return suffix ? t(`tools.adapters.suffix.${suffix}`) : null;
}

export function getAdapterLabels(): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const [type, info] of Object.entries(adapterDisplayMap)) {
    labels[type] = info.labelKey ? t(info.labelKey) : info.label;
  }
  return labels;
}

export function getAdapterDisplay(type: string): AdapterDisplayInfo {
  const known = adapterDisplayMap[type];
  if (known) {
    return { ...known, label: known.labelKey ? t(known.labelKey) : known.label, description: displayDescription(known) };
  }

  const suffixLabel = getDisplaySuffixLabel(type);
  const label = withSuffix(humanizeType(type), suffixLabel);
  return {
    label,
    description: suffixLabel
      ? t("tools.adapters.externalScopedAdapter", { suffix: suffixLabel })
      : t("tools.adapters.externalAdapter"),
    icon: Cpu,
  };
}

export function agentDisplayAdapterType(agent: { adapterType: string; adapterConfig: Record<string, unknown>; pauseReason?: unknown; metadata?: unknown }): string {
  const pendingSetup = pendingAgentSetupDisplayAdapter(agent);
  if (pendingSetup) return pendingSetup;
  if (agent.adapterType !== "paperclip_runner") return agent.adapterType;
  if (agent.adapterConfig.provider === "openai_dot" || agent.adapterConfig.provider === "grok_bot" || agent.adapterConfig.provider === "muse") {
    return agent.adapterConfig.provider;
  }
  const harness = agentHarnessType(agent.adapterType, agent.adapterConfig);
  return ["codex_local", "claude_local", "opencode_local", "pi_local", "antigravity_runtime"].includes(harness) ? harness : agent.adapterType;
}

export function isKnownAdapterType(type: string): boolean {
  return type in adapterDisplayMap;
}
