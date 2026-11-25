"use client";

import { ChevronDown, Speaker } from "lucide-react";
import { Badge } from "@/components/arc/badge/badge";
import { useSpeakerWake } from "@/components/dashboard/media/use-spotify-start";
import { WAKE_LABELS } from "@/components/dashboard/media/wake-hint";
import { Glass } from "@/components/glass/glass";
import styles from "./connections.module.css";
import own from "./spotify-section.module.css";

const ext = { target: "_blank", rel: "noreferrer", className: own.link };

/**
 * How Hearth gets Spotify onto an idle Google speaker, which Spotify Connect only lists once something casts Spotify
 * to it: by asking someone to say so, or in one tap through Spotcast or the Google Assistant SDK in Home Assistant.
 */
export function SpotifySpeakers() {
  const wake = useSpeakerWake(true);
  const methods = Object.values(wake?.methods ?? {});
  const method = methods.find(Boolean) ?? null;
  return (
    <Glass shape="panel" className={styles.group}>
      <div className={styles.row}>
        <Speaker className={styles.rowIcon} size={20} strokeWidth={1.75} aria-hidden="true" />
        <div className={styles.rowText}>
          <span className={styles.rowTitle}>Google speakers</span>
          <span className={styles.rowMeta}>
            {method ? `Hearth starts Spotify on an idle Google speaker in one tap with ${WAKE_LABELS[method]}.`
              : "Choose an idle Google speaker and Hearth asks you to say “Hey Google, play Spotify” to it, then plays your pick there. No setup needed."}
          </span>
        </div>
        <div className={styles.rowActions}>
          {wake && <Badge tone={method ? "success" : "neutral"} size="sm">{method ? WAKE_LABELS[method] : "By voice"}</Badge>}
        </div>
      </div>
      <details className={own.details}>
        <summary>Optional: start them in one tap <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" /></summary>
        <div className={own.guide}>
          <p className={own.text}>
            Add either one to Home Assistant and Hearth finds it on its own. Spotcast is the more reliable; Google says its Assistant SDK may not start music.
          </p>
          <p className={own.stepTitle}>Spotcast, from the community store</p>
          <ol className={`${own.text} ${own.numbered}`}>
            <li>Spotcast needs Spotify Premium and Home Assistant 2026.4 or newer. In Home Assistant, open the community store (HACS), find Spotcast, install it, and restart.</li>
            <li>In <a href="https://developer.spotify.com/dashboard" {...ext}>Spotify&apos;s developer dashboard</a>, open or create an app and add the Redirect URI https://my.home-assistant.io/redirect/oauth.</li>
            <li>Go to Settings, Devices and services, Add integration, Spotcast. Enter the app&apos;s Client ID and secret, then link the same Spotify account Hearth uses.</li>
            <li>Finish the desktop sign in it asks for: approve, copy the address your browser lands on (an error page at 127.0.0.1:8080 is expected), and paste it in.</li>
          </ol>
          <p className={own.text}><a href="https://github.com/Mincka/spotcast/blob/main/docs/config/spotcast_configuration.md" {...ext}>Spotcast&apos;s setup guide</a></p>
          <p className={own.stepTitle}>Google Assistant SDK, built into Home Assistant</p>
          <ol className={`${own.text} ${own.numbered}`}>
            <li>In the Google Cloud console, create a project and enable the Google Assistant API.</li>
            <li>Set up its consent screen as an external app and publish it, or sign ins expire after 7 days.</li>
            <li>Create an OAuth client of type Web application with the redirect URI https://my.home-assistant.io/redirect/oauth.</li>
            <li>In Home Assistant, add the Google Assistant SDK integration, paste the client ID and secret, and link your Google account.</li>
            <li>Hearth then asks Google to play Spotify on a speaker by its name in the Google Home app.</li>
          </ol>
          <p className={own.text}><a href="https://www.home-assistant.io/integrations/google_assistant_sdk/" {...ext}>Home Assistant&apos;s guide</a></p>
        </div>
      </details>
    </Glass>
  );
}
