import {
  clamp, deviceId, type BinarySensorClass, type CoverClass, type CoverState, type Device, type DeviceCommand, type EventClass, type LockState, type SceneVariant, type SensorClass, type TemperatureUnit, type ThermostatAction, type ThermostatMode, type MediaPlayerDevice, type MediaState,
} from "@/lib/devices/types";
import { HomeAssistantCommandError, homeAssistantLive, type HomeAssistantLive } from "./home-assistant-live";
import { unreachableMessage } from "./reach";
import { IntegrationError, WebRtcUnsupportedError, countBy, type DeviceList, type HistoryPoint, type IceCandidate, type IceServer, type Provider, type WebRtcAnswer } from "./types";

export interface HassState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

interface HassConfig {
  unit_system?: { temperature?: string };
}

type HassWebRtcEvent =
  | { type: "session"; session_id: string }
  | { type: "answer"; answer: string }
  | { type: "candidate"; candidate: IceCandidate }
  | { type: "error"; code?: string; message?: string };

const WEBRTC_ANSWER_MS = 10_000;
const WEBRTC_GATHER_MS = 1500;
const WEBRTC_QUIET_MS = 250;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const FAN_SET_SPEED = 1;
const COLOR_MODES = new Set(["hs", "xy", "rgb", "rgbw", "rgbww"]);
const COVER = { open: 1, close: 2, setPosition: 4, stop: 8 };

const HVAC_TO_MODE: Record<string, ThermostatMode> = { off: "off", heat: "heat", cool: "cool", heat_cool: "auto", auto: "auto" };
const ACTIONS: Record<string, ThermostatAction> = { heating: "heating", preheating: "heating", cooling: "cooling", idle: "idle", off: "off" };
const LOCK_STATES: Record<string, LockState> = { locked: "locked", unlocked: "unlocked", locking: "locking", unlocking: "unlocking", jammed: "jammed", open: "open", opening: "unlocking" };
const COVER_CLASSES: Record<string, CoverClass> = { garage: "garage", door: "door", gate: "gate", blind: "blind", shutter: "blind", awning: "blind", shade: "shade", curtain: "curtain", window: "window" };
const COVER_STATES: Record<string, CoverState> = { open: "open", closed: "closed", opening: "opening", closing: "closing", stopped: "stopped" };
const BINARY_CLASSES: Record<string, BinarySensorClass> = {
  door: "door", window: "window", garage_door: "garage", opening: "opening", motion: "motion", occupancy: "occupancy", presence: "occupancy",
  moisture: "leak", smoke: "smoke", gas: "smoke", carbon_monoxide: "smoke",
};
const SENSOR_CLASSES: Record<string, SensorClass> = {
  temperature: "temperature", humidity: "humidity", battery: "battery", illuminance: "illuminance", power: "power", energy: "energy",
  carbon_dioxide: "co2", pm25: "pm25",
};
const EVENT_CLASSES: Record<string, EventClass> = { doorbell: "doorbell", button: "button", motion: "motion" };
const SCENE_DOMAINS: Record<string, SceneVariant> = { scene: "scene", script: "script", button: "button", input_button: "button" };

/** Areas are not in the REST state objects; a template renders `entity_id<TAB>area` for every entity in one request. */
const AREA_TEMPLATE = "{% for s in states %}{{ s.entity_id }}\t{{ area_name(s.entity_id) or '' }}\n{% endfor %}";

export function parseAreas(rendered: string) {
  const areas = new Map<string, string>();
  for (const line of rendered.split("\n")) {
    const [entityId, area] = line.split("\t");
    if (entityId && area?.trim()) areas.set(entityId.trim(), area.trim());
  }
  return areas;
}

const num = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const str = (value: unknown) => typeof value === "string" ? value : null;
const timestamp = (value: string) => Number.isNaN(Date.parse(value)) ? null : value;

