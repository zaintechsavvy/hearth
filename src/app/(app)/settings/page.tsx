import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { AccountSection } from "@/components/connections/account-section";
import { AppearanceSection } from "@/components/connections/appearance-section";
import { AssistantsSection } from "@/components/connections/assistants-section";
import { CamerasSection } from "@/components/connections/cameras-section";
import { IntegrationsSection } from "@/components/connections/integrations-section";
import styles from "@/components/connections/connections.module.css";
import type { CameraSource } from "@/lib/cameras/stream-relay";
import { unseal } from "@/lib/crypto";
import { db } from "@/lib/db";
import { assistant, camera, integration } from "@/lib/db/schema";
import { streamRelayUrl } from "@/lib/home";
import { publicConfig } from "@/lib/integrations/registry";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Settings" };

function hostOf(source: CameraSource) {
  try {
    return new URL(source.url).host;
  } catch {
    return "Unknown address";
  }
}

export default async function ConnectionsPage() {
  const user = await requireUser();
  const [integrations, cameras, relayUrl, assistants] = await Promise.all([
    db.select().from(integration).where(eq(integration.userId, user.id)).orderBy(integration.createdAt),
    db.select().from(camera).where(eq(camera.userId, user.id)).orderBy(camera.createdAt),
    streamRelayUrl(user.id),
    db.select({ id: assistant.id, provider: assistant.provider, model: assistant.model, baseUrl: assistant.baseUrl, isDefault: assistant.isDefault }).from(assistant).where(eq(assistant.userId, user.id)).orderBy(assistant.createdAt),
  ]);

  return (
    <div className={styles.page}>
      <header>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.lede}>Connections, cameras, assistants, and how Hearth looks. Secrets are encrypted before they are stored.</p>
      </header>
      <IntegrationsSection integrations={integrations.map(row => ({ id: row.id, name: row.name, kind: row.kind, ...publicConfig(row) }))} />
      <AssistantsSection assistants={assistants} />
      <CamerasSection cameras={cameras.map(row => ({ id: row.id, name: row.name, host: hostOf(unseal<CameraSource>(row.source)) }))} relayUrl={relayUrl} />
      <AppearanceSection />
      <AccountSection user={{ name: user.name, email: user.email }} />
    </div>
  );
}
