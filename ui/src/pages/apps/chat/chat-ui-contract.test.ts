import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const localeCache = new Map<string, Record<string, unknown>>();

/**
 * Resolve an English copy value from the en locale files by full i18n key
 * (e.g. "apps.chat.setup.chatWithAgent" -> en.apps.json). The contract pins
 * the English copy so translated components cannot silently drop it.
 */
function copyOf(key: string) {
  const [namespace, ...rest] = key.split(".");
  let data = localeCache.get(namespace);
  if (!data) {
    data = JSON.parse(
      readFileSync(
        new URL(`../../../i18n/locales/en.${namespace}.json`, import.meta.url),
        "utf8",
      ),
    );
    localeCache.set(namespace, data as Record<string, unknown>);
  }
  let node: unknown = data;
  for (const part of [namespace, ...rest]) {
    if (typeof node !== "object" || node === null || !(part in node)) {
      throw new Error(`Missing ${namespace} copy for "${key}"`);
    }
    node = (node as Record<string, unknown>)[part];
  }
  if (typeof node !== "string") {
    throw new Error(`Missing ${namespace} copy for "${key}"`);
  }
  return node;
}

describe("chat connector UI contract", () => {
  it("describes the close command as a conversation control rather than a task status change", () => {
    const setup = source("./ChatEndpointSetup.tsx");
    expect(setup).toContain("Close the active chat conversation");
    expect(setup).not.toContain("Close the active Paperclip task");
  });

  it("retries the selected failed run from every Board entry point", () => {
    for (const file of [
      "AgentDetail.tsx",
      "AgentDetail.production.tsx",
      "Inbox.tsx",
      "LegacyInbox.tsx",
    ]) {
      const page = source(`../../${file}`);
      expect(page).toMatch(
        /agentsApi\.retryFailedRun\(\s*run\.agentId,\s*run\.id,\s*run\.companyId,?\s*\)/,
      );
      expect(page).not.toContain('reason: "retry_failed_run"');
      expect(page).toContain("newRun.runId");
      expect(page).toContain("newRun.issueId");
    }
    const issue = source("../../IssueDetail.tsx");
    expect(issue).toMatch(
      /agentsApi\.retryFailedRun\(\s*failedRun\.agentId,\s*failedRun\.runId,\s*companyId/,
    );
    expect(issue).toContain('t("issueDetail.thread.retryQueuedTitle")');
    expect(copyOf("issueDetail.thread.retryQueuedTitle")).toBe("Retry queued");
    for (const file of ["Inbox.tsx", "LegacyInbox.tsx"]) {
      const page = source(`../../${file}`);
      expect(page).toMatch(
        /const retryRunMutation = useMutation\(\{[\s\S]*?onError: \(error\) => \{\s*pushToast\(\{\s*title: t\("inbox\.toast\.retryFailedTitle"\)/,
      );
    }
    expect(copyOf("inbox.toast.retryFailedTitle")).toBe("Run retry failed");
  });
  it("keeps the exact dual-purpose choice and immutable searchable agent selection", () => {
    const setup = source("./ChatEndpointSetup.tsx");
    expect(setup).toContain('t("apps.chat.setup.chatWithAgent")');
    expect(copyOf("apps.chat.setup.chatWithAgent")).toBe("Chat with an agent");
    expect(setup).toContain('t("apps.chat.setup.useAsTool")');
    expect(copyOf("apps.chat.setup.useAsTool")).toBe(
      "Use this connection as an agent tool",
    );
    expect(setup).toContain("<AgentSelect");
    expect(setup).not.toContain("Change agent");
  });

  it("provides every settled detail tab and no detach control", () => {
    const detail = source("./ChatEndpointDetail.tsx");
    for (const tab of ["settings", "access", "conversations", "activity"]) {
      expect(detail).toContain(`"${tab}"`);
    }
    expect(detail).not.toContain('"overview"');
    expect(detail.toLowerCase()).not.toContain("detach");
  });

  it("shows independent Slack callback surfaces and public URL drift", () => {
    const detail = source("./ChatEndpointDetail.tsx");
    expect(detail).toContain('t("apps.chat.detail.callbackHealth")');
    expect(copyOf("apps.chat.detail.callbackHealth")).toBe("Slack callback health");
    expect(detail).toContain("Events API");
    expect(detail).toContain("Interactivity");
    expect(detail).toContain("Slash command");
    expect(detail).toContain("callbacksNeedUpdate");
    expect(detail).toContain('t("apps.chat.detail.callbacksUpdateHint")');
    expect(copyOf("apps.chat.detail.callbacksUpdateHint")).toContain(
      "Slack callback URLs need an update",
    );
    expect(detail).toContain('t("apps.chat.detail.surfaceNotObserved")');
    expect(copyOf("apps.chat.detail.surfaceNotObserved")).toBe("Not observed");
  });

  it("keeps provider capabilities automatic and settings focused on plausible reach", () => {
    const detail = source("./ChatEndpointDetail.tsx");
    const setup = source("./ChatEndpointSetup.tsx");
    expect(detail).toContain('t("apps.chat.detail.allowDirectMessages")');
    expect(copyOf("apps.chat.detail.allowDirectMessages")).toBe(
      "Allow direct messages",
    );
    expect(detail).toContain('t("apps.chat.detail.allowGroupChats")');
    expect(copyOf("apps.chat.detail.allowGroupChats")).toBe("Allow group chats");
    expect(detail).toContain('t("apps.chat.detail.allowUnlinkedDetail")');
    expect(copyOf("apps.chat.detail.allowUnlinkedDetail")).toContain(
      "People without linked accounts can start isolated tasks",
    );
    expect(copyOf("apps.chat.detail.allowUnlinkedDetail")).toContain(
      "Requests are refused when isolation is unavailable",
    );
    expect(setup).toContain('t("apps.chat.try.linkTestingTitle")');
    expect(copyOf("apps.chat.try.linkTestingTitle")).toBe(
      "Link the account you’re testing",
    );
    expect(setup).toContain('"apps.chat.try.unlinkedDisabledBody"');
    expect(copyOf("apps.chat.try.unlinkedDisabledBody")).toContain(
      "Paperclip does not replay the refused request",
    );
    expect(setup).toContain('t("apps.chat.try.reviewIdentityAccess")');
    expect(copyOf("apps.chat.try.reviewIdentityAccess")).toBe(
      "Review identity access",
    );
    expect(setup).toContain("instanceSettingsApi.getExperimental()");
    expect(setup).toContain("chatEndpointsApi.listPrincipals(endpointId)");
    expect(setup).toContain("queryKeys.chatEndpoints.detail(next.id)");
    expect(setup).toContain('target="_blank" rel="noopener noreferrer"');
    expect(detail).not.toContain("Enable streaming");
    expect(detail).not.toContain("Delivery transport");
  });

  it("explains Discord's independent per-server direct-message restriction", () => {
    const detail = source("./ChatEndpointDetail.tsx");
    expect(detail).toContain('endpoint.provider === "discord"');
    expect(detail).toContain('t("apps.chat.detail.discordDmDetail")');
    expect(copyOf("apps.chat.detail.discordDmDetail")).toBe(
      "People must also enable Direct Messages in their shared Discord server’s Privacy Settings.",
    );
  });

  it("offers only real connection lifecycle actions", () => {
    const detail = source("./ChatEndpointDetail.tsx");
    const settings = detail.slice(
      detail.indexOf("function Settings"),
      detail.indexOf("function SettingToggle"),
    );
    const activity = detail.slice(detail.indexOf("function Activity"));
    expect(detail).toContain('"pause" | "resume" | "remove"');
    expect(detail).toContain('t("apps.chat.detail.removeConnectionTitle")');
    expect(copyOf("apps.chat.detail.removeConnectionTitle")).toBe(
      "Remove this connection?",
    );
    expect(detail).toContain("purpose=chat&resume=${endpoint.id}");
    expect(detail).toContain('? "" : "&reconnect=1"');
    expect(detail).toContain('t("apps.browse.finishSetup")');
    expect(copyOf("apps.browse.finishSetup")).toBe("Finish setup");
    expect(detail).toContain('t("apps.detail.advanced.reconnect")');
    expect(copyOf("apps.detail.advanced.reconnect")).toBe("Reconnect");
    expect(detail).toContain('endpoint.setup?.step !== "complete"');
    expect(detail).not.toContain("Change agent");
    for (const [label, key] of [
      ["Pause", "apps.chat.email.pause"],
      ["Resume", "apps.chat.email.resume"],
      ["Reconnect", "apps.detail.advanced.reconnect"],
      ["Remove connection", "apps.browse.removeConnection"],
    ] as const) {
      expect(activity).toContain(`t("${key}")`);
      expect(copyOf(key)).toBe(label);
      // Guidance may name an action that lives on Activity; only controls
      // must stay out of the Settings surface.
      const settingsButtons = settings.match(/<Button\b[\s\S]*?<\/Button>/g) ?? [];
      expect(settingsButtons.join("\n")).not.toContain(key);
    }
  });

  it("states the provider boundary for reconnect and removal", () => {
    const detail = source("./ChatEndpointDetail.tsx");
    const setup = source("./ChatEndpointSetup.tsx");
    const reconnectBoundaries: Array<[string, string, string]> = [
      [
        "apps.chat.setup.slackReconnectHint",
        "apps.chat.detail.guidance.slack.reconnect",
        "does not reinstall the app or change its workspace or channel membership",
      ],
      [
        "apps.chat.setup.githubRepairHint",
        "apps.chat.detail.guidance.github.reconnect",
        "does not reinstall the App or change repository access",
      ],
      [
        "apps.chat.setup.discordRepairHint",
        "apps.chat.detail.guidance.discord.reconnect",
        "does not add or remove the bot from the server",
      ],
      [
        "apps.chat.setup.teamsRepairHint",
        "apps.chat.detail.guidance.teams.reconnect",
        "does not upload or reinstall the Teams app",
      ],
      [
        "apps.chat.setup.telegramRepairHint",
        "apps.chat.detail.guidance.telegram.reconnect",
        "automatically refreshes its Paperclip webhook and command menu",
      ],
    ];
    for (const [setupKey, detailKey, boundary] of reconnectBoundaries) {
      expect(setup).toContain(`t("${setupKey}")`);
      expect(copyOf(setupKey)).toContain(boundary);
      expect(detail).toContain(`"${detailKey}"`);
      expect(copyOf(detailKey)).toContain(boundary);
    }
    const removalBoundaries: Array<[string, string[]]> = [
      [
        "apps.chat.detail.guidance.slack.remove",
        ["It does not uninstall the Slack app"],
      ],
      [
        "apps.chat.detail.guidance.github.remove",
        ["It does not uninstall the GitHub App"],
      ],
      [
        "apps.chat.detail.guidance.discord.remove",
        ["It does not uninstall the bot"],
      ],
      [
        "apps.chat.detail.guidance.teams.remove",
        ["It does not uninstall the Teams app"],
      ],
      [
        "apps.chat.detail.guidance.telegram.remove",
        [
          "queues durable removal of its Telegram webhook and command menu",
          "After Telegram confirms that cleanup, Paperclip retires the saved token",
          "BotFather bot and its chat memberships remain",
        ],
      ],
    ];
    for (const [key, removalCopy] of removalBoundaries) {
      expect(detail).toContain(`"${key}"`);
      const copy = copyOf(key);
      for (const sentence of removalCopy) {
        expect(copy).toContain(sentence);
      }
    }
  });

  it("uses only executable provider credential flows", () => {
    const setup = source("./ChatEndpointSetup.tsx");
    for (const credential of [
      "botToken",
      "appId",
      "applicationId",
      "guildId",
      "clientId",
      "tenantId",
      "clientSecret",
    ]) {
      expect(setup).toContain(`\"${credential}\"`);
    }
    expect(setup).toContain("credentials.privateKey");
    expect(setup).toContain("credentials.signingSecret");
    expect(setup).toContain('t("apps.chat.slackSetup.steps.createSlackApp")');
    expect(copyOf("apps.chat.slackSetup.steps.createSlackApp")).toBe(
      "Create Slack app",
    );
    expect(setup).toContain('t("apps.chat.setup.githubTitle")');
    expect(copyOf("apps.chat.setup.githubTitle")).toBe(
      "Create or connect a GitHub App",
    );
    expect(setup).toContain('t("apps.chat.setup.teamsStep1")');
    expect(copyOf("apps.chat.setup.teamsStep1")).toContain(
      "create a single-tenant app registration",
    );
    expect(setup).toContain('t("apps.chat.setup.telegramCreateHint")');
    expect(copyOf("apps.chat.setup.telegramCreateHint")).toContain(
      "Create a bot with BotFather",
    );
    expect(setup).toContain('t("apps.chat.setup.discordCreateHint")');
    expect(copyOf("apps.chat.setup.discordCreateHint")).toBe(
      "Create one dedicated Discord application and bot for this Paperclip agent.",
    );
    expect(setup).toContain('t("apps.chat.setup.discordStep2")');
    expect(copyOf("apps.chat.setup.discordStep2")).toContain(
      "enable Message Content Intent",
    );
    expect(setup).toContain('t("apps.chat.setup.discordPermissionsNote")');
    expect(copyOf("apps.chat.setup.discordPermissionsNote")).toMatch(
      /Create\s+Public Threads/,
    );
    expect(setup).toContain("permissions=309237763136&scope=bot");
    expect(setup).not.toContain("applications.commands");
    expect(setup).toContain('t("apps.chat.githubRecovery.generateSecret")');
    expect(copyOf("apps.chat.githubRecovery.generateSecret")).toBe(
      "Generate webhook secret",
    );
    expect(setup).toContain('t("apps.chat.setup.copySecretNote")');
    expect(copyOf("apps.chat.setup.copySecretNote")).toContain(
      "will not show it again",
    );
    expect(setup).toContain('params.get("reconnect") === "1"');
    expect(setup).toContain('t("apps.chat.setup.telegramRepairHint")');
    expect(copyOf("apps.chat.setup.telegramRepairHint")).toContain(
      "Leave the token blank to reuse the saved credential",
    );
    expect(setup).toContain('t("apps.chat.setup.slackReconnectHint")');
    expect(copyOf("apps.chat.setup.slackReconnectHint")).toContain(
      "Leave credentials blank to reuse the saved values",
    );
    expect(setup).toContain('t("apps.chat.setup.regenerateExistingWarning")');
    expect(copyOf("apps.chat.setup.regenerateExistingWarning")).toContain(
      "immediately invalidates GitHub webhook signatures",
    );
    expect(setup).toMatch(/generatingSetupSecret \|\|\s+pending/);
    expect(setup).not.toContain("/setprivacy");
    expect(setup).toContain("/task@bot_username");
    expect(setup).toContain('t("apps.chat.setup.telegramPrivacyPrefix")');
    expect(copyOf("apps.chat.setup.telegramPrivacyPrefix")).toContain(
      "registers its command menu automatically",
    );
    expect(copyOf("apps.chat.setup.telegramPrivacyPrefix")).toContain(
      "ordinary mentions are not delivered to bots",
    );
    expect(setup).toContain("Create Azure Bot");
    expect(setup).toContain('t("apps.chat.setup.teamsRequirements")');
    const teamsRequirements = copyOf("apps.chat.setup.teamsRequirements");
    expect(teamsRequirements).toContain("Microsoft 365 work or school organization");
    expect(teamsRequirements).toContain("teams.live.com");
    expect(teamsRequirements).toContain("commercial cloud tenants only");
    expect(teamsRequirements).toContain("GCC High");
    expect(teamsRequirements).toContain("operated by 21Vianet");
    expect(setup).toContain('t("apps.chat.setup.clientSecretField")');
    expect(copyOf("apps.chat.setup.clientSecretField")).toBe("Client secret value");
    expect(setup).toContain('t("apps.chat.setup.fieldMapTitle")');
    expect(copyOf("apps.chat.setup.fieldMapTitle")).toBe("Microsoft portal field map");
    expect(setup).toContain(
      "Accounts in this organizational directory only (Single tenant)",
    );
    expect(setup).toContain("Use existing app registration");
    expect(setup).toContain("Settings · Configuration");
    expect(setup).toContain("Configure · App features · Bot");
    expect(setup).toContain("Configure · Permissions");
    expect(setup).toContain("Upload an app · Upload a custom app");
    expect(setup).toContain('t("apps.chat.setup.copyManifest")');
    expect(copyOf("apps.chat.setup.copyManifest")).toBe("Copy manifest settings");
    expect(setup).toContain("disabled={!credentials.clientId?.trim()}");
    expect(setup).toContain('t("apps.chat.setup.manifestHint")');
    const manifestHint = copyOf("apps.chat.setup.manifestHint");
    expect(manifestHint).toContain("Enter the Application / Client ID above before copying");
    expect(manifestHint).toContain("not a complete app package");
    expect(setup).toContain('scopes: ["personal", "team", "groupChat"]');
    expect(setup).toContain('scopes: ["personal", "groupChat"]');
    expect(setup).toContain('title: "/status"');
    expect(setup).toContain('title: "/new"');
    expect(setup).toContain('title: "/close"');
    expect(setup).not.toContain("supportsTargetedMessages");
    expect(setup).toContain("resourceSpecific");
    expect(setup).toContain("ChannelMessage.Read.Group");
    expect(setup).toContain("ChatMessage.Read.Chat");
    expect(setup).toContain('t("apps.chat.setup.teamsStep3")');
    expect(copyOf("apps.chat.setup.teamsStep3")).toContain(
      "not Microsoft Graph permissions in Entra",
    );
    expect(setup).toContain('t("apps.chat.setup.ssoNote")');
    const ssoNote = copyOf("apps.chat.setup.ssoNote");
    expect(ssoNote).toContain("does not use Teams single sign-on");
    expect(ssoNote).toContain("only associates the RSC");
    expect(ssoNote).toContain("you do not need to register an Entra");
    expect(setup).toContain("webApplicationInfo");
    expect(setup).toContain('resource: "https://paperclip.ing"');
    expect(setup).toContain('t("apps.chat.setup.rscNote")');
    expect(copyOf("apps.chat.setup.rscNote")).toContain("receive every message");
    expect(setup).toContain('"apps.chat.setup.fieldMap4"');
    const fieldMap4 = copyOf("apps.chat.setup.fieldMap4");
    expect(fieldMap4).toContain("One team install covers its standard");
    expect(fieldMap4).toContain("Private and shared channels require");
    expect(setup).toContain('t("apps.chat.setup.channelsNote")');
    const channelsNote = copyOf("apps.chat.setup.channelsNote");
    expect(channelsNote).toContain("not private channels");
    expect(channelsNote).toContain("native file receipt and consent-based sending");
    expect(setup).not.toContain(
      "does not require a <code>webApplicationInfo</code>",
    );
    expect(setup).not.toContain("api://paperclip-chat/");
    expect(setup).toContain("issue_comment");
    expect(setup).toContain("pull_request");
    expect(setup).toContain("pull_request_review_comment");
    expect(setup).toContain("Enable SSL verification");
    expect(setup).toContain("Only on this account");
    expect(setup).toContain('type="password"');
    expect(setup).not.toContain("WebkitTextSecurity");
    expect(setup).toContain('t("apps.chat.setup.verifySlackTitle")');
    expect(copyOf("apps.chat.setup.verifySlackTitle")).toBe(
      "Verify Slack connection",
    );
    expect(setup).toContain("buildSlackAppManifest");
    expect(setup).toContain("defaultSlackAppConfiguration");
    expect(setup).not.toContain("No credentials");
    expect(setup).not.toContain("managed Microsoft app");
    expect(setup).toContain("slackSetupState({ endpoint, repairing");
    expect(source("./slack/setup-state.ts")).toContain("endpoint.providerAccountId && !repairing");
    expect(setup).not.toContain('field("webhookSecret"');
    expect(setup).not.toContain("@paperclipai/teams-connect");
    expect(setup).not.toContain("Copy setup command");
    expect(setup).not.toContain("Add {agentName} to Slack");
    expect(setup).not.toContain("Create in GitHub");
  });

  it("keeps provider setup failures visible without rendering submitted credentials", () => {
    const setup = source("./ChatEndpointSetup.tsx");
    expect(setup).toContain("sanitizedSetupErrorMessage");
    expect(setup).toContain('role="alert"');
    expect(setup).toContain("onMutate: () => setSetupError(null)");
    expect(setup).not.toContain('title: "Connection failed"');
  });

  it("keeps GitHub setup on the shipped customer-owned App path", () => {
    const setup = source("./ChatEndpointSetup.tsx");
    expect(setup).toContain('t("apps.chat.githubRecovery.generateSecret")');
    expect(copyOf("apps.chat.githubRecovery.generateSecret")).toBe(
      "Generate webhook secret",
    );
    expect(setup).toContain('t("apps.chat.setup.githubAppId")');
    expect(copyOf("apps.chat.setup.githubAppId")).toBe("GitHub App ID");
    expect(setup).toContain('t("apps.chat.setup.privateKeyLabel")');
    expect(copyOf("apps.chat.setup.privateKeyLabel")).toBe("Private key (PEM)");
    expect(setup).toContain('t("apps.chat.setup.choosePemFile")');
    expect(copyOf("apps.chat.setup.choosePemFile")).toBe("Choose .pem file");
    expect(setup).toContain('t("apps.chat.setup.chooseKeyFileAria")');
    expect(copyOf("apps.chat.setup.chooseKeyFileAria")).toBe(
      "Choose GitHub App private key file",
    );
    expect(setup).toContain("readGitHubPrivateKeyFile");
    expect(setup).toContain("privateKeyReadGuard.invalidate()");
    expect(setup).toContain("privateKeyFileLoading ||");
    expect(setup).toContain('t("apps.chat.setup.showKey")');
    expect(copyOf("apps.chat.setup.showKey")).toBe("Show private key");
    expect(setup).toContain('type="password"');
    expect(setup).toContain('event.clipboardData.getData("text")');
    expect(setup).not.toContain("WebkitTextSecurity");
  });
});