export function mapHassState(integrationId: string, entity: HassState, unit: TemperatureUnit, room: string | null = null): Device | null {
  const domain = entity.entity_id.split(".")[0];
  const { attributes } = entity;
  const deviceClass = str(attributes.device_class);
  const base = {
    id: deviceId(integrationId, entity.entity_id),
    integrationId,
    name: str(attributes.friendly_name) ?? entity.entity_id,
    room,
    available: entity.state !== "unavailable",
  };
  const on = entity.state === "on";
  const features = num(attributes.supported_features) ?? 0;

  switch (domain) {
    case "light": {
      const colorModes = Array.isArray(attributes.supported_color_modes) ? attributes.supported_color_modes : [];
      const dimmable = colorModes.some(mode => mode !== "onoff");
      const brightness = num(attributes.brightness);
      const supportsColor = colorModes.some(mode => COLOR_MODES.has(mode));
      const hs = Array.isArray(attributes.hs_color) ? attributes.hs_color : null;
      const min = num(attributes.min_color_temp_kelvin), max = num(attributes.max_color_temp_kelvin);
      const temperatureRange = colorModes.includes("color_temp") && min !== null && max !== null ? { min, max } : null;
      const mode = str(attributes.color_mode);
      return {
        ...base, kind: "light", on, dimmable, brightness: on && brightness !== null ? Math.round(brightness / 255 * 100) : 0,
        supportsColor,
        color: supportsColor && hs && num(hs[0]) !== null && num(hs[1]) !== null ? { hue: Math.round(hs[0]), saturation: Math.round(hs[1]) } : null,
        colorMode: mode === "color_temp" ? "white" : mode && COLOR_MODES.has(mode) ? "color" : null,
        temperatureRange,
        temperature: temperatureRange ? num(attributes.color_temp_kelvin) : null,
      };
    }
    case "switch":
    case "input_boolean":
      return { ...base, kind: "switch", on };
    case "fan":
      return { ...base, kind: "fan", on, adjustable: (features & FAN_SET_SPEED) !== 0, speed: on ? num(attributes.percentage) ?? 100 : 0 };
    case "climate": {
      const hvacModes = Array.isArray(attributes.hvac_modes) ? attributes.hvac_modes.map(String) : [];
      const modes = [...new Set(hvacModes.map(mode => HVAC_TO_MODE[mode]).filter(Boolean))];
      const low = num(attributes.target_temp_low), high = num(attributes.target_temp_high);
      const step = num(attributes.target_temp_step) ?? (unit === "F" ? 1 : 0.5);
      const target = num(attributes.temperature) ?? (low !== null && high !== null ? roundTo((low + high) / 2, step) : null);
      return {
        ...base,
        kind: "thermostat",
        unit,
        current: num(attributes.current_temperature),
        target,
        min: num(attributes.min_temp) ?? (unit === "F" ? 45 : 7),
        max: num(attributes.max_temp) ?? (unit === "F" ? 95 : 35),
        step,
        mode: HVAC_TO_MODE[entity.state] ?? "off",
        modes: modes.length ? modes : ["off", "heat"],
        action: typeof attributes.hvac_action === "string" ? ACTIONS[attributes.hvac_action] ?? "idle" : null,
      };
    }
    case "lock":
      return { ...base, kind: "lock", state: LOCK_STATES[entity.state] ?? "unknown" };
    case "cover":
      return {
        ...base,
        kind: "cover",
        coverClass: COVER_CLASSES[deviceClass ?? ""] ?? "other",
        state: COVER_STATES[entity.state] ?? "unknown",
        position: num(attributes.current_position),
        canStop: (features & COVER.stop) !== 0,
        canSetPosition: (features & COVER.setPosition) !== 0,
      };
    case "binary_sensor":
      return { ...base, kind: "binary_sensor", sensorClass: BINARY_CLASSES[deviceClass ?? ""] ?? "other", active: on };
    case "sensor": {
      const sensorClass = SENSOR_CLASSES[deviceClass ?? ""];
      if (!sensorClass) return null;
      const value = Number.parseFloat(entity.state);
      return { ...base, kind: "sensor", sensorClass, value: Number.isFinite(value) ? value : null, unit: str(attributes.unit_of_measurement) };
    }
    case "camera":
      return { ...base, kind: "camera", streamable: true };
    case "media_player":
      return mapMediaPlayer(base, entity, features);
    case "event":
      return { ...base, kind: "event", eventClass: EVENT_CLASSES[deviceClass ?? ""] ?? "other", last: timestamp(entity.state) };
    default: {
      const variant = SCENE_DOMAINS[domain];
      return variant ? { ...base, kind: "scene", variant, available: true } : null;
    }
  }
}

