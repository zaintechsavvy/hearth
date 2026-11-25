import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { integration } from "@/lib/db/schema";
import { deviceId } from "@/lib/devices/types";
import type { SpeakerWake } from "@/lib/devices/speakers";
import { createProvider } from "@/lib/integrations/registry";
import { spotifyDeviceNames } from "./client";

const ASK_MS = 6000;
const inTime = <T,>(work: Promise<T>) => Promise.race([work, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timed out")), ASK_MS))]);

/**
 * What Hearth knows about getting Spotify onto the home's speakers: what Spotify Connect lists now, and for each
 * integration how it wakes idle Google Cast speakers and which those are. One that does not answer is left out.
 */
export async function speakerWake(homeId: string): Promise<SpeakerWake> {
  const rows = await db.select().from(integration).where(eq(integration.userId, homeId));
  const [visible, setups] = await Promise.all([
    inTime(spotifyDeviceNames(homeId)).catch(() => null),
    Promise.allSettled(rows.map(async row => {
      const provider = createProvider(row);
      return { id: row.id, setup: provider.spotifyWake ? await inTime(provider.spotifyWake()) : null };
    })),
  ]);
  const wake: SpeakerWake = { visible, methods: {}, cast: [] };
  for (const result of setups) {
    if (result.status !== "fulfilled" || !result.value.setup) continue;
    const { id, setup } = result.value;
    wake.methods[id] = setup.method;
    wake.cast.push(...setup.cast.map(nativeId => deviceId(id, nativeId)));
  }
  return wake;
}
