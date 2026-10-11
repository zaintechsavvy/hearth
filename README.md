# Hearth

A calm, self-hosted home dashboard. Hearth brings your thermostat, cameras, lights, fans, and Matter devices into one place, and talks to the Home Assistant you already run.

![Landing page](docs/screenshots/landing.png)

| Dashboard | Dark |
| --- | --- |
| ![Dashboard](docs/screenshots/dashboard.png) | ![Dashboard in dark mode](docs/screenshots/dashboard-dark.png) |

The thermostat glows warm from the top when you raise it and cool from the bottom when you lower it, and holds a softer glow while the system is actually heating or cooling.

| Raise | Lower |
| --- | --- |
| ![Thermostat warming](docs/screenshots/thermostat-warm.png) | ![Thermostat cooling](docs/screenshots/thermostat-cool.png) |

## What it does

- **Accounts**: email and password sign up and sign in ([Better Auth](https://better-auth.com)). Each person has their own connections, cameras, and layout.
- **Home Assistant**: lights (with brightness), switches, input booleans, fans (with speed), and climate entities over the REST API with a long-lived access token.
- **Matter**: connects straight to a Matter server (the one Home Assistant's Matter add-on runs, or a standalone one), lists and controls devices, and pairs new ones from a setup code.
- **Cameras**: RTSP cameras with a username and password, streamed to the browser over WebRTC through [go2rtc](https://github.com/AlexxIT/go2rtc). Falls back to refreshing snapshots when WebRTC cannot connect.
- **Demo home**: simulated devices so anyone can explore without hardware.
- **Security**: integration tokens and camera passwords are encrypted at rest (AES-256-GCM). The browser never sees them.

## Quick start

You need Node 24.

```bash
cp .env.example .env.local
# put a long random value in BETTER_AUTH_SECRET:  openssl rand -base64 32
npm install
npm run dev
```

Open http://localhost:3000, create an account, and choose **Open the demo home**. The database (`data/hearth.db`) and its tables are created on first start.

### Run it at home with Docker

```bash
cp .env.example .env      # set BETTER_AUTH_SECRET, and BETTER_AUTH_URL to the address you will open
docker compose up -d --build
```

This starts Hearth on port 3000 and go2rtc next to it. If you open Hearth from other devices by IP (for example `http://192.168.1.10:3000`), set that as `BETTER_AUTH_URL` or add it to `TRUSTED_ORIGINS`. Once everyone in your household has an account, set `DISABLE_SIGNUP=true`.

## Connecting your home

### Home Assistant

1. In Home Assistant, open your profile, then **Security**, then **Create token** under long-lived access tokens.
2. In Hearth, open **Connections**, choose **Add**, then **Home Assistant**, and paste the address (`http://homeassistant.local:8123`) and the token.

Hearth checks the connection before saving it.

### Matter

Hearth talks to a Matter server over WebSocket on port 5580.

- **Home Assistant OS**: install the **Matter Server** add-on, open its configuration, and expose port 5580. Use `ws://<home-assistant-ip>:5580/ws` as the address.
- **Standalone**: run `ghcr.io/matter-js/matterjs-server:stable` with host networking.

To control a device that is already in Apple Home, Google Home, or Alexa, open it in that app, turn on **pairing mode** (also called sharing or multi-admin), then use **Pair device** in Hearth with the code it shows. Brand new devices need a Matter server with Bluetooth access.

### Cameras

1. Make sure go2rtc is running (the compose file starts it) and set its address under **Connections**, then **Stream relay**.
2. Add a camera with its RTSP address (for example `rtsp://192.168.1.20:554/stream1`), username, and password.

The first two cameras appear on the dashboard.

## How it works

The best way to learn this codebase is to follow one request end to end. Here is where each idea lives.

| Concept | Where |
| --- | --- |
| Pages and layouts (App Router) | `src/app` (route groups `(auth)` and `(app)` share layouts) |
| Signed-out redirect | `src/proxy.ts` (Next.js 16's name for middleware) |
| Session checks | `src/lib/session.ts`, used by every page, route, and action |
| Database schema and migrations | `src/lib/db/schema.ts`, `drizzle/`, applied by `src/instrumentation.ts` at startup |
| Encrypting secrets | `src/lib/crypto.ts` |
| The device model every integration maps onto | `src/lib/devices/types.ts` |
| Home Assistant (REST) | `src/lib/integrations/home-assistant.ts` |
| Matter (WebSocket) | `src/lib/integrations/matter/` |
| Demo home | `src/lib/integrations/demo.ts` |
| Server actions (forms) | `src/lib/actions.ts` |
| API routes (polling and commands) | `src/app/api` |
| Camera signalling | `src/app/api/cameras/[id]/webrtc/route.ts` and `src/components/dashboard/camera-tile.tsx` |
| Liquid glass surfaces | `src/components/glass` |

### One provider interface, three integrations

Every integration implements the same three methods (`src/lib/integrations/types.ts`):

```ts
interface Provider {
  check(): Promise<void>;
  listDevices(): Promise<Device[]>;
  execute(nativeId: string, command: DeviceCommand): Promise<void>;
}
```

The dashboard only knows about `Device` and `DeviceCommand`. Adding a new integration (Philips Hue, a Zigbee bridge, Shelly) means writing one more class that maps its API onto those types.

### Home Assistant: request and response

`GET /api/states` returns every entity. Hearth keeps the ones it understands and turns, for example, `light.kitchen` with `brightness: 128` into `{ kind: "light", brightness: 50 }`. Turning it on is `POST /api/services/light/turn_on` with `{ "entity_id": "light.kitchen" }`.

### Matter: a long-lived WebSocket

The Matter server pushes changes instead of being polled. Hearth opens one connection per server, sends `start_listening` to receive every node, then applies `attribute_updated` events as they arrive, so reading devices never waits on the network. Attributes are addressed `endpoint/cluster/attribute`: `1/6/0` is the OnOff attribute of endpoint 1, and `1/513/18` is a thermostat's heating setpoint in hundredths of a degree.

### Cameras: why go2rtc

Browsers cannot play RTSP. go2rtc reads the camera and offers it as WebRTC. The browser creates an SDP offer, Hearth's server forwards it to go2rtc and returns the answer, and the video then flows straight from go2rtc to the browser. The camera password stays on the server.

### Polling with optimistic updates

The dashboard polls `/api/home` every four seconds with [SWR](https://swr.vercel.app). When you flip a switch, the UI updates immediately and rolls back if the device refuses (`src/components/dashboard/use-home.ts`).

## UI

- [Arc](https://uiarc.dev) components, installed with the shadcn CLI into `src/components/arc` (`components.json` registers the `@uiarc` registry). Install more with `npx shadcn@latest add @uiarc/<name>`.
- [React Bits](https://reactbits.dev) Glass Surface for the refractive navigation bar, in `src/components/reactbits`.
- [Motion](https://motion.dev) for animation, with a reduced motion branch everywhere.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` and `npm start` | Production build and server |
| `npm test` | Unit tests (Vitest) for the integration mappings, encryption, and wire formats |
| `npm run lint` and `npm run typecheck` | ESLint and TypeScript |
| `npm run db:generate` | New migration after editing `src/lib/db/schema.ts` |

## Ideas to build next

Good exercises if you are learning with this project:

1. **Live updates without polling**: subscribe to Home Assistant's WebSocket API (`/api/websocket`) on the server and stream changes to the browser with Server-Sent Events.
2. **Rooms**: read Home Assistant areas and group tiles by room.
3. **Scenes**: a button that sends several commands at once.
4. **Colour lights**: extend `LightDevice` with colour temperature and map it for Home Assistant and Matter (cluster 768).
5. **Household sharing**: let several accounts share one set of connections.
6. **A new integration**: Philips Hue's local API is a good first one.
