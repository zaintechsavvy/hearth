"use client";

import { ChevronDown, Copy, Music } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { ConfirmMorph } from "@/components/arc/confirm-morph/confirm-morph";
import { Input } from "@/components/arc/input/input";
import { useHome } from "@/components/dashboard/use-home";
import { Glass } from "@/components/glass/glass";
import { disconnectSpotify, saveSpotifyClientId } from "@/lib/spotify/actions";
import { isClientId } from "@/lib/spotify/items";
import styles from "./connections.module.css";
import { SettingsSection } from "./settings-section";
import { SetupStep } from "./setup-step";
import own from "./spotify-section.module.css";

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
  outcome: { tone: "success" | "danger"; title: string; text: string } | null;
}

/**
 * Connecting Spotify as three steps, only the current one open: create the Spotify app with Hearth's Redirect URI,
 * paste its Client ID, then save it and sign in with one button. Once connected the steps fold away.
 */
export function SpotifySection({ settings }: { settings: SpotifySettings }) {
  const router = useRouter();
  const { refresh } = useHome();
  const saved = settings.clientId || (settings.fromEnv ? "env" : "");
  const [changing, setChanging] = useState(false);
  const [appMade, setAppMade] = useState(Boolean(saved));
  const [typed, setTyped] = useState(settings.clientId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const editing = !saved || changing;
  const valid = isClientId(typed.trim());
  const loopback = /^http:\/\/localhost\b/.test(settings.redirectUri);

  useEffect(() => {
    const restored = (event: PageTransitionEvent) => { if (event.persisted) setPending(false); };
    window.addEventListener("pageshow", restored);
    return () => window.removeEventListener("pageshow", restored);
  }, []);

  const copy = async () => {
    setAppMade(true);
    try {
      await navigator.clipboard.writeText(settings.redirectUri);
      setCopied(true);
    } catch {
      setError("Copying was blocked here. Select the address and copy it yourself.");
    }
  };

  /** The form goes to the sign in route itself; a new Client ID is saved first, then the form is sent on. */
  async function connect(event: FormEvent<HTMLFormElement>) {
    setError(null);
    if (!editing || typed.trim() === settings.clientId) return setPending(true);
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    const result = await saveSpotifyClientId(typed);
    if (!result.ok) {
      setPending(false);
      return setError(result.error);
    }
    form.submit();
  }

  const redirect = (
    <>
      <div className={own.uri}>
        <code className={own.code}>{settings.redirectUri}</code>
        <Button type="button" variant="secondary" size="sm" onClick={copy}>
          <Copy size={16} strokeWidth={1.75} aria-hidden="true" /> {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      {loopback && <p className={own.text}>Spotify does not accept localhost. Set BETTER_AUTH_URL to http://127.0.0.1 with this port, or to your https address, and open Hearth there.</p>}
      {settings.openedAt && <p className={own.text}>Spotify sends you back to {new URL(settings.redirectUri).origin}, so open Hearth there to connect, not at {settings.openedAt}.</p>}
    </>
  );
  const clientSummary = (
    <span className={own.summary}>
      {settings.clientId ? <code className={own.code}>{settings.clientId}</code> : <span>Set by SPOTIFY_CLIENT_ID</span>}
      <button type="button" className={own.quiet} onClick={() => { setChanging(true); setTyped(settings.clientId); }}>Change Client ID</button>
    </span>
  );

  const steps = (
    <ol className={own.steps}>
      <SetupStep number={1} title="Create a Spotify app" state={appMade ? "done" : "current"} summary={<span className={own.summary}><code className={own.code}>{settings.redirectUri}</code><button type="button" className={own.quiet} onClick={copy}>{copied ? "Copied" : "Copy"}</button></span>}>
        <p className={own.text}>
          Open <a className={own.link} href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">developer.spotify.com/dashboard</a>, choose Create app,
          tick Web API, and add this Redirect URI exactly.
        </p>
        {redirect}
        <div className={own.actions}><Button type="button" variant="secondary" onClick={() => setAppMade(true)}>I added it</Button></div>
      </SetupStep>
      <SetupStep number={2} title="Paste its Client ID" state={!appMade ? "next" : editing ? "current" : "done"} summary={clientSummary}>
        <p className={own.text}>Save the app, then copy the Client ID from its Settings page. Hearth signs in with PKCE, so it needs no client secret.</p>
        <Input label="Client ID" value={typed} onChange={event => { setTyped(event.target.value); setError(null); }} placeholder="32 letters and numbers"
          autoComplete="off" spellCheck={false} maxLength={64} error={typed.trim() && !valid ? "A Client ID is 32 letters and numbers." : undefined}
          description={settings.linked ? "Changing it signs Spotify out." : undefined} />
      </SetupStep>
      <SetupStep number={3} title="Connect Spotify" state={appMade && (!editing || valid) ? "current" : "next"}>
        <p className={own.text}>Spotify asks you to agree, then sends you back here.</p>
        <div className={own.actions}>
          <Button type="submit" loading={pending}>{editing && typed.trim() !== settings.clientId ? "Save and connect Spotify" : settings.linked ? "Reconnect Spotify" : "Connect Spotify"}</Button>
          {changing && <button type="button" className={own.quiet} onClick={() => { setChanging(false); setTyped(settings.clientId); setError(null); }}>Cancel</button>}
        </div>
      </SetupStep>
    </ol>
  );

  return (
    <SettingsSection id="spotify" title="Spotify" description={<>Sign in to Spotify so the music library shows your playlists, albums, and recent plays, searches all of Spotify, and plays on your speakers. Starting music needs Spotify Premium.</>}>
      {settings.outcome && (
        <Alert tone={settings.outcome.tone} title={settings.outcome.title} onDismiss={() => router.replace("/settings#spotify", { scroll: false })}>{settings.outcome.text}</Alert>
      )}
      <Glass shape="panel" className={styles.group}>
        <form action="/api/spotify/login" method="get" onSubmit={connect}>
          {settings.linked ? (
            <>
              <div className={styles.row}>
                <Music className={styles.rowIcon} size={20} strokeWidth={1.75} aria-hidden="true" />
                <div className={styles.rowText}>
                  <span className={styles.rowTitle}>{settings.account ?? "Spotify"}</span>
                  <span className={styles.rowMeta}>The music library uses this account.</span>
                </div>
                <div className={styles.rowActions}>
                  <Badge tone="success" size="sm">Connected</Badge>
                  <ConfirmMorph label="Disconnect" prompt="Disconnect Spotify?" confirmLabel="Disconnect" pendingLabel="Disconnecting" doneLabel="Disconnected" onConfirm={async () => {
                    const result = await disconnectSpotify();
                    if (!result.ok) throw new Error(result.error);
                    router.refresh();
                    refresh();
                  }} />
                </div>
              </div>
              <details className={own.details} open={changing || undefined}>
                <summary>Spotify app setup <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" /></summary>
                {steps}
              </details>
            </>
          ) : steps}
        </form>
      </Glass>
      <Alert tone="danger" title="Spotify did not connect" open={Boolean(error)}>{error ?? ""}</Alert>
    </SettingsSection>
  );
}
