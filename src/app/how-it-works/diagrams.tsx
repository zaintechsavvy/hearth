import {
  Activity, ArrowDown, BellRing, Bot, Camera, Clock, Cloud, Database, DoorOpen, Fingerprint, Hand, House, KeyRound, Laptop, Lightbulb, ListChecks,
  Lock, Moon, MousePointerClick, Network, Radio, Server, ShieldCheck, ShieldX, Smartphone, Sparkles, Tablet, ToggleRight, Workflow, type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import styles from "./diagrams.module.css";

/** One thing in a diagram: an icon, what it is, and a line on what it does. */
function Node({ icon: Icon, title, note, tone, wide }: { icon: LucideIcon; title: string; note?: string; tone?: "accent" | "warning" | "success" | "danger"; wide?: boolean }) {
  return (
    <div className={styles.node} data-tone={tone} data-wide={wide || undefined}>
      <span className={styles.nodeIcon} aria-hidden="true"><Icon size={18} strokeWidth={1.75} /></span>
      <span className={styles.nodeText}>
        <span className={styles.nodeTitle}>{title}</span>
        {note && <span className={styles.nodeNote}>{note}</span>}
      </span>
    </div>
  );
}

/** Several things that sit together, under a name. */
function Group({ title, children, emphasis }: { title: string; children: ReactNode; emphasis?: boolean }) {
  return (
    <div className={styles.group} data-emphasis={emphasis || undefined}>
      <span className={styles.groupTitle}>{title}</span>
      <div className={styles.groupBody}>{children}</div>
    </div>
  );
}

/** What travels from one side to the other, drawn as a line with a dash flowing along it. */
function Link({ label, back }: { label?: string; back?: boolean }) {
  return (
    <div className={styles.link} data-back={back || undefined}>
      <span className={styles.line} aria-hidden="true" />
      {label && <span className={styles.linkLabel}>{label}</span>}
    </div>
  );
}

/** A diagram read left to right, top to bottom on a narrow screen. */
function Flow({ children, label }: { children: ReactNode; label: string }) {
  return <div className={styles.flow} role="img" aria-label={label}>{children}</div>;
}

export function ConnectsDiagram() {
  return (
    <Flow label="Your screens talk only to Hearth. Hearth talks to Home Assistant, the Matter Server, cameras, and the services you add.">
      <Group title="Your screens">
        <Node icon={Smartphone} title="Phone" />
        <Node icon={Laptop} title="Laptop" />
        <Node icon={Tablet} title="Wall tablet" />
      </Group>
      <Link label="Your session, never a token" />
      <Group title="Hearth" emphasis>
        <Node icon={Server} title="The app" note="Pages, rules, the live stream" tone="accent" />
        <Node icon={Database} title="Database" note="Layout, scenes, activity" />
        <Node icon={KeyRound} title="Secrets" note="Encrypted, never sent out" />
      </Group>
      <Link label="Tokens stay here" />
      <Group title="Your home and services">
        <Node icon={House} title="Home Assistant" note="Devices, rooms, logbook" />
        <Node icon={Network} title="Matter Server" note="Optional, direct" />
        <Node icon={Camera} title="Cameras" note="Through go2rtc" />
        <Node icon={Sparkles} title="Assistant, calendars, transit" note="Keys you add" />
      </Group>
    </Flow>
  );
}

export function RunsDiagram() {
  return (
    <div className={styles.pair}>
      <div className={styles.panel}>
        <span className={styles.panelTitle}><Cloud size={16} strokeWidth={1.75} aria-hidden="true" /> Hosted on Vercel</span>
        <Flow label="Hosted: screens reach Hearth on Vercel, which reaches Home Assistant through a tunnel.">
          <Node icon={Smartphone} title="Screens" />
          <Link />
          <Node icon={Server} title="Hearth" note="Vercel and Postgres" tone="accent" />
          <Link label="Tailscale Funnel or HA Cloud" />
          <Node icon={House} title="Home Assistant" />
        </Flow>
        <ul className={styles.facts}>
          <li>Nothing to run at home</li>
          <li>Open screens write down what they see change</li>
        </ul>
      </div>
      <div className={styles.panel}>
        <span className={styles.panelTitle}><House size={16} strokeWidth={1.75} aria-hidden="true" /> At home in Docker</span>
        <Flow label="At home: screens reach Hearth in Docker, which reaches Home Assistant on the home network.">
          <Node icon={Smartphone} title="Screens" />
          <Link />
          <Node icon={Server} title="Hearth" note="Docker and Postgres" tone="accent" />
          <Link label="Your own network" />
          <Node icon={House} title="Home Assistant" />
        </Flow>
        <ul className={styles.facts}>
          <li>A monitor stays awake around the clock</li>
          <li>Automations, alerts, and history run with every screen off</li>
        </ul>
      </div>
    </div>
  );
}

const TAP_STEPS: { icon: LucideIcon; title: string; note: string; when: string }[] = [
  { icon: MousePointerClick, title: "You tap", note: "A light tile", when: "0 ms" },
  { icon: Lightbulb, title: "The tile changes", note: "Straight away, before any answer", when: "same frame" },
  { icon: ShieldCheck, title: "Hearth checks", note: "Who you are, what you may do", when: "~50 ms" },
  { icon: House, title: "Home Assistant acts", note: "The light turns on", when: "~200 ms" },
  { icon: Radio, title: "Every screen hears", note: "Or the tile goes back if it refused", when: "~250 ms" },
];

export function TapDiagram() {
  return (
    <ol className={styles.steps} aria-label="A tap, end to end">
      {TAP_STEPS.map(({ icon: Icon, title, note, when }, index) => (
        <li key={title} className={styles.step}>
          <span className={styles.stepTop}>
            <span className={styles.stepNumber}>{index + 1}</span>
            <span className={styles.stepWhen}>{when}</span>
          </span>
          <span className={styles.nodeIcon} aria-hidden="true"><Icon size={18} strokeWidth={1.75} /></span>
          <span className={styles.nodeTitle}>{title}</span>
          <span className={styles.nodeNote}>{note}</span>
        </li>
      ))}
    </ol>
  );
}

export function LiveDiagram() {
  return (
    <Flow label="A change in Hearth, in the Home Assistant app, or at a wall switch is rebuilt once and sent to every open screen.">
      <Group title="A change, from anywhere">
        <Node icon={Server} title="In Hearth" />
        <Node icon={Smartphone} title="In the Home Assistant app" />
        <Node icon={ToggleRight} title="At the switch on the wall" />
      </Group>
      <Link label="Within a second" />
      <Node icon={Workflow} title="The home, rebuilt once" note="Bursts of changes become one update" tone="accent" />
      <Link label="One stream per page" />
      <Group title="Every open screen">
        <Node icon={Tablet} title="Wall tablet" />
        <Node icon={Smartphone} title="Phones" />
        <Node icon={Laptop} title="Laptops" />
      </Group>
    </Flow>
  );
}

export function WallDiagram() {
  return (
    <div className={styles.cycle} role="img" aria-label="Awake, the tablet shows Home. After a few idle minutes it rests on a clock or photos. A touch, motion, or a ring wakes it back on Home. At night it dims, to red if you choose.">
      <div className={styles.cycleRow}>
        <Node icon={House} title="Awake on Home" note="Four rows of tiles, no scrolling" tone="accent" />
        <div className={styles.cycleLinks}>
          <Link label="A few idle minutes" />
          <Link label="A touch, motion, or a ring" back />
        </div>
        <Node icon={Clock} title="Resting" note="A large clock, or your photos" />
      </div>
      <div className={styles.cycleNotes}>
        <Node icon={Moon} title="At night" note="Dims, to red if you choose" />
        <Node icon={DoorOpen} title="Something opens elsewhere" note="Shown full screen for five seconds" tone="warning" />
        <Node icon={BellRing} title="The doorbell rings" note="The door camera, with Listen and Talk" tone="warning" />
      </div>
    </div>
  );
}

const MERGED = [
  { icon: Lock, text: "Front door unlocked", meta: "by Sam" },
  { icon: Lightbulb, text: "Porch light turned on", meta: "by the Sunset automation" },
  { icon: ToggleRight, text: "Garage door opened", meta: "at the device" },
];

export function ActivityDiagram() {
  return (
    <Flow label="Hearth's own log and Home Assistant's logbook merge into one Activity list, where a change made anywhere shows once, with who made it.">
      <div className={styles.stack}>
        <Node icon={Server} title="Hearth's log" note="Who did what in Hearth" />
        <Node icon={House} title="Home Assistant's logbook" note="The app, automations, the wall" />
      </div>
      <Link label="The same change within 20 s is one line" />
      <div className={styles.feed} aria-hidden="true">
        <span className={styles.groupTitle}>Activity</span>
        {MERGED.map(({ icon: Icon, text, meta }) => (
          <span key={text} className={styles.feedRow}>
            <Icon size={16} strokeWidth={1.75} />
            <span><b>{text}</b><span className={styles.nodeNote}>{meta}</span></span>
          </span>
        ))}
      </div>
    </Flow>
  );
}

export function OpeningDiagram() {
  return (
    <div className={styles.decision} role="img" aria-label="Unlocking, opening the garage, or disarming always asks a person first: hold to confirm or the household PIN. Automations, scenes, and the assistant are refused.">
      <Node icon={DoorOpen} title="Unlock, open, or disarm" note="From any tile or screen" tone="warning" />
      <span className={styles.down} aria-hidden="true"><ArrowDown size={18} strokeWidth={1.75} /></span>
      <div className={styles.branches}>
        <div className={styles.branch}>
          <span className={styles.branchTitle} data-tone="success">A person, here</span>
          <Node icon={Hand} title="Hold to confirm" note="Until the bar crosses" />
          <Node icon={Fingerprint} title="Or the household PIN" note="Checked before anything moves" />
          <Node icon={ShieldCheck} title="It opens" tone="success" />
        </div>
        <div className={styles.branch}>
          <span className={styles.branchTitle} data-tone="danger">Anything automatic</span>
          <Node icon={Workflow} title="Automations" />
          <Node icon={ListChecks} title="Scenes and Good night" note="They lock and close only" />
          <Node icon={Bot} title="The assistant" />
          <Node icon={ShieldX} title="Refused" tone="danger" />
        </div>
      </div>
    </div>
  );
}

export function MatterDiagram() {
  return (
    <div className={styles.decision} role="img" aria-label="Matter devices pair with one Matter Server. Hearth reaches them through Home Assistant, with its names and rooms, or straight from the Matter Server.">
      <Node icon={Activity} title="Matter devices" note="Paired once, with one Matter Server" />
      <span className={styles.down} aria-hidden="true"><ArrowDown size={18} strokeWidth={1.75} /></span>
      <Node icon={Network} title="Matter Server" tone="accent" />
      <div className={styles.branches}>
        <div className={styles.branch}>
          <span className={styles.branchTitle}>Through Home Assistant</span>
          <Node icon={House} title="Home Assistant" note="Adds names, rooms, automations" />
          <Node icon={Server} title="Hearth" />
        </div>
        <div className={styles.branch}>
          <span className={styles.branchTitle}>Straight to Hearth</span>
          <Node icon={Server} title="Hearth" note="Without Home Assistant at all" />
        </div>
      </div>
    </div>
  );
}

export const DIAGRAMS = {
  connects: ConnectsDiagram, runs: RunsDiagram, tap: TapDiagram, live: LiveDiagram, wall: WallDiagram, activity: ActivityDiagram, opening: OpeningDiagram, matter: MatterDiagram,
};

