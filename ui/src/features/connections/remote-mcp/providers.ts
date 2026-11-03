/** Presentation metadata only. Each provider will have its own catalog entry and connection.
 * User-facing copy lives in the `connections.remoteMcp.providers` i18n namespace, keyed by
 * provider id; `name` stays a brand string. */
import { t } from "@/i18n";

export type RemoteMcpProviderId = "zapier" | "arcade" | "composio" | "executor";

export interface RemoteMcpProvider {
  id: RemoteMcpProviderId;
  name: string;
  instructionsCount: number;
  setupUrl: string;
  dashboardUrl: string;
  defaultUrl: string;
  supportsBrowserAuth: boolean;
}

const providerMeta: Record<RemoteMcpProviderId, Omit<RemoteMcpProvider, "id">> = {
  zapier: {
    name: "Zapier", supportsBrowserAuth: false,
    instructionsCount: 3,
    setupUrl: "https://docs.zapier.com/mcp/get-started/connect/other",
    dashboardUrl: "https://mcp.zapier.com",
    defaultUrl: "",
  },
  arcade: {
    name: "Arcade", supportsBrowserAuth: true,
    instructionsCount: 3,
    setupUrl: "https://docs.arcade.dev/en/operate/governance/mcp-gateways",
    dashboardUrl: "https://app.arcade.dev",
    defaultUrl: "",
  },
  composio: {
    name: "Composio", supportsBrowserAuth: true,
    instructionsCount: 2,
    setupUrl: "https://docs.composio.dev/docs/composio-connect",
    dashboardUrl: "https://dashboard.composio.dev",
    defaultUrl: "https://connect.composio.dev/mcp",
  },
  executor: {
    name: "Executor", supportsBrowserAuth: true,
    instructionsCount: 3,
    setupUrl: "https://executor.sh/docs/mcp-proxy",
    dashboardUrl: "https://executor.sh",
    defaultUrl: "",
  },
};

export const remoteMcpProviders: Record<RemoteMcpProviderId, RemoteMcpProvider> = Object.fromEntries(
  (Object.entries(providerMeta) as Array<[RemoteMcpProviderId, Omit<RemoteMcpProvider, "id">]>)
    .map(([id, meta]) => [id, { id, ...meta }]),
) as Record<RemoteMcpProviderId, RemoteMcpProvider>;

function providerKey(id: RemoteMcpProviderId, field: string): string {
  return `connections.remoteMcp.providers.${id}.${field}`;
}

/** Translated copy is resolved at render time so language switches apply live. */
export function remoteMcpProviderDescription(id: RemoteMcpProviderId): string {
  return t(providerKey(id, "description"));
}

export function remoteMcpProviderInstructions(id: RemoteMcpProviderId): string[] {
  return Array.from({ length: providerMeta[id].instructionsCount }, (_, index) =>
    t(providerKey(id, `instructions.${index + 1}`)));
}

export function remoteMcpProviderPlaceholder(id: RemoteMcpProviderId): string {
  return t(providerKey(id, "placeholder"));
}

export function remoteMcpProviderUrlHelp(id: RemoteMcpProviderId): string {
  return t(providerKey(id, "urlHelp"));
}

export function remoteMcpProviderAuthHelp(id: RemoteMcpProviderId): string {
  return t(providerKey(id, "authHelp"));
}
