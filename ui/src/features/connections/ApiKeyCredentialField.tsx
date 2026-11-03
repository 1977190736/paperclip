import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/i18n";

/** Providers supply only credentials the current user is authorized to use.
 * Values are opaque connection references, never secret values. */
export function ApiKeyCredentialField({ options, connectionId, onConnectionChange, value, onChange,
  disabled, loading, error, providerName, keysUrl, label }: {
  options: { id: string; label: string; disabled?: boolean }[];
  connectionId: string | null;
  onConnectionChange(id: string): void;
  value: string;
  onChange(value: string): void;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  providerName: string;
  keysUrl: string;
  label?: string;
}) {
  const id = useId();
  const { t } = useTranslation();
  const fieldLabel = label ?? t("connections.apiKeyField.apiKey");
  const choices = connectionId && !options.some(option => option.id === connectionId)
    ? [{ id: connectionId, label: loading ? t("connections.apiKeyField.checkingSaved") : t("connections.apiKeyField.previouslySelectedUnavailable"), disabled: true }, ...options] : options;
  return <div className="space-y-2">
    <Label htmlFor={id}>{fieldLabel}</Label>
    {choices.length > 0 && <select id={id} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      value={connectionId ?? ""} disabled={disabled} onChange={event => onConnectionChange(event.target.value)}>
      {choices.map(option => <option key={option.id} value={option.id} disabled={option.disabled}>{option.label}</option>)}
      <option value="">{t("connections.apiKeyField.enterNew")}</option>
    </select>}
    {!connectionId && <Input id={choices.length ? `${id}-new` : id} aria-label={choices.length ? t("connections.apiKeyField.newApiKey") : undefined}
      type="password" autoComplete="off" value={value} disabled={disabled}
      onChange={event => { onConnectionChange(""); onChange(event.target.value); }} placeholder={t("connections.apiKeyField.pasteKey", { provider: providerName })} />}
    {loading && <p role="status" className="text-sm text-muted-foreground">{t("connections.apiKeyField.checkingSaved")}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{t("connections.apiKeyField.loadFailed")} {error}</p>}
    <a href={keysUrl} target="_blank" rel="noreferrer" className="text-sm underline">{t("connections.apiKeyField.getKey", { provider: providerName })}</a>
  </div>;
}
