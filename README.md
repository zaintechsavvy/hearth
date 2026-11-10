<p align="center"><img src="docs/banner.svg" alt="Hearth" width="900"></p>

<p align="center"><img src="docs/screenshots/ipad.png" alt="Hearth on a wall tablet" width="900"></p>

<p align="center"><b>Home controls, beautifully calm.</b><br>An Apple Home-style wall display for Home Assistant. A calm, self-hosted dashboard made for a tablet on the wall: tiles you arrange by dragging, a clock when nobody is looking, and the doorbell camera the moment someone rings.</p>

<p align="center">
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-2f6f4e"></a>
  <img alt="Works with Home Assistant" src="https://img.shields.io/badge/works%20with-Home%20Assistant-41BDF5">
  <img alt="Docker Compose" src="https://img.shields.io/badge/runs%20with-Docker%20Compose-2496ED">
  <a href="https://hearth-kappa-six.vercel.app"><img alt="Live demo" src="https://img.shields.io/badge/demo-try%20it-222"></a>
</p>

## Why another dashboard?

The stock Home Assistant dashboard, Mushroom and Bubble Card are great if you enjoy building cards in YAML. Hearth is for a screen the whole household uses, and it does a few things card stacks do not:

- **Arrange by dragging.** Tiles snap into any cell, gaps and all, from 1×1 to 4×3. Each screen width keeps its own layout. No YAML.
- **Rests like a clock.** After a few quiet minutes the wall tablet shows the date and a large clock, dims at night, and wakes on motion, a door, or the doorbell.
- **Doorbell takeover.** A ring fills the screen with that doorbell's camera.
- **Activity that reads like a sentence.** "Garage door closed by Alex." Noisy devices fold into one line, and changes made while no screen was open are kept.
- **Ask in plain words.** Type or say "turn off the kitchen lights" with the AI provider you choose, or none.
- **Works on your phone too**, with the same tiles.

Hearth sits on top of the Home Assistant you already run. It does not replace it, and your automations stay where they are.

<table>
  <tr>
    <td><img src="docs/screenshots/wall-analog.png" alt="The wall tablet resting on the analog clock face"></td>
    <td><img src="docs/screenshots/dashboard-dark.png" alt="The dashboard in dark mode"></td>
  </tr>
  <tr>
    <td align="center">At rest</td>
    <td align="center">Dark mode</td>
  </tr>
</table>

## Quick start

With Docker Compose, on any machine that stays on (a mini PC, a NAS, a Raspberry Pi 5):

```bash
git clone https://github.com/zaintechsavvy/hearth
cd hearth
cp .env.example .env
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> .env
docker compose up -d --build
```

Open `http://<that machine>:3000`, create an account, and either connect Home Assistant (a long-lived access token from your HA profile) or choose **Open the demo home** to look around first. Compose starts Hearth, a Postgres database and the go2rtc camera relay.

If you open Hearth from other devices by IP (for example `http://192.168.1.10:3000`), set that as `BETTER_AUTH_URL` or add it to `TRUSTED_ORIGINS`. Once everyone in your household has an account, set `DISABLE_SIGNUP=true`.

**On the wall:** open Hearth on the tablet, add it to the home screen, turn on **Wall tablet** in Settings, and set the tablet to never auto-lock.

<details>
<summary>Run it without Docker (Node 24)</summary>

```bash
cp .env.example .env.local
# put a long random value in BETTER_AUTH_SECRET:  openssl rand -base64 32
npm install
npm run dev
```

Open http://localhost:3000. Without `DATABASE_URL`, Hearth keeps its data in an embedded Postgres (PGlite) under `data/pglite`.
</details>

## Configuration

| Variable | What it does |
| --- | --- |
| `BETTER_AUTH_SECRET` | Required. Signs sessions and encrypts stored tokens and camera passwords. |
| `BETTER_AUTH_URL` | The address people open Hearth at. |
| `TRUSTED_ORIGINS` | Other addresses Hearth is opened at, comma separated. |
| `DATABASE_URL` | Optional Postgres (Neon, Supabase, your own). Empty means the bundled database. |
| `STREAM_RELAY_URL` | The go2rtc relay for cameras. |
| `DISABLE_SIGNUP` | `true` closes sign up. |

## Privacy

