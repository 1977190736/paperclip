import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/i18n";

export function ChatCommunicationInstructions({ value, onSave }: {
  value: string;
  onSave: (instructions: string) => Promise<void>;
}) {
  const id = useId();
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const text = draft ?? value;
  const dirty = text.trim() !== value;
  return (
    <form className="space-y-3" aria-labelledby={`${id}-label`} onSubmit={async (event) => {
      event.preventDefault();
      if (pending || !dirty) return;
      setPending(true);
      setError(null);
      setSaved(false);
      try {
        await onSave(text.trim());
        setDraft(null);
        setSaved(true);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t("apps.chat.instructions.errorFallback"));
      } finally {
        setPending(false);
      }
    }}>
      <div className="space-y-1">
        <label id={`${id}-label`} htmlFor={id} className="text-sm font-semibold">{t("apps.chat.instructions.label")}</label>
        <p id={`${id}-help`} className="text-sm text-muted-foreground">
          {t("apps.chat.instructions.help")}
        </p>
      </div>
      <Textarea
        id={id}
        aria-describedby={`${id}-help`}
        value={text}
        disabled={pending}
        maxLength={4000}
        rows={4}
        placeholder={t("apps.chat.instructions.placeholder")}
        onChange={(event) => { setDraft(event.target.value); setSaved(false); setError(null); }}
      />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center justify-between gap-3">
        <div>
          {dirty ? <Button type="button" variant="ghost" disabled={pending} onClick={() => { setDraft(null); setError(null); setSaved(false); }}>{t("apps.common.cancel")}</Button>
            : saved ? <span role="status" className="text-sm text-muted-foreground">{t("apps.chat.instructions.saved")}</span> : null}
        </div>
        <Button type="submit" disabled={!dirty || pending}>{pending ? t("apps.chat.instructions.saving") : t("apps.chat.instructions.save")}</Button>
      </div>
    </form>
  );
}