/** Home Assistant's `MediaPlayerEntityFeature` bits that Hearth uses. */
const MEDIA = { pause: 1, seek: 2, volume: 4, previous: 16, next: 32, output: 2048 } as const;
const MEDIA_STATES: Record<string, MediaState> = { playing: "playing", buffering: "playing", paused: "paused", on: "idle", idle: "idle", standby: "idle", off: "off" };

/** A short key for a cover picture, so its address changes with the track and the browser can cache it. */
export function artworkKey(picture: string) {
  const cache = picture.match(/[?&]cache=([^&]+)/)?.[1];
  if (cache) return cache;
  let hash = 0;
  for (const char of picture) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return (hash >>> 0).toString(36);
}

function mapMediaPlayer(base: Pick<MediaPlayerDevice, "id" | "integrationId" | "name" | "room" | "available">, entity: HassState, features: number): MediaPlayerDevice {
  const { attributes } = entity;
  const picture = str(attributes.entity_picture);
  const outputs = Array.isArray(attributes.source_list) ? attributes.source_list.filter((item): item is string => typeof item === "string") : [];
  const level = num(attributes.volume_level);
  const has = (bit: number) => (features & bit) === bit;
  return {
    ...base,
    kind: "media_player",
    state: MEDIA_STATES[entity.state] ?? "idle",
    title: str(attributes.media_title),
    artist: str(attributes.media_artist) ?? str(attributes.media_album_name) ?? str(attributes.app_name),
    artwork: picture ? `/api/devices/${encodeURIComponent(base.id)}/artwork?v=${artworkKey(picture)}` : null,
    position: num(attributes.media_position),
    positionAt: str(attributes.media_position_updated_at),
    duration: num(attributes.media_duration),
    volume: level === null ? null : Math.round(level * 100),
    outputs,
    output: str(attributes.source),
    can: { pause: has(MEDIA.pause), seek: has(MEDIA.seek), next: has(MEDIA.next), previous: has(MEDIA.previous), volume: has(MEDIA.volume) && level !== null, output: has(MEDIA.output) && outputs.length > 0 },
  };
}

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

export class HomeAssistantProvider implements Provider {
  private readonly base: URL;
  private readonly token: string;
  private readonly live: HomeAssistantLive;
  private static readonly areaCache = new Map<string, { at: number; areas: Map<string, string> }>();

  constructor(private readonly integrationId: string, config: { url: string; token: string }) {
    this.base = new URL(config.url.endsWith("/") ? config.url : `${config.url}/`);
    this.token = config.token;
    this.live = homeAssistantLive(this.base.toString(), this.token, integrationId);
  }

  subscribe(onChange: () => void) {
    return this.live.subscribe(onChange);
  }

  /** Areas change rarely and cost a template render, so they are cached for a few minutes. */
  private async areas() {
    const cached = HomeAssistantProvider.areaCache.get(this.integrationId);
    if (cached && Date.now() - cached.at < 300_000) return cached.areas;
    const areas = await this.request<string>("api/template", { method: "POST", body: JSON.stringify({ template: AREA_TEMPLATE }) }, "text").then(parseAreas, () => new Map<string, string>());
    HomeAssistantProvider.areaCache.set(this.integrationId, { at: Date.now(), areas });
    return areas;
  }

