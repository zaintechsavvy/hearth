import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { AccountSection } from "@/components/connections/account-section";
import { CamerasSection } from "@/components/connections/cameras-section";
import { IntegrationsSection } from "@/components/connections/integrations-section";
import styles from "@/components/connections/connections.module.css";
import type { CameraSource } from "@/lib/cameras/stream-relay";
import { unseal } from "@/lib/crypto";
import { db } from "@/lib/db";
import { camera, integration } from "@/lib/db/schema";
import { streamRelayUrl } from "@/lib/home";
import { publicConfig } from "@/lib/integrations/registry";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Connections" };

function hostOf(source: CameraSource) {
  try {
    return new URL(source.url).host;
  } catch {
    return "Unknown address";
  }
}

export default async function ConnectionsPage() {
  const user = await requireUser();
  const [integrations, cameras, relayUrl] = await Promise.all([
    db.select().from(integration).where(eq(integration.userId, user.id)).orderBy(integration.createdAt),
    db.select().from(camera).where(eq(camera.userId, user.id)).orderBy(camera.createdAt),
    streamRelayUrl(user.id),
  ]);

  return (
    <div className={styles.page}>
      <header>
        <h1 className={styles.title}>Connections</h1>
        <p className={styles.lede}>Connect the services that run your home. Secrets are encrypted before they are stored.</p>
      </header>
      <IntegrationsSection integrations={integrations.map(row => ({ id: row.id, name: row.name, kind: row.kind, ...publicConfig(row) }))} />
      <CamerasSection cameras={cameras.map(row => ({ id: row.id, name: row.name, host: hostOf(unseal<CameraSource>(row.source)) }))} relayUrl={relayUrl} />
      <AccountSection user={{ name: user.name, email: user.email }} />
    </div>
  );
}
