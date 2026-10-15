# How Hearth works

A tour of the app, screen by screen, then how the pieces behind it talk to each other. The diagrams are [Mermaid](https://mermaid.js.org), which GitHub draws in place.

- [The screens](#the-screens)
- [The big picture](#the-big-picture)
- [Where Hearth runs](#where-hearth-runs)
- [A tap, end to end](#a-tap-end-to-end)
- [How every screen stays live](#how-every-screen-stays-live)
- [Widgets and household items](#widgets-and-household-items)
- [Timers, from a word to a ring](#timers-from-a-word-to-a-ring)
- [The wall tablet](#the-wall-tablet)
- [Activity](#activity)
- [Automations](#automations)
- [Who can open the home](#who-can-open-the-home)

## The screens

### Home

The dashboard is a grid you build yourself. It starts empty; **Add tile** picks what a tile is, **Edit** drags, resizes, and restyles, and the room tabs filter it. A tile's colour is the device's own colour while it is on: a light's glow, a fan's teal.

![The dashboard](screenshots/dashboard-full.png)

![Dashboard in dark mode](screenshots/dashboard-dark.png)

<p align="center"><img src="screenshots/phone.png" alt="Dashboard on a phone" width="390"></p>

In **Edit**, each tile has a **Customize** button: its size, icon, colour, what press and hold does, and settings that belong to its kind, such as timer presets or an energy price.

![Customizing a tile](screenshots/customize.png)

### Household widgets

Widgets keep the things a household juggles: bins, medications, notes, plants, packages, Wi-Fi for guests, and timers. They save the moment you change them, so a note or a plant shows up straight away on every screen.

![Timers side by side](screenshots/timers.png)

![Plants in a grid](screenshots/plants.png)

- **Timers**: one timer fills its tile as a dial. Two to four sit side by side, each in its own colour, and the dial itself starts and pauses. Presets ("Eggs, 7 min") are set once per tile under Customize and sit before the plain lengths.
- **Plants**: as many to a row as the tile is wide, thirstiest first. Tap the drop when you water one.
- **Medications**: what is left today first, missed doses flagged, and the supply counting down as doses are ticked off.

### Activity

Everything that happened at home, newest first, with who did it: a person, an automation, or a change made in Home Assistant's own app or at the switch on the wall.

![Activity](screenshots/activity.png)

### Automations

When, only if, then: a time, sunrise or sunset, or a device changing; only after dark, between times, or while another device is in a state; then control devices, run a scene, or send an alert. Tap a rule to edit it, flip its switch to pause it, or snooze it from **…** for an hour, four hours, or until tomorrow.

![Automations](screenshots/automations.png)

![Editing an automation](screenshots/automation-editor.png)

### The assistant and voice

**Ask Hearth** (or Cmd or Ctrl J) opens a chat; the microphone beside it starts listening straight away. "Set a 10 minute timer for the pasta" works on the device itself, with no AI key. Everything else ("dim the kitchen to 30%") goes to the assistant you connect in Settings. While Hearth listens, a glow from [voice-glow](https://libraries.dev) rises with your voice.

![Assistant](screenshots/assistant.png)

<p align="center"><img src="screenshots/voice.png" alt="The voice glow while Hearth listens" width="440"></p>

### Settings

Connections, cameras, calendars, assistants, alerts, the household, the wall tablet, and how the home is opened.

![Settings](screenshots/settings.png)

### The wall tablet

Turn on **Settings, Wall tablet** on the tablet itself. It keeps the screen on, rests on the date over a large clock with the running timers and what needs doing next as cards, turns a dim red at night, and brings a finished timer up over everything.

![Wall clock](screenshots/wall-clock.png)

![Wall clock at night](screenshots/wall-clock-night.png)

![A timer finished](screenshots/wall-timer-done.png)

![A timer finished at night](screenshots/wall-timer-night.png)

## The big picture

Hearth is one Next.js app. Browsers talk only to Hearth; Hearth talks to everything else, so tokens and passwords never reach a browser.

```mermaid
flowchart LR
  subgraph Screens["Your screens"]
    Phone["Phone"]
    Laptop["Laptop"]
    Wall["Wall tablet"]
  end

  subgraph App["Hearth (Next.js)"]
    UI["Pages and tiles"]
    API["API routes and server actions"]
    Bus["Live bus"]
    Monitor["Home monitor<br/>(always-on servers only)"]
  end

  DB[("Postgres<br/>Neon, Docker, or PGlite")]

  subgraph Home["Your home"]
    HA["Home Assistant"]
    Matter["Matter Server"]
    go2rtc["go2rtc"]
    Devices["Lights, locks, sensors,<br/>speakers, cameras"]
  end

  subgraph Cloud["Services"]
    AI["Claude, ChatGPT, Gemini,<br/>Grok, Groq, Muse"]
    Weather["Open-Meteo"]
    Cal["Google Calendar, iCal"]
    Push["Web Push"]
  end

  Screens -- "HTTPS pages, fetch,<br/>Server-Sent Events" --> UI
  UI --> API
  API <--> DB
  API -- "REST + WebSocket" --> HA
  API -- "WebSocket :5580" --> Matter
  API -- "WebRTC signalling" --> go2rtc
  HA --> Devices
  Matter --> Devices
  go2rtc --> Devices
  API --> AI
  API --> Weather
  API --> Cal
  Monitor --> Push
  Push -. "alerts" .-> Phone
  HA -- "state_changed" --> Bus
  Bus -- "fresh snapshot" --> Screens
```

| Piece | What it does | Where it lives |
| --- | --- | --- |
| Pages and tiles | What you see and tap | `src/app`, `src/components` |
| API routes and server actions | Every read and write, each one checking who you are first | `src/app/api`, `src/lib/actions.ts`, `src/lib/widget-actions.ts` |
| Providers | One adapter per integration, all speaking Hearth's `Device` and `DeviceCommand` | `src/lib/integrations` |
| Live bus | Tells open screens something changed | `src/lib/live/bus.ts`, `src/app/api/home/stream` |
| Home monitor | History, the activity log, alerts, and automations | `src/lib/monitor` |
| Postgres | Accounts, layouts, widgets, automations, encrypted secrets | `src/lib/db`, `drizzle/` |

## Where Hearth runs

The same code runs in two shapes. The difference is whether a process stays up between requests.

```mermaid
flowchart TB
  subgraph Vercel["On Vercel (serverless)"]
    V1["Each request may start a fresh copy"]
    V2["Home Assistant must be reachable from the internet:<br/>Nabu Casa or a Tailscale Funnel"]
    V3["No monitor: Activity reads Home Assistant's logbook instead"]
  end
  subgraph Docker["At home (Docker or npm start)"]
    D1["One process, always on"]
    D2["Reaches homeassistant.local directly"]
    D3["Monitor records history, logs activity,<br/>sends alerts, runs automations"]
  end
```

| | Vercel | Always-on server |
| --- | --- | --- |
| Dashboard, controls, widgets, timers, voice | Yes | Yes |
| Activity | From Home Assistant's logbook | Hearth's own log and Home Assistant's, merged |
| Automations, alerts, sensor history | No | Yes |
| Reaching Home Assistant | A public address | The local address |

On Vercel, Hearth's servers call Home Assistant from the internet, so `http://homeassistant.local:8123` cannot work. A [Tailscale Funnel](https://tailscale.com/kb/1223/funnel) gives Home Assistant a public HTTPS address without opening a port on your router:

```mermaid
flowchart LR
  Vercel["Hearth on Vercel"] -- "HTTPS" --> Funnel["https://homeassistant.your-tailnet.ts.net<br/>(Tailscale Funnel)"]
  Funnel -- "encrypted tunnel" --> Pi["Home Assistant<br/>at home, port 8123"]
```

## A tap, end to end

Pressing a light tile shows the change at once, then confirms it. If the device refuses, the tile rolls back.

```mermaid
sequenceDiagram
  autonumber
  participant You
  participant Tile as Tile (browser)
  participant Route as /api/devices/[id]
  participant HA as Home Assistant
  participant Light
  You->>Tile: tap
  Tile->>Tile: show it on straight away
  Tile->>Route: POST { type: "power", on: true }
  Route->>Route: who are you, may you, is it sensitive?
  Route->>HA: light.turn_on
  HA->>Light: Zigbee, Wi-Fi, or Matter
  HA-->>Route: done
  Route-->>Tile: 200
  HA--)Route: state_changed (WebSocket)
  Route--)Tile: fresh snapshot to every open screen
```

Unlocking a door, opening a garage, and disarming the alarm are **sensitive**: the server only runs them after a hold to confirm or the household PIN, as the owner chose in Settings. Automations, scenes, and the assistant can never run them.

## How every screen stays live

Each page opens **one** Server-Sent Events stream, however many tiles it shows. When anything changes, the server rebuilds the home once and sends the new snapshot to every open screen.

```mermaid
flowchart LR
  HAws["Home Assistant<br/>WebSocket"] -- "state_changed" --> Mirror["In-memory mirror"]
  MatterWs["Matter Server<br/>events"] --> Mirror
  Actions["Your taps, edits,<br/>the assistant"] -- "publish" --> Bus["Live bus"]
  Mirror -- "publish" --> Bus
  Bus -- "a few times a second at most" --> Stream["/api/home/stream"]
  Stream --> A["Phone"]
  Stream --> B["Laptop"]
  Stream --> C["Wall tablet"]
```

If the stream drops, the browser reconnects by itself and checks every 15 seconds until it is back. A pushed snapshot waits while one of your own taps is still on its way, so a switch never flickers back.

## Widgets and household items

Notes, plants, medications, timers, and the rest are rows in one table, `widget_item`, each checked against its kind's schema on every write (`src/lib/widgets/items.ts`). A Wi-Fi password is sealed before it is stored.

```mermaid
sequenceDiagram
  participant You
  participant Page as useHome (browser)
  participant Action as Server action
  participant DB as Postgres
  You->>Page: add a note
  Page->>Page: show it now, with a stand-in id
  Page->>Action: saveWidgetItem("note", data)
  Action->>DB: validate, insert
  Action-->>Page: { ok, id }
  Page->>Page: swap the stand-in id for the real one
  Note over Page: if the save fails, the note is taken back off the board
```

## Timers, from a word to a ring

A timer is a row with an end time, so every screen counts down to the same moment and a timer keeps running with every screen closed.

```mermaid
flowchart TB
  Say["'Set a 10 minute timer for the pasta'"] --> Parse["parseTimerRequest<br/>(on the device)"]
  Tap["A preset or a length on the tile"] --> Save
  Parse --> Save["saveItem: endsAt = now + 10 min"]
  Save --> All["Every screen counts down"]
  All -- "endsAt passes" --> Done{"Wall tablet?"}
  Done -- "yes" --> Takeover["Full-screen alert, louder chime,<br/>rings until dismissed"]
  Done -- "no" --> Banner["A banner at the top"]
  Takeover --> Choice["+1 min, Restart, or Dismiss"]
  Banner --> Choice
```

Voice uses the browser's own speech recognition. Timer requests never leave the device; anything else goes to the assistant.

## The wall tablet

Wall tablet mode is a setting on the tablet itself, kept in that browser, because each tablet hangs somewhere different.

```mermaid
stateDiagram-v2
  [*] --> Awake
  Awake --> Resting: no touch for the idle minutes
  Resting --> Awake: touch, or a chosen motion or door sensor
  Awake --> Dimmed: the night window starts
  Dimmed --> Awake: the night window ends
  Resting --> TimerDone: a timer finishes
  Awake --> TimerDone: a timer finishes
  Dimmed --> TimerDone: a timer finishes, shown in dim red
  TimerDone --> Awake: Dismiss, Restart, or +1 min
```

While it rests, the clock drifts a few pixels each minute so nothing burns into the screen, and running timers sit under it. It asks the browser to keep the screen on.

## Activity

On an always-on server, the monitor writes what changed into Hearth's own log as it happens, credited to whoever caused it. Home Assistant keeps a logbook too, of everything: the app, its automations, the switch on the wall. Activity reads both and merges them, so it works on Vercel as well.

```mermaid
flowchart LR
  Own[("Hearth's log<br/>activity table")] --> Merge
  Logbook["Home Assistant<br/>/api/logbook"] --> Words["Worded like Hearth's entries,<br/>credited to a person or automation"]
  Words --> Merge["Merge, newest first"]
  Merge --> Dedupe["Drop Home Assistant's copy of<br/>a change Hearth already logged"]
  Dedupe --> Page["Activity, 12 hours a page"]
```

## Automations

The monitor checks device rules on every change and clock and sun rules every 30 seconds. A snoozed rule is skipped until its time passes, then runs again by itself; a scheduled time that fell inside the snooze is not caught up.

```mermaid
flowchart LR
  Change["A device changes"] --> Rules
  Clock["Every 30 seconds"] --> Rules["Enabled rules,<br/>not snoozed"]
  Rules --> Conditions{"Only if...<br/>conditions hold?"}
  Conditions -- "yes" --> Run["Control devices, run a scene,<br/>or send an alert"]
  Conditions -- "no" --> Skip["Nothing"]
  Run --> Log["Activity: ran, or what went wrong"]
```

## Who can open the home

```mermaid
flowchart TB
  Press["Unlock, open, or disarm"] --> Method{"Settings, Doors and alarm"}
  Method -- "Hold to confirm" --> Hold["Press and hold the button"]
  Method -- "Household PIN" --> Pin["Enter the PIN"]
  Pin --> Check["The server checks it;<br/>five wrong tries lock it for five minutes"]
  Hold --> Run["Runs"]
  Check --> Run
  Alarm["An alarm with its own code"] --> Code["Always asks for that code"]
```

Guests can be given pages to see, but never unlock or open anything. Members share everything with the owner.