  private async request<T>(path: string, init?: RequestInit, parse: "json" | "text" = "json"): Promise<T> {
    let response: Response;
    try {
      response = await fetch(new URL(path, this.base), {
        ...init,
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      });
    } catch {
      throw new IntegrationError(unreachableMessage("Home Assistant", this.base));
    }
    if (response.status === 401) throw new IntegrationError("Home Assistant rejected the access token.");
    if (!response.ok) throw new IntegrationError(`Home Assistant answered with ${response.status} ${response.statusText}.`);
    return (parse === "json" ? response.json() : response.text()) as Promise<T>;
  }

  async check() {
    await this.request("api/");
  }

  async listDevices() {
    const mirrored = this.live.snapshot();
    const [unit, states, areas] = mirrored
      ? [this.live.unit, mirrored, await this.areas()] as const
      : await Promise.all([
        this.request<HassConfig>("api/config").then((config): TemperatureUnit => config.unit_system?.temperature === "°F" ? "F" : "C"),
        this.request<HassState[]>("api/states"),
        this.areas(),
      ]);
    const devices: Device[] = [];
    const skipped: string[] = [];
    for (const state of states) {
      const device = mapHassState(this.integrationId, state, unit, areas.get(state.entity_id) ?? null);
      if (!device) skipped.push(state.entity_id.split(".")[0]);
      else devices.push(this.live.auxiliary.has(state.entity_id) ? { ...device, auxiliary: true } : device);
    }
    return { devices, unsupported: countBy(skipped) } satisfies DeviceList;
  }

  /** Home Assistant already turns every camera it knows into MJPEG and JPEG, whatever the camera speaks. */
  async camera(entityId: string, mode: "stream" | "snapshot", signal: AbortSignal) {
    if (!entityId.startsWith("camera.")) throw new IntegrationError("That device is not a camera.");
    try {
      return await fetch(new URL(`api/${mode === "stream" ? "camera_proxy_stream" : "camera_proxy"}/${entityId}`, this.base), {
        headers: { Authorization: `Bearer ${this.token}` },
        cache: "no-store",
        signal,
      });
    } catch {
      throw new IntegrationError(unreachableMessage("Home Assistant", this.base));
    }
  }

  /**
   * WebRTC the way Home Assistant's own frontend plays cameras: its built-in go2rtc answers the offer, so RTSP
   * cameras stream with sub-second latency instead of being rebuilt as MJPEG from stills. Candidates that arrive
   * shortly after the answer are collected and returned with it.
   */
  async cameraWebRtc(entityId: string, offer: string): Promise<WebRtcAnswer> {
    if (!entityId.startsWith("camera.")) throw new IntegrationError("That device is not a camera.");
    const capabilities = await this.live.request<{ frontend_stream_types?: string[] }>({ type: "camera/capabilities", entity_id: entityId }).catch(() => null);
    if (capabilities && !capabilities.result.frontend_stream_types?.includes("web_rtc")) throw new WebRtcUnsupportedError("This camera does not offer WebRTC in Home Assistant.");

    const candidates: IceCandidate[] = [];
    let lastCandidateAt = 0;
    let answered: (sdp: string) => void = () => {};
    let failed: (error: Error) => void = () => {};
    const answer = new Promise<string>((resolve, reject) => { answered = resolve; failed = reject; });
    const onEvent = (raw: unknown) => {
      const event = raw as HassWebRtcEvent;
      if (event.type === "answer") answered(event.answer);
      else if (event.type === "candidate") {
        candidates.push(event.candidate);
        lastCandidateAt = Date.now();
      } else if (event.type === "error") failed(new IntegrationError(event.message ?? "Home Assistant could not start the stream."));
    };

    let session;
    try {
      session = await this.live.request({ type: "camera/webrtc/offer", entity_id: entityId, offer }, onEvent);
    } catch (error) {
      if (!(error instanceof HomeAssistantCommandError) || error.code !== "unknown_command") throw error;
      const legacy = await this.live.request<{ answer: string }>({ type: "camera/web_rtc_offer", entity_id: entityId, offer });
      return { answer: legacy.result.answer, candidates: [], close: () => {} };
    }
    try {
      const sdp = await Promise.race([answer, sleep(WEBRTC_ANSWER_MS).then(() => { throw new IntegrationError("The camera did not answer in time."); })]);
      const started = Date.now();
      while (Date.now() - started < WEBRTC_GATHER_MS && !(Date.now() - Math.max(lastCandidateAt, started) > WEBRTC_QUIET_MS && (candidates.length > 0 || sdp.includes("a=candidate")))) await sleep(50);
      return { answer: sdp, candidates, close: session.close };
    } catch (error) {
      session.close();
      throw error;
    }
  }

