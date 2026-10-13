# Hearth

A calm, self-hosted home dashboard. Hearth brings your thermostat, cameras, lights, fans, and Matter devices into one grid you arrange yourself, talks to the Home Assistant you already run, and lets you change things by asking in plain words.

![Landing page](docs/screenshots/landing.png)

| Dashboard | Dark |
| --- | --- |
| ![Dashboard](docs/screenshots/dashboard.png) | ![Dashboard in dark mode](docs/screenshots/dashboard-dark.png) |

| Customize a tile | Ask the assistant |
| --- | --- |
| ![Customize dialog](docs/screenshots/customize.png) | ![Assistant panel](docs/screenshots/assistant.png) |

The thermostat glows warm from the top when you raise it and cool from the bottom when you lower it, and keeps a softer glow while the system is actually heating or cooling.

| Raise | Lower |
| --- | --- |
| ![Thermostat warming](docs/screenshots/thermostat-warm.png) | ![Thermostat cooling](docs/screenshots/thermostat-cool.png) |

## What it does

- **A dashboard you build.** It starts empty. Choose **Add tile** and pick what the tile is: a light, lock, garage door, camera, thermostat, doorbell, sensor, scene, weather, calendar, reminders, or a clock. Link it to a device straight away, or leave it as a placeholder ("Front door") and tap it later to link it. Tiles sit on square cells in sizes from 1×1 to 4×3; lights and fans have four templates: **Icon** (tap to switch), **Card** (name, room, status), **Slider** (a tall vertical brightness or speed control), and **Large** (details beside a slider). Choose **Edit** to drag, resize, relink, restyle, or remove tiles, or start from **Start with suggestions**. Filter by room.
- **Pages**: make pages such as Kitchen or Wall tablet, each with its own tiles. Swipe between them on a touch screen.
- **Everyday widgets**: weather for any city (Open-Meteo, no key needed), Google Calendar or any iCal feed, reminders, a clock, countdowns, and kitchen timers every screen hears.
- **Household widgets**: bin day (bins collected together share one card, a split week shows two), medications with doses to tick off and refill warnings, a sticky-note board, guest Wi-Fi with a QR code, and plants with watering meters.
- **Rename and re-room anything**: give any device or camera your own name and room, make new rooms, and reorder them. Home Assistant keeps its own names and areas.
- **Light colour**: colour and white temperature for lights that have them, from Home Assistant and Matter. Press and hold a light, or tap its swatch, for brightness, presets, and Arc's colour picker; lit tiles glow in the light's real colour.
- **Home Assistant** and **Matter**: lights, switches, fans, thermostats, locks, garage doors, gates, blinds and shades, door and window sensors, motion and leak sensors, temperature, humidity, light level and battery readings, doorbells and buttons, cameras, and Home Assistant scenes, scripts, and buttons. Rooms come from your Home Assistant areas. Anything Hearth cannot show yet is listed under the connection in Settings.
- **Scenes**: set your devices the way you want them, choose **New scene**, and Hearth saves their current state as one tap. Run scenes from their tile or ask the assistant.
- **Doorbell**: a ring shows a banner on every open dashboard and, with alerts on, a notification on your phone.
- **Search**: Cmd or Ctrl K finds any device, scene, page, or setting, and switches things straight from the search box.
- **Automations**: when, only if, then rules: a time, sunrise or sunset, or a device changing (or staying changed for some minutes); only after dark, between times, or while another device is in a state; then control devices, run scenes, or send an alert. Ready-made ideas fill in from your own devices.
- **Activity and alerts**: a log of what happened and who did it, kept 60 days, and Web Push alerts for the doorbell, leaks and smoke, doors left open, jammed locks, timers, and doses.
- **History**: temperature and other readings as a line on their tile, and day, week, and month charts with the low, average, and high.
- **Wall tablet mode**: install Hearth as an app, keep the screen awake, dim it at night, rest on a drifting clock with what is next, and wake on a touch or a motion sensor.
- **Household**: invite members, who share everything, and guests, who see only the pages you pick and can never unlock or open anything.
- **Cameras**: Home Assistant cameras over WebRTC, the way Home Assistant's own app plays them, falling back to HLS relayed through Hearth, then MJPEG, then the last picture, and saying which. "Live" only appears once a frame has actually played. RTSP cameras with a username and password stream through [go2rtc](https://github.com/AlexxIT/go2rtc). Every camera has full screen and a snapshot download.
- **Assistant**: a pill in the corner (or Cmd or Ctrl J) opens a chat. Type or say "turn on the fan in my bedroom". Bring your own key for Claude, ChatGPT, Grok, Gemini, Muse, or Groq, or point it at a model you run yourself.
- **Accounts**: email and password sign up and sign in. Each home has its own connections, cameras, pages, and assistants, shared with the people invited into it.
- **Look**: liquid glass surfaces over a still backdrop (Studio, Linen, Slate), a slowly moving [Paper Shaders](https://shaders.paper.design) mesh gradient (Aurora, Dusk, Meadow), a gradient of your own, or your own photo, light and dark, and eight accents. The Background studio picks colours with Arc's colour picker, shuffles harmonious palettes, tunes motion, swirl, and grain, blurs and dims photos, and can turn any photo into a moving gradient from its own colours. Moving backgrounds hold still when reduced motion is on.
- **Security**: integration tokens, camera passwords, calendar addresses, and AI keys are encrypted at rest (AES-256-GCM) and never sent to the browser. Unlocking a door or opening a garage door takes a press and hold.

![Welcome](docs/screenshots/welcome.png)

## Quick start

You need Node 24.

```bash
cp .env.example .env.local
# put a long random value in BETTER_AUTH_SECRET:  openssl rand -base64 32
npm install
npm run dev
```

Open http://localhost:3000, create an account, and choose **Open the demo home**. The database and its tables are created on first start.

### What each device can do

| Kind | Home Assistant | Matter | Tile |
| --- | --- | --- | --- |
| Lights, switches, fans | `light`, `switch`, `input_boolean`, `fan` | OnOff, LevelControl, FanControl | Icon, card, vertical slider, large |
| Thermostats | `climate` | Thermostat | Compact or large dial |
| Locks | `lock` | Door Lock | Lock and unlock, unlocking asks first |
| Garage doors, gates, blinds | `cover` | Window Covering | Open, close, stop, and a position slider for blinds; opening a garage, door, or gate asks first |
| Door, window, motion, leak, smoke | `binary_sensor` | Boolean State, Occupancy | Reading |
| Temperature, humidity, light, battery | `sensor` with a device class | Temperature, Humidity, Illuminance, Power Source | Reading; batteries start hidden |
| Doorbells and buttons | `event` | Switch events | Last ring, and a banner on a new ring |
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

### Run it at home with Docker

```bash
cp .env.example .env      # set BETTER_AUTH_SECRET, and BETTER_AUTH_URL to the address you will open
docker compose up -d --build
```

This starts Hearth on port 3000 and go2rtc next to it. If you open Hearth from other devices by IP (for example `http://192.168.1.10:3000`), set that as `BETTER_AUTH_URL` or add it to `TRUSTED_ORIGINS`. Once everyone in your household has an account, set `DISABLE_SIGNUP=true`.

## How Hearth works with Home Assistant and Matter

Matter is a local standard: devices talk over your own network (Wi-Fi, Ethernet, or Thread), and the apps that control them are **controllers**. A controller pairs a device onto its **fabric**, a private set of credentials that lets it send commands. One device can belong to several fabrics at once (Apple Home, Google Home, and Home Assistant together), which Matter calls **multi-admin**.

Home Assistant does not speak Matter inside its own process. Its Matter integration talks to the **Matter Server** (the Matter Server add-on, built on matter.js since add-on 9.x) over a WebSocket on port 5580. The Matter Server is the real controller: it holds the fabric credentials and talks to devices. Home Assistant turns each Matter endpoint into an entity such as `light.desk_lamp`, `fan.bedroom`, or `climate.hallway`. Thread devices also need a Thread border router (a HomePod, a Nest hub, or the Home Assistant Connect ZBT-1 with the OpenThread Border Router add-on).

Hearth can reach those devices along two paths. Pick one per device.

```
1. Through Home Assistant (recommended if you run it)
   Hearth ──REST + token──▶ Home Assistant ──▶ Matter integration ──WebSocket──▶ Matter Server ──▶ device

2. Straight to the Matter Server
   Hearth ──WebSocket :5580──────────────────────────────────────────────────▶ Matter Server ──▶ device
```

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

Home Assistant cameras need nothing extra: Home Assistant 2024.11 and later relay RTSP cameras over WebRTC with their built-in go2rtc, and Hearth asks for that stream. The browser must be able to reach Home Assistant on your network for the video itself.

### Calendars

1. Open Google Calendar on a computer, then **Settings**.
2. Under **Settings for my calendars**, choose the calendar, then **Integrate calendar**.
3. Copy **Secret address in iCal format**.
4. In Hearth, open **Settings**, choose **Add** under Calendars, paste it, and pick a colour. Then add a **Calendar** tile.

The secret address reads the calendar without signing in, so Hearth encrypts it like a password. iCloud and Outlook links that start with `webcal://` work too. Events refresh every five minutes, and recurring events, moved instances, and cancellations follow the feed.

### AI assistants

Open **Settings**, then **AI assistants**, and add a provider with your own API key. Hearth checks the key with the provider before saving it. Usage is billed to your account with that provider.

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
- **Gemini, Muse, Groq, and custom servers** through Chat Completions. Assistant messages are sent back unchanged, because Gemini rejects a tool turn that lost its thought signature.

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
