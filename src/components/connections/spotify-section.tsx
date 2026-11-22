"use client";

import { Copy, Music } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { ConfirmMorph } from "@/components/arc/confirm-morph/confirm-morph";
import { Input } from "@/components/arc/input/input";
import { useHome } from "@/components/dashboard/use-home";
import { Glass } from "@/components/glass/glass";
import { disconnectSpotify, saveSpotifyClientId } from "@/lib/spotify/actions";
import styles from "./connections.module.css";
import { SettingsSection } from "./settings-section";

export interface SpotifySettings {
  /** Saved in Settings; empty when SPOTIFY_CLIENT_ID sets it or nothing does. */
  clientId: string;
  fromEnv: boolean;
  account: string | null;
  linked: boolean;
  redirectUri: string;
  /** Where Hearth was opened from, when Spotify sends people back somewhere else. */
  openedAt: string | null;
  /** How the last sign in went, from Spotify sending the person back. */
  outcome: { tone: "success" | "danger"; text: string } | null;
}

export function SpotifySection({ settings }: { settings: SpotifySettings }) {
  const router = useRouter();
  const { refresh } = useHome();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const ready = Boolean(settings.clientId) || settings.fromEnv;
  const loopback = /^http:\/\/localhost\b/.test(settings.redirectUri);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await saveSpotifyClientId(String(new FormData(event.currentTarget).get("clientId") ?? ""));
    setPending(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  return (
    <SettingsSection id="spotify" title="Spotify" description={<>Sign in to Spotify so the music library can search your playlists, liked songs, and albums, and play them on your speakers. Starting music needs Spotify Premium.</>}>
      <Glass shape="panel" className={styles.group}>
        <div className={styles.row}>
          <Music className={styles.rowIcon} size={20} strokeWidth={1.75} aria-hidden="true" />
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>{settings.linked ? settings.account ?? "Spotify" : "Spotify"}</span>
            <span className={styles.rowMeta}>{settings.linked ? "Signed in. The music library uses this account." : ready ? "Ready to sign in" : "Add your Spotify app's Client ID below first"}</span>
          </div>
          <div className={styles.rowActions}>
            {settings.linked && <Badge tone="success" size="sm">Connected</Badge>}
            {settings.linked ? (
              <ConfirmMorph label="Disconnect" prompt="Disconnect Spotify?" confirmLabel="Disconnect" pendingLabel="Disconnecting" doneLabel="Disconnected" onConfirm={async () => {
                const result = await disconnectSpotify();
                if (!result.ok) throw new Error(result.error);
                router.refresh();
                refresh();
              }} />
            ) : <form action="/api/spotify/login" method="get"><Button type="submit" disabled={!ready}>Connect Spotify</Button></form>}
          </div>
        </div>
        <form className={`${styles.row} ${styles.stacked}`} onSubmit={save}>
          {!settings.linked && (
            <>
              <ol className={styles.steps}>
                <li>Open <a className={styles.inlineLink} href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">developer.spotify.com/dashboard</a> and choose Create app.</li>
                <li>Add this Redirect URI exactly, and tick Web API.</li>
              </ol>
              <div className={styles.inviteLink}>
                <code className={`${styles.inviteCode} ${styles.redirectUri}`}>{settings.redirectUri}</code>
                <Button type="button" variant="secondary" size="sm" onClick={async () => { await navigator.clipboard.writeText(settings.redirectUri); setCopied(true); }}>
                  <Copy size={16} strokeWidth={1.75} aria-hidden="true" /> {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              {loopback && <p className={styles.help}>Spotify does not accept localhost. Set BETTER_AUTH_URL to http://127.0.0.1 with this port, or to your https address, and open Hearth there.</p>}
              {settings.openedAt && <p className={styles.help}>Spotify sends you back to {new URL(settings.redirectUri).origin}, so open Hearth there to connect, not at {settings.openedAt}.</p>}
              <ol className={styles.steps} start={3}>
                <li>Save the app, then copy its Client ID from Settings and paste it here. Hearth signs in with PKCE, so no client secret is needed.</li>
              </ol>
            </>
          )}
          <div className={styles.inline}>
            <Input label="Client ID" name="clientId" defaultValue={settings.clientId} placeholder={settings.fromEnv ? "Set by SPOTIFY_CLIENT_ID" : "32 letters and numbers"} autoComplete="off" spellCheck={false} maxLength={64}
              description={settings.linked ? "Changing it signs Spotify out." : undefined} />
            <Button type="submit" variant="secondary" loading={pending}>Save</Button>
          </div>
          <Alert tone="danger" title="Could not save the Client ID" open={Boolean(error)}>{error ?? ""}</Alert>
        </form>
      </Glass>
      {settings.outcome && <Alert tone={settings.outcome.tone} title={settings.outcome.tone === "success" ? "Spotify is connected" : "Spotify did not connect"}>{settings.outcome.text}</Alert>}
    </SettingsSection>
  );
}
