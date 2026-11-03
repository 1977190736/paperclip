import { Database, Gauge, ReceiptText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { t, useTranslation } from "@/i18n";

const SURFACES = [
  {
    titleKey: "tail1.accounting.inferenceTitle",
    descriptionKey: "tail1.accounting.inferenceDesc",
    pointKeys: ["tail1.accounting.inferencePoint1", "tail1.accounting.inferencePoint2", "tail1.accounting.inferencePoint3"],
    icon: Database,
    tone: "from-sky-500/12 via-sky-500/6 to-transparent",
  },
  {
    titleKey: "tail1.accounting.financeTitle",
    descriptionKey: "tail1.accounting.financeDesc",
    pointKeys: ["tail1.accounting.financePoint1", "tail1.accounting.financePoint2", "tail1.accounting.financePoint3"],
    icon: ReceiptText,
    tone: "from-amber-500/14 via-amber-500/6 to-transparent",
  },
  {
    titleKey: "tail1.accounting.quotasTitle",
    descriptionKey: "tail1.accounting.quotasDesc",
    pointKeys: ["tail1.accounting.quotaPoint1", "tail1.accounting.quotaPoint2", "tail1.accounting.quotaPoint3"],
    icon: Gauge,
    tone: "from-emerald-500/14 via-emerald-500/6 to-transparent",
  },
] as const;

export function AccountingModelCard() {
  const { t } = useTranslation();
  return (
    <Card className="relative overflow-hidden border-border/70">
      <div className="absolute inset-0 bg-(image:--gradient-extract-3)" />
      <CardHeader className="relative px-5 pt-5 pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-(--tracking-caps) text-muted-foreground">
          {t("tail1.accounting.title")}
        </CardTitle>
        <CardDescription className="max-w-2xl text-sm leading-6">
          {t("tail1.accounting.desc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="relative grid gap-3 px-5 pb-5 md:grid-cols-3">
        {SURFACES.map((surface) => {
          const Icon = surface.icon;
          return (
            <div
              key={surface.titleKey}
              className={`rounded-2xl border border-border/70 bg-gradient-to-br ${surface.tone} p-4 shadow-sm`}
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/80">
                  <Icon className="h-4 w-4 text-foreground" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{t(surface.titleKey)}</div>
                  <div className="text-xs text-muted-foreground">{t(surface.descriptionKey)}</div>
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                {surface.pointKeys.map((pointKey) => (
                  <div key={pointKey}>{t(pointKey)}</div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
