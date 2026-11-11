import { deviceId, type Device } from "@/lib/devices/types";

/** The demo's music, which its speakers play through in turn. */
export const TRACKS = [
  { title: "Slow Tide", artist: "Harbor Lights", duration: 222, artwork: "/demo/covers/1.svg" },
  { title: "Paper Planes in June", artist: "Margo Vale", duration: 245, artwork: "/demo/covers/2.svg" },
  { title: "Night Bus", artist: "The Quiet Hours", duration: 198, artwork: "/demo/covers/3.svg" },
  { title: "Fieldnotes", artist: "Ada Rowe", duration: 176, artwork: "/demo/covers/4.svg" },
].map((track, index) => ({ ...track, media: { id: `demo:track:${index}`, type: "music" } }));

export const DEMO_CAN = { pause: true, seek: true, next: true, previous: true, volume: true, shuffle: true, repeat: true, group: true, play: true, queue: true };

export function seedDemoDevices(integrationId: string): Device[] {
  const base = (nativeId: string, name: string, room: string | null) => ({ id: deviceId(integrationId, nativeId), integrationId, name, room, available: true });
  return [
    { ...base("thermostat", "Living room", "Living room"), kind: "thermostat", unit: "C", current: 20.5, target: 22, min: 10, max: 30, step: 0.5, mode: "heat", modes: ["off", "heat", "cool", "auto", "dry", "fan"], action: "heating", humidity: 44, preset: "home", presets: ["home", "away", "eco", "sleep"], fanMode: "auto", fanModes: ["auto", "low", "medium", "high"] },
    { ...base("kitchen-pendants", "Pendants", "Kitchen"), kind: "light", on: true, dimmable: true, brightness: 80, supportsColor: true, color: { hue: 32, saturation: 70 }, colorMode: "color", temperatureRange: { min: 2000, max: 6500 }, temperature: null },
    { ...base("living-lamp", "Floor lamp", "Living room"), kind: "light", on: true, dimmable: true, brightness: 45, supportsColor: true, color: { hue: 40, saturation: 50 }, colorMode: "white", temperatureRange: { min: 2200, max: 5000 }, temperature: 2700 },
    { ...base("porch", "Porch light", "Outside"), kind: "light", on: false, dimmable: false, brightness: 0, supportsColor: false, color: null, colorMode: null, temperatureRange: null, temperature: null },
    { ...base("bedroom-fan", "Ceiling fan", "Bedroom"), kind: "fan", on: true, adjustable: true, speed: 40 },
    { ...base("coffee", "Coffee machine", "Kitchen"), kind: "switch", on: false },
    { ...base("office-plug", "Desk", "Office"), kind: "switch", on: true },
    { ...base("bedside", "Bedside lamp", "Bedroom"), kind: "light", on: false, dimmable: true, brightness: 0, supportsColor: true, color: { hue: 265, saturation: 55 }, colorMode: "color", temperatureRange: { min: 2000, max: 6500 }, temperature: null },
    { ...base("tv", "Television", "Living room"), kind: "switch", on: false },
    { ...base("front-lock", "Front door", "Entry"), kind: "lock", state: "locked" },
    { ...base("garage", "Garage door", "Garage"), kind: "cover", coverClass: "garage", state: "closed", position: 0, canStop: true, canSetPosition: false },
    { ...base("back-door", "Back door", "Kitchen"), kind: "binary_sensor", sensorClass: "door", active: false },
    { ...base("back-door-battery", "Back door battery", "Kitchen"), kind: "sensor", sensorClass: "battery", value: 82, unit: "%" },
    { ...base("hall-temp", "Hallway", "Entry"), kind: "sensor", sensorClass: "temperature", value: 21.4, unit: "°C" },
    { ...base("living-humidity", "Living room humidity", "Living room"), kind: "sensor", sensorClass: "humidity", value: 44, unit: "%" },
    { ...base("bedroom-temp", "Bedroom", "Bedroom"), kind: "sensor", sensorClass: "temperature", value: 19.8, unit: "°C" },
    { ...base("bedroom-window", "Bedroom window", "Bedroom"), kind: "binary_sensor", sensorClass: "window", active: true },
    { ...base("hall-motion", "Hallway motion", "Entry"), kind: "binary_sensor", sensorClass: "motion", active: false },
    { ...base("sink-leak", "Under the sink", "Kitchen"), kind: "binary_sensor", sensorClass: "leak", active: false },
    { ...base("home-power", "Home power", null), kind: "sensor", sensorClass: "power", value: 640, unit: "W" },
    { ...base("home-energy", "Home energy", null), kind: "sensor", sensorClass: "energy", value: 1214.4, unit: "kWh" },
    { ...base("washer-power", "Washer power", "Laundry"), kind: "sensor", sensorClass: "power", value: 0, unit: "W" },
    { ...base("fridge-power", "Fridge power", "Kitchen"), kind: "sensor", sensorClass: "power", value: 85, unit: "W" },
    { ...base("tv-power", "TV power", "Living room"), kind: "sensor", sensorClass: "power", value: 112, unit: "W" },
    { ...base("front-door-battery", "Front door lock battery", "Entry"), kind: "sensor", sensorClass: "battery", value: 18, unit: "%" },
    { ...base("hall-motion-battery", "Hallway motion battery", "Entry"), kind: "sensor", sensorClass: "battery", value: 64, unit: "%" },
    { ...base("garden-sensor", "Garden sensor", "Outside"), kind: "sensor", sensorClass: "temperature", value: null, unit: "°C", available: false },
    { ...base("alex", "Alex", null), kind: "person", home: true, place: null, picture: null, since: new Date(Date.now() - 2.5 * 3_600_000).toISOString(), battery: 72 },
    { ...base("sam", "Sam", null), kind: "person", home: false, place: "Work", picture: null, since: new Date(Date.now() - 4 * 3_600_000).toISOString(), battery: 41 },
    { ...base("vacuum", "Robot vacuum", "Living room"), kind: "vacuum", state: "docked", battery: 100, fanSpeed: "Standard", fanSpeeds: ["Quiet", "Standard", "Turbo", "Max"], can: { start: true, pause: true, stop: true, dock: true, locate: true, spot: true, areas: true } },
    { ...base("alarm", "Alarm", null), kind: "alarm", state: "disarmed", modes: ["home", "away", "night"], codeFormat: "number", codeToArm: false },
    { ...base("shopping", "Shopping list", null), kind: "todo", open: 3, can: { add: true, remove: true, check: true } },
    { ...base("doorbell", "Doorbell", "Entry"), kind: "event", eventClass: "doorbell", last: null },
    { ...base("front-camera", "Front door camera", "Entry"), kind: "camera", streamable: true },
    { ...base("backyard-camera", "Backyard", "Outside"), kind: "camera", streamable: true },
    { ...base("evening", "Evening", null), kind: "scene", variant: "scene" },
    {
      ...base("music", "Music", "Living room"), kind: "media_player", state: "playing", ...TRACKS[0], position: 52, positionAt: new Date().toISOString(),
      volume: 35, outputs: ["Living room speaker", "AirPods Pro", "Bose SoundLink Flex"], output: "Living room speaker", shuffle: false, repeat: "off", group: [],
      can: { ...DEMO_CAN, output: true },
    },
    {
      ...base("kitchen-speaker", "Kitchen speaker", "Kitchen"), kind: "media_player", state: "idle", title: null, artist: null, artwork: null, position: null, positionAt: null, duration: null,
      volume: 50, outputs: [], output: null, shuffle: false, repeat: "off", group: [], media: null,
      can: { ...DEMO_CAN, output: false },
    },
  ];
}
