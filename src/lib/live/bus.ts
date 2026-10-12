import { EventEmitter } from "node:events";

/**
 * In-process change notifications. Integrations publish `integration:<id>` when a device changes; settings
 * publish `user:<id>` when connections, cameras, or the layout change. Live streams listen and send a fresh
 * snapshot. One process serves Hearth, so no broker is needed.
 */
const registry = globalThis as unknown as { hearthBus?: EventEmitter };
const bus = registry.hearthBus ??= new EventEmitter().setMaxListeners(0);

export const integrationTopic = (integrationId: string) => `integration:${integrationId}`;
export const userTopic = (userId: string) => `user:${userId}`;

const ANY = "*";

export function publish(topic: string) {
  bus.emit(topic);
  bus.emit(ANY, topic);
}

/** Every topic as it is published, for the home monitor. */
export function listenAll(listener: (topic: string) => void) {
  bus.on(ANY, listener);
  return () => void bus.off(ANY, listener);
}

export function listen(topic: string, listener: () => void) {
  bus.on(topic, listener);
  return () => void bus.off(topic, listener);
}
