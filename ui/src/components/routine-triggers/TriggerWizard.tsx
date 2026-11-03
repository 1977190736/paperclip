import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  AlertCircle,
  Globe,
  GitBranch,
  Radio,
  Webhook,
} from "lucide-react";
import {
  SetupWizardNavigation,
  SetupWizardFooter,
} from "@/components/SetupWizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { cn } from "@/lib/utils";
import { t, useTranslation } from "@/i18n";
import { AgentInstructions, CopyField } from "./WebhookFields";
import { WebhookUrlWarning } from "./WebhookUrlWarning";

export type TriggerDraft = {
  kind: "choose" | "schedule" | "webhook";
  step: number;
  availableStep: number;
  sender: "custom" | "github";
  /** Retained when resuming webhooks created before generic signed-app support. */
  signingMode?: "bearer" | "app_webhook" | "fireflies_hmac";
  frequency: string;
  time: string;
  weekday: string;
  timezone: string;
  created: boolean;
};
export const defaultTriggerDraft: TriggerDraft = {
  kind: "choose",
  step: 0,
  availableStep: 0,
  sender: "custom",
  frequency: "weekdays",
  time: "09:00",
  weekday: "Monday",
  timezone: "America/Chicago",
  created: false,
};
export function webhookAgentInstructions(
  sender: TriggerDraft["sender"],
  routineTitle: string,
  webhookUrl: string,
  webhookSecret: string,
  setupPending = true,
  signingMode: TriggerDraft["signingMode"] = "app_webhook",
) {
  const common = [
    t("comps1.wizardInstructions.connectApp", { title: routineTitle }),
    t("comps1.wizardInstructions.webhookUrlLine", { url: webhookUrl }),
    t("comps1.wizardInstructions.postJson"),
    t("comps1.wizardInstructions.contentType"),
  ];
  const auth =
    sender === "github"
      ? [
          t("comps1.wizardInstructions.githubOpen"),
          t("comps1.wizardInstructions.githubPayloadUrl"),
          t("comps1.wizardInstructions.secretLine", { secret: webhookSecret }),
          t("comps1.wizardInstructions.githubSecretNote"),
          t("comps1.wizardInstructions.githubSelectEvents"),
          t("comps1.wizardInstructions.githubRedeliver"),
        ]
      : [
          t("comps1.wizardInstructions.secretLine", { secret: webhookSecret }),
          ...(signingMode === "bearer" ? [] : [
            t("comps1.wizardInstructions.signingSecretNote", { header: signingMode === "fireflies_hmac" ? "X-Hub-Signature" : "X-Hub-Signature or X-Hub-Signature-256" }),
          ]),
          ...(signingMode === "fireflies_hmac" ? [] : [
            t("comps1.wizardInstructions.bearerHeader", { secret: webhookSecret }),
          ]),
          t("comps1.wizardInstructions.subscribeEvents"),
          t("comps1.wizardInstructions.addWebhookManually"),
          t("comps1.wizardInstructions.idempotencyKey"),
          t("comps1.wizardInstructions.exampleBody"),
          t("comps1.wizardInstructions.sendTestEvent"),
        ];
  return [
    ...common,
    ...auth,
    t("comps1.wizardInstructions.checkConnection"),
    ...(setupPending
      ? [
          t("comps1.wizardInstructions.setupDeliveries"),
          t("comps1.wizardInstructions.finishSetup"),
        ]
      : [
          t("comps1.wizardInstructions.enabledNote"),
        ]),
    t("comps1.wizardInstructions.storeKeySecurely"),
  ].join("\n");
}
export function describeSchedule(draft: TriggerDraft) {
  const cadence = draft.frequency === "daily"
    ? t("comps1.triggerWizard.cadenceDaily")
    : draft.frequency === "weekly"
      ? t(`comps1.triggerWizard.weekday.${draft.weekday}`, { defaultValue: draft.weekday })
      : t("comps1.triggerWizard.cadenceWeekdays");
  return t("comps1.triggerWizard.scheduleSummary", { cadence, time: draft.time });
}
export function RoutineTriggerWizard({
  initialDraft,
  onSaveExit,
  onFinish,
  onCreateWebhook,
  onRotateKey,
  routineTitle,
  routineId,
  routineActive = true,
  webhookUrl = "",
  webhookSecret = "",
  checkResult = "waiting",
}: {
  initialDraft: TriggerDraft;
  routineTitle: string;
  routineId: string;
  routineActive?: boolean;
  webhookUrl?: string;
  webhookSecret?: string;
  onCreateWebhook?: (draft: TriggerDraft) => Promise<void>;
  onRotateKey?: () => Promise<void>;
  onSaveExit: (draft: TriggerDraft) => void | Promise<void>;
  onFinish: (draft: TriggerDraft) => void | Promise<void>;
  checkResult?: "waiting" | "received" | "rejected" | "no_event";
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const { t } = useTranslation();
  const { setBreadcrumbs } = useBreadcrumbs();
  const perform = useCallback(
    async (action: () => void | Promise<void>) => {
      if (busy) return;
      setBusy(true);
      setSaveError("");
      try {
        await action();
      } catch (error) {
        setSaveError(
          error instanceof Error
            ? error.message
            : t("comps1.triggerWizard.saveError"),
        );
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );
  const saveAndExit = useCallback(() => {
    void perform(() => onSaveExit(draft));
  }, [draft, onSaveExit, perform]);
  useEffect(() => {
    setBreadcrumbs([
      {
        label: routineTitle,
        href: `/routines/${routineId}/triggers`,
        onClick: (event) => {
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          saveAndExit();
        },
      },
      { label: t("comps1.triggerWizard.breadcrumb") },
    ]);
  }, [saveAndExit, setBreadcrumbs, routineTitle, routineId]);
  const schedule = draft.kind === "schedule";
  const github = draft.sender === "github";
  const labels = schedule
    ? [t("comps1.triggerWizard.stepChoose"), t("comps1.triggerWizard.stepSetSchedule"), t("comps1.triggerWizard.stepReviewSchedule")]
    : [t("comps1.triggerWizard.stepChoose"), t("comps1.triggerWizard.stepConnectApp"), t("comps1.triggerWizard.stepCheckConnection")];
  function patch(values: Partial<TriggerDraft>) {
    setDraft((current) => ({ ...current, ...values }));
  }
  function advance() {
    void perform(async () => {
      if (draft.kind === "webhook" && draft.step === 0 && !draft.created)
        await onCreateWebhook?.(draft);
      const step = draft.step + 1;
      patch({
        step,
        availableStep: Math.max(draft.availableStep, step),
        created:
          draft.created || (draft.kind === "webhook" && draft.step === 0),
      });
    });
  }
  const title =
    draft.step === 0
      ? t("comps1.triggerWizard.titleChoose")
      : schedule
        ? draft.step === 1
          ? t("comps1.triggerWizard.titleSetSchedule")
          : t("comps1.triggerWizard.titleReviewSchedule")
        : draft.step === 1
          ? github ? t("comps1.triggerWizard.titleConnectGithub") : t("comps1.triggerWizard.titleConnectApp")
          : t("comps1.triggerWizard.titleCheckConnection");
  const subtitle =
    draft.step === 0
      ? t("comps1.triggerWizard.subtitleChoose", { title: routineTitle })
      : schedule
        ? draft.step === 1
          ? t("comps1.triggerWizard.subtitleSetSchedule")
          : t("comps1.triggerWizard.subtitleReviewSchedule")
        : draft.step === 1
          ? t("comps1.triggerWizard.subtitleConnect")
          : t("comps1.triggerWizard.subtitleCheck");
  const selectClass =
    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  const goBack = (
    <Button variant="outline" onClick={() => patch({ step: draft.step - 1 })}>
      {t("comps1.triggerWizard.back")}
    </Button>
  );
  return (
    <div className="min-w-0 w-full max-w-2xl space-y-6">
      <SetupWizardNavigation
        takeover
        disabled={busy}
        ariaLabel={t("comps1.triggerWizard.progressAria")}
        labels={labels}
        step={draft.step}
        availableStep={draft.availableStep}
        onSelect={(step) => patch({ step })}
      />
      <fieldset disabled={busy} className="min-w-0 space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {!schedule && draft.step > 0 && <WebhookUrlWarning url={webhookUrl} />}
        {draft.step === 0 && (
          <fieldset className="space-y-3">
            <legend className="sr-only">{t("comps1.triggerWizard.typeLegend")}</legend>
            {(
              [
                {
                  kind: "schedule",
                  labelKey: "scheduleLabel",
                  detailKey: "scheduleDetail",
                  Icon: CalendarClock,
                },
                {
                  kind: "webhook",
                  labelKey: "webhookLabel",
                  detailKey: "webhookDetail",
                  Icon: Webhook,
                },
              ] as const
            ).map(({ kind, labelKey, detailKey, Icon }) => (
              <label
                key={kind}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-md border p-4 focus-within:ring-2 focus-within:ring-ring",
                  draft.kind === kind
                    ? "border-primary bg-accent/30"
                    : "border-border hover:bg-accent/20",
                )}
              >
                <input
                  type="radio"
                  name="trigger-kind"
                  checked={draft.kind === kind}
                  disabled={draft.created && kind !== draft.kind}
                  onChange={() =>
                    patch({
                      kind,
                      availableStep:
                        kind === draft.kind ? draft.availableStep : 0,
                    })
                  }
                  className="sr-only"
                />
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">
                  <span className="block text-sm font-medium">{t(`comps1.triggerWizard.${labelKey}`)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t(`comps1.triggerWizard.${detailKey}`)}
                  </span>
                </span>
                {draft.kind === kind && <Check className="h-4 w-4" />}
              </label>
            ))}
          </fieldset>
        )}
        {schedule && draft.step === 1 && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="repeat">{t("comps1.triggerWizard.repeat")}</Label>
                <select
                  id="repeat"
                  className={selectClass}
                  value={draft.frequency}
                  onChange={(event) => patch({ frequency: event.target.value })}
                >
                  <option value="daily">{t("comps1.triggerWizard.freqDaily")}</option>
                  <option value="weekdays">{t("comps1.triggerWizard.freqWeekdays")}</option>
                  <option value="weekly">{t("comps1.triggerWizard.freqWeekly")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="run-time">{t("comps1.triggerWizard.time")}</Label>
                <Input
                  id="run-time"
                  type="time"
                  value={draft.time}
                  onChange={(event) => patch({ time: event.target.value })}
                />
              </div>
            </div>
            {draft.frequency === "weekly" && (
              <div className="space-y-2">
                <Label htmlFor="run-day">{t("comps1.triggerWizard.day")}</Label>
                <select
                  id="run-day"
                  className={selectClass}
                  value={draft.weekday}
                  onChange={(event) => patch({ weekday: event.target.value })}
                >
                  {[
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                  ].map((day) => (
                    <option key={day} value={day}>{t(`comps1.triggerWizard.weekday.${day}`)}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="timezone">{t("comps1.triggerWizard.timezone")}</Label>
              <select
                id="timezone"
                className={selectClass}
                value={draft.timezone}
                onChange={(event) => patch({ timezone: event.target.value })}
              >
                {Array.from(
                  new Set([
                    draft.timezone,
                    "America/Chicago",
                    "America/New_York",
                    "America/Los_Angeles",
                    "Europe/London",
                    "UTC",
                  ]),
                ).map((zone) => (
                  <option key={zone}>{zone}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {t("comps1.triggerWizard.timezoneNote")}
              </p>
            </div>
          </div>
        )}
        {schedule && draft.step === 2 && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-md bg-muted/40 p-4">
              <CalendarClock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{describeSchedule(draft)}</p>
                <p className="text-xs text-muted-foreground">
                  {draft.timezone}
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("comps1.triggerWizard.scheduleReviewNote")}
            </p>
          </div>
        )}
        {draft.step === 0 && draft.kind === "webhook" && (
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">
              {t("comps1.triggerWizard.senderQuestion")}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  {
                    sender: "custom",
                    labelKey: "senderCustom",
                    Icon: Globe,
                  },
                  { sender: "github", labelKey: "senderGithub", Icon: GitBranch },
                ] as const
              ).map(({ sender, labelKey, Icon }) => (
                <label
                  key={sender}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md border p-3 focus-within:ring-2 focus-within:ring-ring",
                    draft.sender === sender
                      ? "border-primary bg-accent/30"
                      : "border-border",
                    draft.created && "cursor-default",
                  )}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="sender"
                    checked={draft.sender === sender}
                    disabled={draft.created}
                    onChange={() => patch({ sender })}
                  />
                  <Icon className="h-4 w-4" />
                  <span className="flex-1 text-sm">{t(`comps1.triggerWizard.${labelKey}`)}</span>
                  {draft.sender === sender && <Check className="h-4 w-4" />}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {draft.kind === "webhook" && draft.step === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("comps1.triggerWizard.publicHttpsNote")}
          </p>
        )}
        {!schedule && draft.step === 1 && (
          <div className="space-y-5">
            {webhookSecret && (
              <AgentInstructions
                value={webhookAgentInstructions(
                  draft.sender,
                  routineTitle,
                  webhookUrl,
                  webhookSecret,
                  true,
                  draft.signingMode,
                )}
              />
            )}
            <CopyField
              label={github ? t("comps1.triggerWizard.payloadUrl") : t("comps1.triggerWizard.webhookUrl")}
              value={webhookUrl}
            />
            {!github && draft.signingMode !== "bearer" && (
              <p className="text-sm text-muted-foreground">
                {t("comps1.triggerWizard.signingNote")}
                {draft.signingMode !== "fireflies_hmac" && <>
                  {" "}{t("comps1.triggerWizard.customHeadersNote")}
                </>}
              </p>
            )}
            {webhookSecret ? (
              <CopyField
                label={github ? t("comps1.triggerWizard.secret") : draft.signingMode === "bearer" ? t("comps1.triggerWizard.authHeaderValue") : t("comps1.triggerWizard.secretKey")}
                value={!github && draft.signingMode === "bearer" ? `Bearer ${webhookSecret}` : webhookSecret}
              />
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t("comps1.triggerWizard.keyHiddenNote")}
                </p>
                <Button
                  variant="outline"
                  onClick={() => void perform(() => onRotateKey?.())}
                >
                  {t("comps1.triggerWizard.generateKey")}
                </Button>
              </div>
            )}
          </div>
        )}
        {!schedule && draft.step === 2 && (
          <div className="space-y-5">
            <div className="space-y-1 rounded-md border border-border p-4">
              <p className="text-sm font-medium">{t("comps1.triggerWizard.testOnlyTitle")}</p>
              <p className="text-sm text-muted-foreground">
                {t("comps1.triggerWizard.testOnlyBody")}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {t("comps1.triggerWizard.sendEvent", { source: github ? t("comps1.triggerWizard.github") : t("comps1.triggerWizard.yourApp") })}
              </p>
              <p className="text-sm text-muted-foreground">
                {github
                  ? t("comps1.triggerWizard.githubSendNote")
                  : t("comps1.triggerWizard.appSendNote")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("comps1.triggerWizard.keepOpenNote")}
              </p>
            </div>
            <div
              role="status"
              className="flex items-start gap-3 rounded-md bg-muted/40 p-4"
            >
              {checkResult === "received" ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-(--status-task-done)" />
              ) : checkResult === "rejected" ? (
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
              ) : (
                <Radio className="h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {checkResult === "received"
                    ? t("comps1.triggerWizard.resultReceivedTitle")
                    : checkResult === "rejected"
                      ? t("comps1.triggerWizard.resultRejectedTitle")
                      : checkResult === "no_event"
                        ? t("comps1.triggerWizard.resultNoEventTitle")
                        : t("comps1.triggerWizard.resultWaitingTitle")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {checkResult === "received"
                    ? t("comps1.triggerWizard.resultReceivedBody")
                    : checkResult === "rejected"
                      ? t("comps1.triggerWizard.resultRejectedBody")
                      : t("comps1.triggerWizard.resultWaitingBody")}
                </p>
              </div>
            </div>
            <details>
              <summary className="cursor-pointer text-xs text-muted-foreground">
                {t("comps1.triggerWizard.troubleshoot")}
              </summary>
              <div className="space-y-3 pt-3">
                <p className="text-xs text-muted-foreground">
                  {t("comps1.triggerWizard.troubleshootBody")}
                </p>
                <CopyField label={t("comps1.triggerWizard.webhookUrl")} value={webhookUrl} />
              </div>
            </details>
          </div>
        )}
        {!schedule && draft.step === 2 && (
          <p className="text-xs text-muted-foreground">
            {routineActive
              ? t("comps1.triggerWizard.finishActiveNote")
              : t("comps1.triggerWizard.finishPausedNote")}
          </p>
        )}
        {schedule && draft.step === 2 && !routineActive && (
          <p className="text-sm text-muted-foreground">
            {t("comps1.triggerWizard.schedulePausedNote")}
          </p>
        )}
        {saveError && (
          <p role="alert" className="text-sm text-destructive">
            {saveError}
          </p>
        )}
        <SetupWizardFooter onSaveExit={saveAndExit}>
          {draft.step > 0 && goBack}
          {draft.step === 0 ? (
            <Button disabled={draft.kind === "choose"} onClick={advance}>
              {t("comps1.triggerWizard.continue")}
            </Button>
          ) : schedule ? (
            draft.step === 1 ? (
              <Button disabled={!draft.time} onClick={advance}>
                {t("comps1.triggerWizard.stepReviewSchedule")}
              </Button>
            ) : (
              <Button onClick={() => void perform(() => onFinish(draft))}>
                {t("comps1.triggerWizard.addSchedule")}
              </Button>
            )
          ) : draft.step === 1 ? (
            <Button onClick={advance}>{t("comps1.triggerWizard.stepCheckConnection")}</Button>
          ) : (
            <Button onClick={() => void perform(() => onFinish(draft))}>
              {checkResult === "received"
                ? t("comps1.triggerWizard.finishSetup")
                : t("comps1.triggerWizard.finishWithoutCheck")}
            </Button>
          )}
        </SetupWizardFooter>
      </fieldset>
    </div>
  );
}
