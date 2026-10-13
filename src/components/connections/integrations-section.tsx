"use client";

import { Cpu, House, Plus, Radio, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { ConfirmMorph } from "@/components/arc/confirm-morph/confirm-morph";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { useHome } from "@/components/dashboard/use-home";
import { Glass } from "@/components/glass/glass";
import { removeIntegration } from "@/lib/actions";
import { INTEGRATION_LABELS, type IntegrationKind } from "@/lib/integrations/types";
import { AddIntegrationDialog } from "./add-integration-dialog";
import { PairMatterDialog } from "./pair-matter-dialog";
import styles from "./connections.module.css";
import { SettingsSection } from "./settings-section";

export interface IntegrationSummary {
  id: string;
  name: string;
  kind: IntegrationKind;
  address: string | null;
}

const ICONS: Record<IntegrationKind, typeof House> = { "home-assistant": House, matter: Radio, demo: Sparkles };

export function IntegrationsSection({ integrations }: { integrations: IntegrationSummary[] }) {
  const router = useRouter();
  const { home, refresh } = useHome();
  const [adding, setAdding] = useState(false);
  const [pairing, setPairing] = useState<IntegrationSummary | null>(null);

  const changed = () => {
    router.refresh();
    refresh();
  };

  return (
    <SettingsSection id="connections" title="Connections" description={<>Where Hearth finds your devices.</>} action={<Button variant="secondary" onClick={() => setAdding(true)}><Plus size={16} strokeWidth={1.75} aria-hidden="true" /> Add</Button>}>

      <Glass shape="panel" className={styles.group}>
        {integrations.length === 0 ? (
          <EmptyState
            className={styles.empty}
            icon={<Cpu size={24} strokeWidth={1.75} />}
            title="Nothing connected yet"
            description="Add Home Assistant with a long-lived access token, or point Hearth at a Matter server."
          />
        ) : integrations.map(integration => {
          const Icon = ICONS[integration.kind];
          const status = home?.integrations.find(item => item.id === integration.id);
          return (
            <div key={integration.id} className={styles.row}>
              <Icon className={styles.rowIcon} size={20} strokeWidth={1.75} aria-hidden="true" />
              <div className={styles.rowText}>
                <span className={styles.rowTitle}>{integration.name}</span>
                <span className={styles.rowMeta}>{integration.address ?? (integration.kind === "demo" ? "Simulated devices" : INTEGRATION_LABELS[integration.kind])}</span>
                {status && Object.keys(status.unsupported).length > 0 && (
                  <span className={styles.rowNote} title="Hearth can see these but cannot show them yet">
                    Not shown yet: {Object.entries(status.unsupported).sort((a, b) => b[1] - a[1]).map(([type, count]) => `${type.replaceAll("_", " ")} ${count}`).join(" · ")}
                  </span>
                )}
              </div>
              <div className={styles.rowActions}>
                {status && (
                  <Badge tone={status.ok ? "success" : "danger"} size="sm" title={status.error ?? undefined}>
                    {status.ok ? `${status.deviceCount} ${status.deviceCount === 1 ? "device" : "devices"}` : "Not responding"}
                  </Badge>
                )}
                {integration.kind === "matter" && <Button variant="ghost" size="sm" onClick={() => setPairing(integration)}>Pair device</Button>}
                <ConfirmMorph label="Remove" prompt={`Remove ${integration.name}?`} confirmLabel="Remove" pendingLabel="Removing" doneLabel="Removed" onConfirm={async () => {
                  const result = await removeIntegration(integration.id);
                  if (!result.ok) throw new Error(result.error);
                  changed();
                }} />
              </div>
            </div>
          );
        })}
      </Glass>

      <AddIntegrationDialog open={adding} onOpenChange={setAdding} onAdded={() => { refresh(); router.push("/"); }} />
      <PairMatterDialog integration={pairing} onOpenChange={open => !open && setPairing(null)} onPaired={changed} />
    </SettingsSection>
  );
}
