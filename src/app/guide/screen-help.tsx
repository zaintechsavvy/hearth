import base from "../how-it-works/page.module.css";
import styles from "./guide.module.css";

const AUTOMATION = `alias: Light the wall iPad when the garage opens
triggers:
  - trigger: state
    entity_id: cover.garage_door
    to: open
actions:
  - action: notify.mobile_app_wall_ipad
    data:
      title: Garage door
      message: The garage door just opened.
      data:
        push:
          interruption-level: time-sensitive`;

const TOPICS = [
  {
    title: "What Hearth can and cannot do",
    points: [
      "A web page can keep the display on, or let it turn off. No web page can turn an iPad's display back on: that takes a touch, the top button, or a notification.",
      "Keep the screen awake, in Wall tablet settings, holds the display on Always, While in use, or Never. While in use keeps it on for a few minutes after a touch, the doorbell, or a door, garage, lock, or alarm change, then lets the iPad's Auto-Lock take over.",
      "Holding the display on from an app on the Home Screen needs iPadOS 18.4 or later.",
      "Rest on a dark screen shows near black instead of the clock while the display is on, and the garage, door, and lock pictures still play over it.",
    ],
  },
  {
    title: "Burn in",
    points: [
      "The base iPad has an LCD, which does not burn in the way an OLED can. A faint after-image after hours of the same picture fades on its own, and the resting clock drifts a few pixels each minute anyway.",
      "On an LCD the backlight stays on behind black, so a dark resting screen saves little power. Letting the display turn off is what saves the battery.",
    ],
  },
  {
    title: "Waking it for the garage or the door",
    points: [
      "Install the Home Assistant app on the iPad, sign in, and allow its notifications, including Critical Alerts if you want them to sound through silent and Do Not Disturb.",
      "Add an automation in Home Assistant that sends the iPad a time-sensitive notification when the garage opens. A notification normally lights the Lock Screen; unlock to get back to Hearth.",
      "Use interruption-level: critical instead for things like a leak, which also plays a sound with the iPad muted.",
      "Guided Access holds notifications back while a session runs, so this does not mix with Guided Access. Try it on your iPad before relying on it.",
    ],
  },
  {
    title: "Guided Access and Auto-Lock",
    points: [
      "During a Guided Access session the iPad uses its own timer: Settings, Accessibility, Guided Access, Display Auto-Lock. Outside a session it is Settings, Display & Brightness, Auto-Lock.",
      "To keep the display on all day, set that timer to Never, or leave it short and choose While in use in Hearth.",
    ],
  },
  {
    title: "Battery",
    points: [
      "Keep the tablet on its charger. On the iPad (A16) and other supported models, turn on Settings, Battery, Battery Health, 80% Limit, so it does not sit at full all day.",
      "Without that setting, the iPad stops charging by itself when full; it is safe to leave plugged in.",
    ],
  },
];

/** Plain answers for a tablet on the wall: what a web page can do with the display, and how to have Home Assistant light it. */
export function ScreenHelp() {
  return (
    <section id="screen" className={`${base.section} ${styles.help}`} aria-labelledby="screen-title">
      <h2 id="screen-title" className={base.heading}>When the screen sleeps</h2>
      <p className={base.body}>An iPad on the wall can stay lit all day, or go dark to save its battery and light up when something happens. Here is what works, and what does not.</p>
      <div className={styles.topics}>
        {TOPICS.map(topic => (
          <div key={topic.title} className={`${base.card} ${styles.topic}`}>
            <h3 className={styles.topicTitle}>{topic.title}</h3>
            <ul className={styles.points}>{topic.points.map(point => <li key={point}>{point}</li>)}</ul>
          </div>
        ))}
      </div>
      <div className={`${base.card} ${styles.topic}`}>
        <h3 className={styles.topicTitle}>An example automation</h3>
        <p className={base.body}>Replace <code>cover.garage_door</code> with your garage and <code>mobile_app_wall_ipad</code> with the iPad&apos;s own action, which Home Assistant lists under Developer tools, Actions, as notify.mobile_app_ and the iPad&apos;s name.</p>
        <pre className={styles.code}><code>{AUTOMATION}</code></pre>
      </div>
    </section>
  );
}
