import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { VoicePhoneConfiguration } from "@paperclipai/shared";
import { voicePhoneApi } from "@/api/voicePhone";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/i18n";
export interface SpekoPhoneLineFormProps { configuration?: VoicePhoneConfiguration; loading?: boolean; saving?: boolean; saved?: boolean; error?: string; onRefresh(): void; onSave(input: {numberId: string; enabled: boolean; guestIntake?: boolean; lowTrustEnvironmentId?: string | null}): void }
export function SpekoPhoneLineForm({configuration, loading, saving, saved, error, onRefresh, onSave}: SpekoPhoneLineFormProps) {
  const { t } = useTranslation();
  const [numberId, setNumberId] = useState(configuration?.number?.id ?? ""), [enabled, setEnabled] = useState(configuration?.number?.enabled ?? false), [guestIntake, setGuestIntake] = useState(configuration?.number?.guestIntake ?? false), [invalid, setInvalid] = useState(false), [environmentId, setEnvironmentId] = useState(configuration?.number?.lowTrustEnvironmentId ?? "");
  useEffect(() => {setNumberId(configuration?.number?.id ?? ""); setEnabled(configuration?.number?.enabled ?? false); setGuestIntake(configuration?.number?.guestIntake ?? false); setEnvironmentId(configuration?.number?.lowTrustEnvironmentId ?? "");}, [configuration]);
  const selected = configuration?.inventory.find(n => n.id === numberId);
  return <section className="max-w-xl space-y-3">
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{t("comps2.voice.incomingCalls")}</h2><Button size="sm" variant="ghost" disabled={loading || saving} onClick={onRefresh}>{t("comps2.voice.refreshNumbers")}</Button></div>
    <p className="text-sm text-muted-foreground">{t("comps2.voice.incomingIntro")}</p>
    {loading && <p role="status" className="text-sm text-muted-foreground">{t("comps2.voice.loadingNumbers")}</p>}
    {!loading && !configuration?.inventory.length && <p className="text-sm text-muted-foreground">{t("comps2.voice.noNumbers")} <a className="text-primary underline" href="https://platform.speko.ai" target="_blank" rel="noreferrer">{t("comps2.voice.buyOrImportNumber")}</a>, {t("comps2.voice.verifyThenRefresh")}</p>}
    <form className="space-y-3" onSubmit={event => {event.preventDefault(); if (!numberId || !selected?.available) {setInvalid(true); return;} setInvalid(false); onSave({numberId, enabled, guestIntake, lowTrustEnvironmentId: environmentId || null});}}>
      <label className="grid min-w-0 gap-2 text-sm font-medium">{t("comps2.voice.companyPhoneNumber")}<select aria-label={t("comps2.voice.companyPhoneNumber")} disabled={loading || saving} className="min-w-0 w-full rounded-md border border-input bg-background p-2 text-sm" value={numberId} onChange={event => {setNumberId(event.target.value); setInvalid(false);}}><option value="">{t("comps2.voice.selectNumber")}</option>{configuration?.inventory.map(n => <option key={n.id} value={n.id} disabled={!n.available}>{n.phoneNumber}{n.label ? ` · ${n.label}` : ""}{!n.available ? ` · ${t("comps2.voice.unavailable")}` : ""}</option>)}</select></label>
      {selected && !selected.inboundReady && <p className="text-sm text-muted-foreground">{t("comps2.voice.completeNumberSetup")}{selected.issues.length ? ` ${selected.issues.join(". ")}` : ""}</p>}
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={enabled} disabled={loading || saving} onCheckedChange={value => setEnabled(value === true)} />{t("comps2.voice.enableIncoming")}</label>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={guestIntake} disabled={loading || saving} onCheckedChange={value => setGuestIntake(value === true)} />{t("comps2.voice.allowGuestIntake")}</label>
      {guestIntake && <p className="text-sm text-muted-foreground">{t("comps2.voice.guestIntakePolicy")}</p>}
      {guestIntake && <label className="grid min-w-0 gap-2 text-sm font-medium">{t("comps2.voice.executionSandbox")}<select aria-label={t("comps2.voice.executionSandbox")} disabled={loading || saving} className="min-w-0 w-full rounded-md border border-input bg-background p-2 text-sm" value={environmentId} onChange={event => setEnvironmentId(event.target.value)}><option value="">{t("comps2.voice.useAgentSandbox")}</option>{configuration?.sandboxEnvironments?.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select><span className="text-sm font-normal text-muted-foreground">{t("comps2.voice.sandboxNote")}</span></label>}
      {invalid && <p role="alert" className="text-sm text-destructive">{t("comps2.voice.chooseNumber")}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center justify-between gap-3"><p role="status" className="text-sm text-muted-foreground">{saved ? t("comps2.voice.settingSaved") : ""}</p><Button type="submit" disabled={loading || saving}>{saving ? t("agentDetail.configBar.saving") : t("comps2.voice.saveIncomingSetting")}</Button></div>
    </form>
  </section>;
}
export function SpekoPhoneLine({companyId, endpointId}: {companyId: string; endpointId: string}) {
  const queryClient = useQueryClient(), key = ["speko-phone-line", companyId, endpointId];
  const query = useQuery({queryKey: key, queryFn: () => voicePhoneApi.configuration(companyId, endpointId), retry: false});
  const mutation = useMutation({mutationFn: (input: {numberId: string; enabled: boolean; guestIntake?: boolean; lowTrustEnvironmentId?: string | null}) => voicePhoneApi.save(companyId, endpointId, input), onSuccess: data => queryClient.setQueryData(key, data)});
  return <SpekoPhoneLineForm configuration={query.data} loading={query.isLoading} saving={mutation.isPending} saved={mutation.isSuccess} error={(mutation.error ?? query.error)?.message} onRefresh={() => void query.refetch()} onSave={input => mutation.mutate(input)} />;
}