  /** Whether the camera offers WebRTC, and the STUN and TURN servers Home Assistant hands its own frontend for it. */
  async cameraWebRtcConfig(entityId: string) {
    const [capabilities, config] = await Promise.all([
      this.live.request<{ frontend_stream_types?: string[] }>({ type: "camera/capabilities", entity_id: entityId }).catch(() => null),
      this.live.request<{ configuration?: { iceServers?: IceServer[] } }>({ type: "camera/webrtc/get_client_config", entity_id: entityId }).catch(() => null),
    ]);
    return {
      supported: !capabilities || Boolean(capabilities.result.frontend_stream_types?.includes("web_rtc")),
      iceServers: config?.result.configuration?.iceServers ?? [],
    };
  }

  /** Home Assistant's recorder: sensor states as numbers, and a thermostat's room temperature from its attributes. */
  async history(entityId: string, from: Date, to: Date): Promise<HistoryPoint[] | null> {
    const climate = entityId.startsWith("climate.");
    if (!climate && !entityId.startsWith("sensor.")) return null;
    const params = new URLSearchParams({ filter_entity_id: entityId, end_time: to.toISOString() });
    if (!climate) {
      params.set("minimal_response", "");
      params.set("no_attributes", "");
    }
    const rows = await this.request<{ state: string; last_changed?: string; last_updated?: string; attributes?: Record<string, unknown> }[][]>(`api/history/period/${from.toISOString()}?${params}`);
    return (rows[0] ?? []).flatMap(entry => {
      const value = climate ? num(entry.attributes?.current_temperature) : Number.parseFloat(entry.state);
      const t = Date.parse(entry.last_changed ?? entry.last_updated ?? "");
      return Number.isFinite(value) && value !== null && Number.isFinite(t) ? [{ t, v: value }] : [];
    });
  }

  /** HLS through Home Assistant's stream integration: slower to start than WebRTC, but it only needs plain HTTP, which Hearth relays. */
  async cameraHls(entityId: string) {
    if (!entityId.startsWith("camera.")) throw new IntegrationError("That device is not a camera.");
    const stream = await this.live.request<{ url: string }>({ type: "camera/stream", entity_id: entityId, format: "hls" }).catch(error => {
      throw new IntegrationError(error instanceof Error ? `Home Assistant could not start a stream: ${error.message}` : "Home Assistant could not start a stream.");
    });
    if (!stream.result.url.startsWith("/api/hls/")) throw new IntegrationError("Home Assistant returned an unexpected stream address.");
    return stream.result.url;
  }

