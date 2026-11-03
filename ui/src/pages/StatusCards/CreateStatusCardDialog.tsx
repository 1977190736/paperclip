import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { defaultStatusCardRefreshPolicy } from "@paperclipai/shared";
import { Loader2 } from "lucide-react";

import { statusCardsApi } from "@/api/statusCards";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { InlineBanner } from "@/components/InlineBanner";
import { queryKeys } from "@/lib/queryKeys";
import { SummarizerAgentSelect } from "./SummarizerAgentSelect";
import { useTranslation } from "@/i18n";

const EXAMPLE_KEYS = ["example1", "example2", "example3"] as const;

export function CreateStatusCardDialog({
  companyId,
  open,
  onOpenChange,
}: {
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState("");
  // "" → the built-in Summarizer; otherwise the id of the override agent.
  const [agentId, setAgentId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setPrompt("");
    setAgentId("");
    setError(null);
  }

  function close() {
    onOpenChange(false);
    // Delay reset so the closing animation does not flash cleared fields.
    window.setTimeout(reset, 200);
  }

  const createMutation = useMutation({
    mutationFn: () =>
      statusCardsApi.create(companyId, {
        interestPrompt: prompt.trim(),
        titlePinned: false,
        agentId: agentId || null,
        refreshPolicy: defaultStatusCardRefreshPolicy,
      }),
    onMutate: () => setError(null),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.statusCards.list(companyId, false) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.statusCards.list(companyId, true) }),
      ]);
      close();
    },
    onError: (err) => setError(err instanceof Error ? err.message : t("tail1.statusCard.createCardFailed")),
  });

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("tail1.statusCard.newCard")}</DialogTitle>
          <DialogDescription>
            {t("tail1.statusCard.createDesc")}
          </DialogDescription>
        </DialogHeader>

        {error ? <InlineBanner tone="danger" title={t("tail1.statusCard.createFailed")}>{error}</InlineBanner> : null}

        <div className="space-y-3">
          <label htmlFor="status-card-prompt" className="block pb-1 text-sm font-semibold">
            {t("tail1.statusCard.createPromptLabel")}
          </label>
          <Textarea
            id="status-card-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={5}
            autoFocus
            placeholder={t("tail1.statusCard.createPromptPlaceholder")}
            className="text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">{t("tail1.statusCard.examples")}</span>
            {EXAMPLE_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setPrompt(t(`tail1.statusCard.${key}`))}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/40"
              >
                {t(`tail1.statusCard.${key}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold">{t("tail1.statusCard.agent")}</label>
          <SummarizerAgentSelect companyId={companyId} value={agentId} onChange={setAgentId} enabled={open} />
          <p className="text-xs text-muted-foreground">
            {t("tail1.statusCard.agentHint")}
          </p>
        </div>

        <DialogFooter>
          <div className="flex gap-2">
            <Button variant="outline" onClick={close} disabled={createMutation.isPending}>
              {t("secrets.common.cancel")}
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={prompt.trim().length === 0 || createMutation.isPending}
            >
              {createMutation.isPending ? <Loader2 className="animate-spin" /> : null}
              {t("tail1.statusCard.createCard")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