- **Self-hosted.** Hearth talks to your Home Assistant and nothing else, unless you turn on an AI provider for plain-word commands.
- **No telemetry, no analytics, no account with us.**
- **Secrets are encrypted at rest.** Home Assistant tokens, camera passwords and AI keys are sealed with a key derived from `BETTER_AUTH_SECRET` before they reach the database. Passwords are hashed with scrypt.
- **HTTPS** is needed for phones to install Hearth and get alerts; [docs/https.md](docs/https.md) walks through it.

## Features

**The dashboard**, built from tiles you choose and arrange yourself.

![The dashboard](docs/screenshots/dashboard.png)

**The thermostat** glows warm from the top when you raise it and cool from the bottom when you lower it.

| Light | Dark |
| --- | --- |
| ![Thermostat cooling](docs/screenshots/thermostat-cool.png) | ![Thermostat cooling in dark mode](docs/screenshots/thermostat-cool-dark.png) |

**Customize any tile**: its size, icon, colour, and what press and hold does.

![Customize dialog](docs/screenshots/customize.png)

**Activity**: everything that happened, from Hearth and Home Assistant alike, and who did it.

![Activity](docs/screenshots/activity.png)

**Automations** you can pause or snooze, and **Settings** in four short groups.

![Automations](docs/screenshots/automations.png)

**On a phone.**

<p align="center"><img src="docs/screenshots/phone.png" alt="The dashboard on a phone" width="360"></p>

[docs/guide.md](docs/guide.md) walks through every screen.

### What each device can do

| Kind | Home Assistant | Matter | Tile |
| --- | --- | --- | --- |
| Lights, switches, fans | `light`, `switch`, `input_boolean`, `fan` | OnOff, LevelControl, FanControl | Icon, card, vertical slider, large |
| Thermostats | `climate` | Thermostat | Compact or large dial |
| Locks | `lock` | Door Lock | Lock and unlock, unlocking asks first |
| Garage doors, gates, blinds | `cover` | Window Covering | Open, close, stop, and a position slider for blinds; opening a garage, door, or gate asks first |
| Door, window, motion, leak, smoke | `binary_sensor` | Boolean State, Occupancy | Reading |
| Temperature, humidity, light, battery | `sensor` with a device class | Temperature, Humidity, Illuminance, Power Source | Reading; batteries start hidden |
| Doorbells and buttons | `event` | Switch events | Last ring, and a full-screen call on a new ring |
| Cameras | `camera` (streamed through Home Assistant) | Recognised, not streamed | Live view |
| Scenes and scripts | `scene`, `script`, `button` | | Run |

For safety, the assistant and scenes can lock doors and close garage doors and gates, but never unlock or open them; that stays a deliberate press and hold on its tile.

### Where your data lives

Hearth stores accounts, sessions, connections, cameras, layouts, and assistants in Postgres.

