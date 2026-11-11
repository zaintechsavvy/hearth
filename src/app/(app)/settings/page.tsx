import type { Metadata } from "next";
import { and, eq, gt } from "drizzle-orm";
import { AccountSection } from "@/components/connections/account-section";
import { AlertsSection } from "@/components/connections/alerts-section";
import { AppearanceSection } from "@/components/connections/appearance-section";
import { BedtimeSection } from "@/components/connections/bedtime-section";
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
import { ASSISTANT_PROVIDERS } from "@/lib/assistant/providers";
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
      <SettingsShell heading="Settings" groups={[
        { title: "Your home", items: [
          ...(owner ? [{ id: "connections" as const, label: "Connections", summary: integrations.length ? integrations.map(row => row.name).join(", ") : "Nothing connected yet" }] : []),
          { id: "rooms", label: "Rooms", summary: "Names and order" },
          ...(owner ? [{ id: "cameras" as const, label: "Cameras", summary: cameras.length ? `${cameras.length} ${cameras.length === 1 ? "camera" : "cameras"}` : "None added" }] : []),
          { id: "calendars", label: "Calendars", summary: calendars.length ? `${calendars.length} ${calendars.length === 1 ? "calendar" : "calendars"}` : "None added" },
          ...(owner ? [{ id: "assistants" as const, label: "Assistants", summary: assistants.length ? assistants.map(row => ASSISTANT_PROVIDERS[row.provider].label).join(", ") : "None added" }] : []),
        ] },
        { title: "People", items: [
          { id: "household", label: "Household", summary: owner ? (members.length ? `You and ${members.length} ${members.length === 1 ? "other" : "others"}` : "Just you") : `${home.ownerName}'s home` },
          { id: "account", label: "Account", summary: user.email },
        ] },
        { title: "Safety", items: [
          { id: "alerts", label: "Alerts", summary: "Notifications on this device" },
          { id: "security", label: "Doors and alarm", summary: preferences.security.method === "pin" ? "Opened with the household PIN" : "Opened with a hold" },
          { id: "bedtime", label: "Good night", summary: "What one hold does at night" },
        ] },
        { title: "Look and feel", items: [
          { id: "appearance", label: "Appearance", summary: "Theme, background, and tiles" },
          { id: "wall", label: "Wall tablet", summary: "A screen that stays on the wall" },
        ] },
      ]}>
      {owner && <IntegrationsSection integrations={integrations.map(row => ({ id: row.id, name: row.name, kind: row.kind, ...publicConfig(row) }))} />}
      <HouseholdSection role={owner ? "owner" : "member"} ownerName={home.ownerName} members={members} invites={invites.map(item => ({ ...item, expiresAt: item.expiresAt.toISOString() }))} pages={preferences.pages.map(page => ({ id: page.id, name: page.name }))} shareBackground={preferences.shareBackground} />
      <RoomsSection />
      <AlertsSection alerts={preferences.alerts} />
      <SecuritySection method={preferences.security.method} hasPin={Boolean(preferences.security.hash)} owner={owner} />
      <BedtimeSection owner={owner} />
      {owner && <AssistantsSection assistants={assistants} />}
      {owner && <CamerasSection cameras={cameras.map(row => ({ id: row.id, name: row.name, host: hostOf(unseal<CameraSource>(row.source).url) }))} relayUrl={relayUrl}
        homeAssistants={integrations.filter(row => row.kind === "home-assistant").map(row => ({ id: row.id, name: row.name }))} />}
      <CalendarsSection calendars={calendars.map(row => ({ id: row.id, name: row.name, color: row.color, host: hostOf(unseal<string>(row.url)) }))} />
      <AppearanceSection pages={preferences.pages.map(page => ({ id: page.id, name: page.name }))} />
      <WallSection />
      <AccountSection user={{ name: user.name, email: user.email }} />
      </SettingsShell>
    </div>
  );
}
