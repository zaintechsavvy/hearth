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

export function publish(topic: string) {
  bus.emit(topic);
}

export function listen(topic: string, listener: () => void) {
  bus.on(topic, listener);
  return () => void bus.off(topic, listener);
}