- **With Docker Compose**, a Postgres server runs beside Hearth (the `db` service) and Hearth connects to it automatically. This is the setup to use at home: Postgres recovers cleanly from crashes and power cuts.
- **With `npm run dev`**, Hearth runs [PGlite](https://pglite.dev), Postgres compiled to WebAssembly, inside the app, saving to `data/pglite`. Nothing to install, which makes it ideal for trying Hearth and for development. Stop it with Ctrl C so it can close the database cleanly; a process that is killed outright can leave PGlite unable to open its folder.
- **Set `DATABASE_URL`** to use any Postgres instead, such as [Neon](https://neon.tech) or [Supabase](https://supabase.com). Hearth creates its tables on the next start.

Passwords are hashed (scrypt) by Better Auth and never stored in readable form. Home Assistant tokens, camera passwords, and AI keys are encrypted with a key derived from `BETTER_AUTH_SECRET` before they reach the database, so a hosted database only ever sees ciphertext. Keep that secret on your server: lose it and the stored secrets cannot be decrypted.

To use Neon, create a project, copy the **pooled** connection string, and add it to `.env.local`:

```bash
DATABASE_URL=postgresql://user:password@ep-example-pooler.us-east-2.aws.neon.tech/hearth?sslmode=require
```

To use Supabase, open **Connect**, copy the **Transaction pooler** string (port 6543), and add it the same way. Restart Hearth after changing it. Switching starts with an empty database; there is no copy from the embedded one.

### On your phone

Phones need HTTPS to install Hearth and get alerts. Run `npm run dev:https`, trust the Hearth certificate once on each phone, and open the address it prints. [docs/https.md](docs/https.md) walks through iPhone and Android, and how to give an always-on Hearth a real address.

## Deploy to Vercel

Vercel needs a Postgres database (Neon from the Vercel Marketplace works), `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL`; until they are set, Hearth shows a setup screen listing what is missing. Alerts, automations, and sensor history need an always-on server, so they stay off there; Activity reads Home Assistant's logbook instead. [docs/vercel.md](docs/vercel.md) has the steps.

## How Hearth works with Home Assistant and Matter

Matter is a local standard: devices talk over your own network (Wi-Fi, Ethernet, or Thread), and the apps that control them are **controllers**. A controller pairs a device onto its **fabric**, a private set of credentials that lets it send commands. One device can belong to several fabrics at once (Apple Home, Google Home, and Home Assistant together), which Matter calls **multi-admin**.

Home Assistant does not speak Matter inside its own process. Its Matter integration talks to the **Matter Server** (the Matter Server add-on, built on matter.js since add-on 9.x) over a WebSocket on port 5580. The Matter Server is the real controller: it holds the fabric credentials and talks to devices. Home Assistant turns each Matter endpoint into an entity such as `light.desk_lamp`, `fan.bedroom`, or `climate.hallway`. Thread devices also need a Thread border router (a HomePod, a Nest hub, or the Home Assistant Connect ZBT-1 with the OpenThread Border Router add-on).

Hearth can reach those devices along two paths. Pick one per device.

![Two ways to reach Matter devices](docs/diagrams/matter.png)

**Path 1, through Home Assistant.** Hearth reads `/api/states` and calls services such as `light.turn_on` with a long-lived access token. It never speaks Matter itself; it sees Home Assistant entities. You get every device Home Assistant knows about, Matter or not (Zigbee, Z-Wave, Wi-Fi), with Home Assistant's names and areas.

**Path 2, straight to the Matter Server.** Hearth opens one WebSocket to the server, sends `start_listening`, and keeps the node list current from the events it pushes. It reads Matter clusters directly (OnOff, LevelControl, FanControl, Thermostat) and sends commands such as `MoveToLevelWithOnOff`. If you point it at the server Home Assistant's add-on runs, Hearth is using **the same controller and fabric** as Home Assistant: a device you pair from Hearth also shows up in Home Assistant, and the reverse. Matter has no notion of Home Assistant's areas, so these devices have no room. Without Home Assistant, run `ghcr.io/matter-js/matterjs-server:stable` in Docker and connect to it the same way.

If you connect both Home Assistant and its Matter Server, each Matter device appears twice. Hide one copy in **Edit**, or connect only one of them.

**Pairing.** **Pair device** sends the setup code to the Matter Server (`commission_with_code`). To add a device that already lives in Apple Home, Google Home, or Alexa, turn on pairing mode (sharing) in that app and use the code it shows; only the network is needed. A brand new, never paired device needs the Matter Server to have Bluetooth for the first handshake.

## Connecting your home

### Home Assistant

1. In Home Assistant, open your profile, then **Security**, then **Create token** under long-lived access tokens.
2. In Hearth, open **Settings**, choose **Add** under Connections, then **Home Assistant**, and paste the address (`http://homeassistant.local:8123`) and the token.

Hearth checks the connection before saving it and takes you back to the dashboard. Nothing is added for you: choose **Add tile**, pick a type such as **Lock** or **Camera**, and Hearth lists the matching devices from Home Assistant grouped by room, with their state. Entries Home Assistant files under settings or diagnostics (identify buttons, firmware entities, problem sensors) are listed last and marked. A placeholder tile links the same way: tap it and choose. Devices you add to Home Assistant later never appear on their own.

### Matter

- **Home Assistant OS**: open **Settings**, then **Apps** (called Add-ons before Home Assistant 2026.2), then **Matter Server**, then the **Configuration** tab. Under **Network**, choose **Show disabled ports**, enter `5580` for the WebSocket server port, save, and restart the app. Use `ws://<home-assistant-ip>:5580/ws` as the address.
- **Standalone**: run `ghcr.io/matter-js/matterjs-server:stable` with host networking.

### Cameras

1. Make sure go2rtc is running (the compose file starts it) and set its address under **Settings**, then **Stream relay**.
2. Add a camera with its RTSP address (for example `rtsp://192.168.1.20:554/stream1`), username, and password.

Home Assistant cameras need nothing extra: Home Assistant 2024.11 and later relay RTSP cameras over WebRTC with their built-in go2rtc, and Hearth asks for that stream. WebRTC needs the browser to reach Home Assistant on your network; away from home, or through a Tailscale Funnel, Hearth plays the same camera over HLS relayed through itself, and remembers that for next time.

### Departures

1. Sign up at [transit.land](https://www.transit.land/documentation#signing-up-for-an-api-key) for a free API key.
2. Add a **Departures** tile, paste the key once, and pick up to four stops. With the home's location set in **Automations**, the stops nearest home come first.

Hearth keeps the key encrypted and asks Transitland at most every 20 seconds per stop, however many screens show it. Set `TRANSITLAND_URL` to use a self-hosted [Transitland server](https://github.com/interline-io/transitland-server) instead.

### Photo frame

On the wall tablet, open **Settings**, then **Wall tablet**, and turn on **Show photos while resting**. Add photos from the tablet, or connect an Immich album: paste your Immich address, an API key with `album.read` and `asset.view`, and the album's address. Under **Clock over photos**, put the date, time, and weather in the lower left or the centre. Photos at night are optional; otherwise the screen rests on the clock alone.

### Calendars

1. Open Google Calendar on a computer, then **Settings**.
2. Under **Settings for my calendars**, choose the calendar, then **Integrate calendar**.
3. Copy **Secret address in iCal format**.
4. In Hearth, open **Settings**, choose **Add** under Calendars, paste it, and pick a colour. Then add a **Calendar** tile.

The secret address reads the calendar without signing in, so Hearth encrypts it like a password. iCloud and Outlook links that start with `webcal://` work too. Events refresh every five minutes, and recurring events, moved instances, and cancellations follow the feed.

### AI assistants

Open **Settings**, then **AI assistants**, and add a provider with your own API key. Hearth checks the key and the model with the provider before saving: a model named the way the provider's site shows it, such as "OpenAI GPT OSS 120B", is saved as its id (`openai/gpt-oss-120b`), and a Groq key added under Grok, or the reverse, goes to the right one. **Edit** changes the model or the key later. Usage is billed to your account with that provider.

| Provider | Default model | Key from |
| --- | --- | --- |
| Claude (Anthropic) | `claude-opus-5-5` | console.anthropic.com |
| ChatGPT (OpenAI) | `gpt-6.1-sol` | platform.openai.com |
| Grok (xAI) | `grok-4.3` | console.x.ai |
| Gemini (Google) | `gemini-3.8-flash` | aistudio.google.com |
| Muse (Meta) | `muse-spark-1.3` | dev.meta.ai |
| Groq | `openai/gpt-oss-120b` | console.groq.com |
| Custom | any | Ollama, LM Studio, vLLM, OpenRouter, or anything that speaks Chat Completions with tools |

You can change the model on each connection. For Claude, Hearth turns on Anthropic's server-side refusal fallback (`fallbacks: "default"`), so a declined request is retried on the model Anthropic recommends.

## How it works

The best way to learn this codebase is to follow one request end to end. Here is where each idea lives.

| Concept | Where |
| --- | --- |
| Pages and layouts (App Router) | `src/app` (route groups `(auth)` and `(app)` share layouts) |
| Signed-out redirect | `src/proxy.ts` (Next.js 16's name for middleware) |
| Session checks | `src/lib/session.ts`, used by every page, route, and action |
| Database (Postgres or embedded PGlite), schema, and migrations | `src/lib/db`, `drizzle/`, applied by `src/instrumentation.ts` at startup |
| Encrypting secrets | `src/lib/crypto.ts` |
| The device model every integration maps onto | `src/lib/devices/types.ts` |
| Home Assistant (REST) | `src/lib/integrations/home-assistant.ts` |
| Matter (WebSocket) | `src/lib/integrations/matter/` |
| Demo home | `src/lib/integrations/demo.ts` |
| Dashboard layout (sizes, order, icons, colours) | `src/lib/dashboard/layout.ts`, rendered by `src/components/dashboard/home-grid.tsx` |
| Tiles and the vertical slider | `src/components/dashboard/tiles` |
| Assistant (prompt, tools, provider adapters) | `src/lib/assistant`, UI in `src/components/assistant` |
| Scenes | `src/lib/scenes`, editor in `src/components/dashboard/scene-editor.tsx` |
| Server actions (forms) | `src/lib/actions.ts` |
| API routes (snapshot, live stream, commands, assistant) | `src/app/api` |
| Adding and linking tiles | `src/components/dashboard/tile-dialog.tsx`, `entity-chooser.tsx`, `tiles/placeholder-tile.tsx` |
| Weather, calendar, reminders, clock | `src/lib/widgets`, tiles in `src/components/dashboard/widgets` |
| Camera signalling (go2rtc) | `src/app/api/cameras/[id]/webrtc/route.ts` and `src/components/dashboard/camera-tile.tsx` |
| Camera signalling (Home Assistant) | `src/app/api/devices/[id]/camera/webrtc/route.ts` and `src/components/dashboard/integration-camera-tile.tsx` |
| Liquid glass surfaces and backgrounds | `src/components/glass`, picker in `src/components/shell/background-picker.tsx`, studio in `background-studio.tsx` |
| Pages and the search palette | `src/components/dashboard/page-tabs.tsx`, `src/components/shell/command-menu.tsx` |
| Household widgets and their items | `src/lib/widgets/items.ts`, `schedules.ts`, `src/lib/widget-actions.ts`, tiles in `src/components/dashboard/household` |
| The home monitor (history, activity, alerts, automations) | `src/lib/monitor`, started by `src/instrumentation.ts` |
| Automations | `src/lib/automations` (types, logic, sun times), UI in `src/components/automations` |
| Web Push alerts | `src/lib/push.ts`, `public/sw.js`, Settings in `src/components/connections/alerts-section.tsx` |
| Households, members, and guests | `src/lib/household.ts`, `src/lib/household-actions.ts`, `getHome` in `src/lib/session.ts` |
| Wall tablet and the installable app | `src/components/shell/wall-mode.tsx`, `src/app/manifest.ts`, `src/app/icons` |
| Timers, presets, and spoken timer requests | `src/lib/widgets/schedules.ts` (`applyTimerControl`, `parseTimerRequest`), `src/components/dashboard/household/timers-tile.tsx`, `timer-takeover.tsx` |
| Activity, merged with Home Assistant's logbook | `src/lib/activity-feed.ts`, `logbook` in `src/lib/integrations/home-assistant.ts` |
| Voice and the voice glow | `src/components/assistant/speech.ts`, `assistant-dock.tsx` ([voice-glow](https://libraries.dev)) |

### One provider interface, three integrations

Every integration implements the same three methods, plus optional ones for live updates and cameras (`src/lib/integrations/types.ts`):

```ts
interface Provider {
  check(): Promise<void>;
  listDevices(): Promise<DeviceList>;
  execute(nativeId: string, command: DeviceCommand): Promise<void>;
  subscribe?(onChange: () => void): () => void;
  camera?(nativeId: string, mode: "stream" | "snapshot", signal: AbortSignal): Promise<Response>;
  cameraWebRtc?(nativeId: string, offer: string): Promise<WebRtcAnswer>;
}
```

The dashboard and the assistant only know about `Device` and `DeviceCommand`. Adding an integration (Philips Hue, a Zigbee bridge, Shelly) means one more class that maps its API onto those types.

### The layout is data

A layout is an ordered list of tiles, `{ id, kind, link, size, icon, color, label, options }`. `kind` says what the tile is; `link` is the device, camera, or scene it shows, or null for a placeholder or a widget; `options` holds a weather place or the calendars to show. `resolveLayout` never adds tiles: it keeps their order, fixes sizes a kind cannot use, and upgrades layouts saved in the older one-tile-per-device shape. A tile whose device has gone shows as a placeholder to relink. The grid is CSS: row height equals column width (container query units), so every size lines up, and dense packing fills gaps.

### How the assistant decides what to do

Each request sends the model a short system prompt that lists every device (id, name, room, kind, and state) and one tool, `control_device`. The model calls the tool once per device. Hearth validates each call, runs it through the same path as a tile press, tells the model what happened, and shows the changes under the reply. The three API styles live in `src/lib/assistant/run.ts`:

- **Claude** through the official Anthropic SDK.
- **ChatGPT and Grok** through the Responses API, which OpenAI's current models need for tool calling.
- **Gemini, Muse, Groq, and custom servers** through Chat Completions. Gemini's assistant messages are sent back unchanged, because it rejects a tool turn that lost its thought signature; for the others only the role, text, and tool calls go back, because Groq refuses extra fields such as `reasoning`.

Voice input uses the browser's Web Speech API, and a spoken request gets a spoken reply.

### Cameras: why go2rtc

Browsers cannot play RTSP. go2rtc reads the camera and offers it as WebRTC. The browser creates an SDP offer, Hearth's server forwards it to go2rtc and returns the answer, and the video then flows straight from go2rtc to the browser. The camera password stays on the server.

Home Assistant cameras take the same shape over Home Assistant's WebSocket: Hearth checks `camera/capabilities`, sends `camera/webrtc/offer`, and returns the answer with the candidates that trickle in after it. The session lives as long as the player: it pings every 20 seconds, hangs up when the tile unmounts or the page closes, and the server closes anything silent for 45 seconds. Home Assistant's MJPEG proxy is only a fallback, because for RTSP cameras it rebuilds video from still frames and often stalls.

### The home monitor

Hearth runs one watcher for every home from the moment the server starts (`src/lib/monitor`), whether or not a dashboard is open. It subscribes to each integration's live updates (polling the few that cannot push), takes a fresh look whenever something changes or a command runs, and hands each look to four jobs: the recorder (readings every few minutes, kept 30 days), the activity log (what changed, credited to whoever sent the command), alerts (Web Push, sent once per event), and automations (device rules on each change, time and sun rules on a 30 second clock). With PGlite, `next dev`'s helper workers get their own in-memory database and skip the monitor, so the data folder is only ever opened by the server.

### Live updates

The dashboard does not poll. The browser opens one Server-Sent Events stream (`/api/home/stream`), and the server keeps a push connection to each integration for as long as someone is watching:

- **Home Assistant**: its WebSocket API (`/api/websocket`). Hearth authenticates with the same token, loads every state with `get_states`, subscribes to `state_changed`, and keeps an in-memory mirror, so a light switched from the Home Assistant app or a wall switch reaches the dashboard in a fraction of a second.
- **Matter Server**: the `attribute_updated` and `node_updated` events it already streams.
- **Demo home**: its own simulation.

Each push sends a fresh snapshot, throttled to a few per second, to every open dashboard. Changes made in Hearth (a tile press, the assistant, a new connection) publish too, so two open tabs or a wall tablet stay in sync. Taps still update instantly and roll back if a device refuses (`src/components/dashboard/use-home.ts`). If the stream drops, the browser reconnects on its own and polls every 15 seconds until it is back. The pieces are `src/lib/live/bus.ts`, `src/lib/integrations/home-assistant-live.ts`, and `src/app/api/home/stream/route.ts`.

## UI

- [Arc](https://uiarc.dev) components, installed with the shadcn CLI into `src/components/arc` (`components.json` registers the `@uiarc` registry). Install more with `npx shadcn@latest add @uiarc/<name>`.
- [React Bits](https://reactbits.dev) Glass Surface for the refractive navigation bar, in `src/components/reactbits`.
- [dnd-kit](https://dndkit.com) for dragging tiles, with keyboard support.
- [Motion](https://motion.dev) for animation, with a reduced motion branch everywhere.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` and `npm start` | Production build and server |
| `npm test` | Unit tests (Vitest): integration mappings, layout, assistant adapters, encryption, wire formats |
| `npm run lint` and `npm run typecheck` | ESLint and TypeScript |
| `npm run db:generate` | New migration after editing `src/lib/db/schema.ts` |

## Ideas to build next

Good exercises if you are learning with this project:

1. **A new integration**: Philips Hue's local API is a good first one.
2. **Energy**: chart power and energy sensors, with a daily total and a cost per kilowatt hour.
3. **Presence**: "everyone left" and "first one home" automations from phones' locations or a router's connected devices.
4. **Media**: a now-playing tile for Home Assistant media players, with volume and artwork.

## Limitations

- Hearth needs Home Assistant (or Matter) for devices; it does not talk to Zigbee or Z-Wave directly.
- Alerts, automations and sensor history need an always-on server. On Vercel they stay off and Activity reads Home Assistant's logbook instead.
- Cameras stream through go2rtc or Home Assistant; a camera neither can reach will not show.

## Contributing

Issues and pull requests are welcome. Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` before opening one. [AGENTS.md](AGENTS.md) describes the design rules the code follows.

## License

[MIT](LICENSE)