  /** The cover of what a media player is playing. Home Assistant proxies it, and remote covers are fetched as they are. */
  async artwork(entityId: string, signal: AbortSignal) {
    if (!entityId.startsWith("media_player.")) throw new IntegrationError("That device is not a media player.");
    const picture = str((await this.request<HassState>(`api/states/${entityId}`)).attributes.entity_picture);
    if (!picture) throw new IntegrationError("Nothing is playing.");
    const remote = /^https?:\/\//i.test(picture);
    try {
      return await fetch(remote ? picture : new URL(picture.replace(/^\//, ""), this.base), {
        headers: remote ? undefined : { Authorization: `Bearer ${this.token}` },
        cache: "no-store",
        signal,
      });
    } catch {
      throw new IntegrationError(unreachableMessage("Home Assistant", this.base));
    }
  }

  async cameraHlsFetch(path: string, search: string, signal: AbortSignal) {
    if (!path.startsWith("/api/hls/")) throw new IntegrationError("Not a stream address.");
    try {
      return await fetch(new URL(`${path.slice(1)}${search}`, this.base), { cache: "no-store", signal });
    } catch {
      throw new IntegrationError(unreachableMessage("Home Assistant", this.base));
    }
  }

  private call(domain: string, service: string, data: Record<string, unknown>) {
    return this.request(`api/services/${domain}/${service}`, { method: "POST", body: JSON.stringify(data) });
  }

  async execute(entityId: string, command: DeviceCommand) {
    const domain = entityId.split(".")[0];
    const target = { entity_id: entityId };
    switch (command.type) {
      case "power":
        if (domain === "climate") {
          const entity = await this.request<HassState>(`api/states/${entityId}`);
          const modes = (entity.attributes.hvac_modes as string[] | undefined) ?? [];
          return void await this.call("climate", "set_hvac_mode", { ...target, hvac_mode: command.on ? modes.find(mode => mode !== "off") ?? "heat" : "off" });
        }
        return void await this.call(domain === "light" ? "light" : "homeassistant", command.on ? "turn_on" : "turn_off", target);
      case "brightness":
        return void await (command.value <= 0
          ? this.call("light", "turn_off", target)
          : this.call("light", "turn_on", { ...target, brightness_pct: clamp(Math.round(command.value), 1, 100) }));
      case "color":
        return void await this.call("light", "turn_on", { ...target, hs_color: [command.hue, command.saturation] });
      case "temperature":
        return void await this.call("light", "turn_on", { ...target, color_temp_kelvin: Math.round(command.kelvin) });
      case "fanSpeed":
        return void await this.call("fan", "set_percentage", { ...target, percentage: clamp(Math.round(command.value), 0, 100) });
      case "targetTemperature":
        return void await this.setTemperature(entityId, command.value);
      case "thermostatMode": {
        const entity = await this.request<HassState>(`api/states/${entityId}`);
        const modes = (entity.attributes.hvac_modes as string[] | undefined) ?? [];
        const hvacMode = command.mode === "auto" ? modes.find(mode => mode === "heat_cool") ?? "auto" : command.mode;
        return void await this.call("climate", "set_hvac_mode", { ...target, hvac_mode: hvacMode });
      }
      case "lock":
        return void await this.call("lock", command.locked ? "lock" : "unlock", target);
      case "cover":
        return void await this.call("cover", `${command.action}_cover`, target);
      case "coverPosition":
        return void await this.call("cover", "set_cover_position", { ...target, position: clamp(Math.round(command.value), 0, 100) });
      case "activate":
        return void await this.call(domain, domain === "button" || domain === "input_button" ? "press" : "turn_on", target);
      case "media":
        return void await this.call("media_player", { play: "media_play", pause: "media_pause", next: "media_next_track", previous: "media_previous_track" }[command.action], target);
      case "seek":
        return void await this.call("media_player", "media_seek", { ...target, seek_position: Math.max(0, command.position) });
      case "volume":
        return void await this.call("media_player", "volume_set", { ...target, volume_level: clamp(command.value, 0, 100) / 100 });
      case "output":
        return void await this.call("media_player", "select_source", { ...target, source: command.output });
    }
  }

  /** Range thermostats keep their spread: both setpoints move by the same amount. */
  private async setTemperature(entityId: string, value: number) {
    const { attributes } = await this.request<HassState>(`api/states/${entityId}`);
    const low = num(attributes.target_temp_low), high = num(attributes.target_temp_high);
    if (num(attributes.temperature) === null && low !== null && high !== null) {
      const shift = value - (low + high) / 2;
      return this.call("climate", "set_temperature", { entity_id: entityId, target_temp_low: low + shift, target_temp_high: high + shift });
    }
    return this.call("climate", "set_temperature", { entity_id: entityId, temperature: value });
  }
}
