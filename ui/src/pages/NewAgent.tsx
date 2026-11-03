import { useEffect } from "react";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useTranslation } from "@/i18n";
import { NewAgentSetup } from "../components/new-agent/NewAgentSetup";

export function NewAgent() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const { t } = useTranslation();
  useEffect(() => {
    setBreadcrumbs([
      { label: t("agentConfig.breadcrumbs.agents"), href: "/agents" },
      { label: t("agentConfig.breadcrumbs.newAgent") },
    ]);
  }, [setBreadcrumbs, t]);
  return <NewAgentSetup />;
}
