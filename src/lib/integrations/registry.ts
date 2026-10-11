import "server-only";
import { unseal } from "@/lib/crypto";
import type { integration } from "@/lib/db/schema";
import { DemoProvider } from "./demo";
import { HomeAssistantProvider } from "./home-assistant";
import { MatterProvider } from "./matter/provider";
import type { IntegrationConfig, Provider } from "./types";

export type IntegrationRow = typeof integration.$inferSelect;

export function createProvider(row: IntegrationRow): Provider {
  const config = unseal<IntegrationConfig>(row.config);
  switch (config.kind) {
    case "home-assistant":
      return new HomeAssistantProvider(row.id, config);
    case "matter":
      return new MatterProvider(row.id, config);
    case "demo":
      return new DemoProvider(row.id);
  }
}

/** The non-secret part of a config, safe to send to the browser. */
export function publicConfig(row: IntegrationRow) {
  const config = unseal<IntegrationConfig>(row.config);
  return { address: config.kind === "demo" ? null : config.url };
}
