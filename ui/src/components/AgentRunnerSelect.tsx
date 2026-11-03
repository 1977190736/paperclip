import type { AgentRunner, AgentRunnerChoice } from "@paperclipai/shared";
import { Field } from "./agent-config-primitives";
import { SelectPopover } from "./ui/select";
import { Button } from "./ui/button";
import { useTranslation } from "@/i18n";

export function AgentRunnerSelect({
  value,
  onChange,
  defaultRunner,
  supportedRunners = ["legacy"],
  disabled,
  pending,
  error,
  onRetry,
}: {
  value: AgentRunnerChoice;
  onChange: (value: AgentRunnerChoice) => void;
  defaultRunner?: AgentRunner;
  supportedRunners?: readonly AgentRunner[];
  disabled?: boolean;
  pending?: boolean;
  error?: string;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Field label={t("comps2.shared.runner")}>
      <SelectPopover
        aria-label={t("comps2.shared.runner")}
        disabled={disabled}
        value={value}
        displayValue={value === "auto" ? (defaultRunner ? (defaultRunner === "paperclip" ? `${t("comps2.shared.paperclipRunner")} (${t("comps2.shared.defaultSuffix")})` : `${t("comps2.shared.legacyRunner")} (${t("comps2.shared.defaultSuffix")})`) : pending ? t("comps2.shared.checkingRunner") : t("comps2.shared.runnerUnavailable")) : undefined}
        onValueChange={next => onChange(next as AgentRunnerChoice)}
        options={[
          { value: "paperclip", label: defaultRunner === "paperclip" ? `${t("comps2.shared.paperclipRunner")} (${t("comps2.shared.defaultSuffix")})` : t("comps2.shared.paperclipRunner"), disabled: !supportedRunners.includes("paperclip") && value !== "paperclip" },
          { value: "legacy", label: defaultRunner === "legacy" ? `${t("comps2.shared.legacyRunner")} (${t("comps2.shared.defaultSuffix")})` : t("comps2.shared.legacyRunner"), disabled: !supportedRunners.includes("legacy") && value !== "legacy" },
        ]}
      />
      {error && <div className="mt-2 space-y-2">
        <p role="alert" className="text-sm text-destructive">{error}</p>
        {onRetry && <Button type="button" variant="outline" size="sm" disabled={pending || disabled} onClick={onRetry}>{t("comps2.shared.retryRunnerDiscovery")}</Button>}
      </div>}
    </Field>
  );
}
