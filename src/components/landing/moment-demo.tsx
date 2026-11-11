"use client";

import { useState } from "react";
import { Switch } from "@/components/arc/switch/switch";
import { MomentScene, type MomentPreviewScene } from "@/components/shell/device-moment";
import styles from "./moment-demo.module.css";

const SCENES: { scene: MomentPreviewScene; name: string; words: [string, string] }[] = [
  { scene: "light", name: "Lamp", words: ["On", "Off"] },
  { scene: "chandelier", name: "Chandelier", words: ["On", "Off"] },
  { scene: "fan", name: "Ceiling fan", words: ["On", "Off"] },
  { scene: "standingFan", name: "Standing fan", words: ["On", "Off"] },
  { scene: "lock", name: "Front door lock", words: ["Locked", "Unlocked"] },
  { scene: "garage", name: "Garage door", words: ["Open", "Closed"] },
  { scene: "door", name: "Back door", words: ["Open", "Closed"] },
  { scene: "window", name: "Bedroom window", words: ["Open", "Closed"] },
];

/** The wall tablet's moments to try: pick a device, flip its switch, and watch the change play on the tablet. */
export function MomentDemo() {
  const [chosen, setChosen] = useState(0);
  const [on, setOn] = useState(true);
  const [plays, setPlays] = useState(0);
  const { scene, name, words } = SCENES[chosen];
  const choose = (index: number) => { setChosen(index); setOn(true); setPlays(count => count + 1); };
  const flip = (next: boolean) => { setOn(next); setPlays(count => count + 1); };
  return (
    <div className={styles.demo}>
      <div role="radiogroup" aria-label="Device" className={styles.list}>
        {SCENES.map((item, index) => (
          <button key={item.scene} type="button" role="radio" aria-checked={index === chosen} className={styles.choice} onClick={() => choose(index)}>{item.name}</button>
        ))}
      </div>
      <div className={styles.side}>
        <div className={styles.tablet}>
          <div className={styles.screen}>
            <span className={styles.art}><MomentScene key={plays} scene={scene} on={on} /></span>
            <span key={`words-${plays}`} className={styles.caption}>
              <span className={styles.name}>{name}</span>
              <span className={styles.state}>{on ? words[0] : words[1]}</span>
            </span>
          </div>
        </div>
        <Switch className={styles.toggle} label={`${name} ${(on ? words[0] : words[1]).toLowerCase()}`} checked={on} onCheckedChange={flip} />
      </div>
    </div>
  );
}
