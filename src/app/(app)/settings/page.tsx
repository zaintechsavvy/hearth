import type { Metadata } from "next";
import { and, eq, gt } from "drizzle-orm";
import { AccountSection } from "@/components/connections/account-section";
import { AlertsSection } from "@/components/connections/alerts-section";
import { AppearanceSection } from "@/components/connections/appearance-section";
import { HouseholdSection } from "@/components/connections/household-section";
import { AssistantsSection } from "@/components/connections/assistants-section";
import { CalendarsSection } from "@/components/connections/calendars-section";
import { CamerasSection } from "@/components/connections/cameras-section";
import { IntegrationsSection } from "@/components/connections/integrations-section";
import { RoomsSection } from "@/components/connections/rooms-section";
import { SecuritySection } from "@/components/connections/security-section";
import { SettingsShell } from "@/components/connections/settings-shell";
import { WallSection } from "@/components/connections/wall-section";
import styles from "@/components/connections/connections.module.css";
import type { CameraSource } from "@/lib/cameras/stream-relay";
import { unseal } from "@/lib/crypto";
import { db } from "@/lib/db";
import { assistant, calendar, camera, integration, invite, membership, user as users } from "@/lib/db/schema";
import { getPreferences, streamRelayUrl } from "@/lib/home";
import { publicConfig } from "@/lib/integrations/registry";
import { requireHome } from "@/lib/session";

export const metadata: Metadata = { title: "Settings" };

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "Unknown address";
  }
}

export default async function ConnectionsPage() {
  const home = await requireHome("member");
  const { user } = home;
  const homeId = home.homeId;
  const [integrations, cameras, relayUrl, assistants, calendars, preferences] = await Promise.all([
    db.select().from(integration).where(eq(integration.userId, homeId)).orderBy(integration.createdAt),
    db.select().from(camera).where(eq(camera.userId, homeId)).orderBy(camera.createdAt),
    streamRelayUrl(homeId),
    db.select({ id: assistant.id, provider: assistant.provider, model: assistant.model, baseUrl: assistant.baseUrl, isDefault: assistant.isDefault }).from(assistant).where(eq(assistant.userId, homeId)).orderBy(assistant.createdAt),
    db.select().from(calendar).where(eq(calendar.userId, homeId)).orderBy(calendar.createdAt),
    getPreferences(homeId),
  ]);
  const owner = home.role === "owner";
  const [members, invites] = owner ? await Promise.all([
    db.select({ id: membership.memberId, role: membership.role, pages: membership.pages, name: users.name, email: users.email }).from(membership).innerJoin(users, eq(users.id, membership.memberId)).where(eq(membership.ownerId, homeId)),
    db.select({ code: invite.code, role: invite.role, expiresAt: invite.expiresAt }).from(invite).where(and(eq(invite.ownerId, homeId), gt(invite.expiresAt, new Date()))),
  ]) : [[], []];

  return (
    <div className={styles.page}>
      <header data-on-wall>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.lede}>Pick a section to open it. Passwords and keys are encrypted before they are stored.</p>
      </header>
      <SettingsShell items={[
        ...(owner ? [{ id: "connections", label: "Connections" }] : []),
        { id: "household", label: "Household" },
        { id: "rooms", label: "Rooms" },
        { id: "alerts", label: "Alerts" },
        { id: "security", label: "Doors and alarm" },
        ...(owner ? [{ id: "assistants", label: "Assistants" }, { id: "cameras", label: "Cameras" }] : []),
        { id: "calendars", label: "Calendars" },
        { id: "appearance", label: "Appearance" },
        { id: "wall", label: "Wall tablet" },
        { id: "account", label: "Account" },
      ]}>
      {owner && <IntegrationsSection integrations={integrations.map(row => ({ id: row.id, name: row.name, kind: row.kind, ...publicConfig(row) }))} />}
      <HouseholdSection role={owner ? "owner" : "member"} ownerName={home.ownerName} members={members} invites={invites.map(item => ({ ...item, expiresAt: item.expiresAt.toISOString() }))} pages={preferences.pages.map(page => ({ id: page.id, name: page.name }))} />
      <RoomsSection />
      <AlertsSection alerts={preferences.alerts} />
      <SecuritySection method={preferences.security.method} hasPin={Boolean(preferences.security.hash)} owner={owner} />
      {owner && <AssistantsSection assistants={assistants} />}
      {owner && <CamerasSection cameras={cameras.map(row => ({ id: row.id, name: row.name, host: hostOf(unseal<CameraSource>(row.source).url) }))} relayUrl={relayUrl} />}
      <CalendarsSection calendars={calendars.map(row => ({ id: row.id, name: row.name, color: row.color, host: hostOf(unseal<string>(row.url)) }))} />
      <AppearanceSection pages={preferences.pages.map(page => ({ id: page.id, name: page.name }))} />
      <WallSection />
      <AccountSection user={{ name: user.name, email: user.email }} />
      </SettingsShell>
    </div>
  );
}
