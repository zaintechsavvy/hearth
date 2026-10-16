import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { integration } from "@/lib/db/schema";
import { loadHome, type HomeSnapshot } from "@/lib/home";
import { guestView } from "@/lib/household";
import { createProvider } from "@/lib/integrations/registry";
import { integrationTopic, listen, userTopic } from "@/lib/live/bus";
import { getHome } from "@/lib/session";
import { isServerless } from "@/lib/setup-check";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const THROTTLE_MS = 150;
const HEARTBEAT_MS = 25_000;
/** On serverless hosts the stream ends itself just inside the platform's limit; the browser reconnects in three seconds. */
const SERVERLESS_LIFETIME_MS = 285_000;

/**
 * Server-Sent Events: a snapshot on connect, then a new one whenever an integration pushes a change, a command
 * runs, or settings change. Snapshots are throttled so a burst of updates becomes one message.
 */
export async function GET(request: Request) {
  const home = await getHome();
  if (!home) return new Response("Sign in to continue.", { status: 401 });

  const view = (snapshot: HomeSnapshot) => home.role === "guest" ? guestView(snapshot, home.pages ?? []) : snapshot;
  const encoder = new TextEncoder();
  let closed = false;
  let watching: (() => void)[] = [];
  const cleanups: (() => void)[] = [];

  const stop = () => {
    if (closed) return;
    closed = true;
    for (const cleanup of [...cleanups, ...watching]) cleanup();
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          stop();
        }
      };

      let timer: ReturnType<typeof setTimeout> | undefined;
      let sending = false;
      let queued = false;

      const send = async () => {
        if (sending) {
          queued = true;
          return;
        }
        sending = true;
        try {
          write(`event: snapshot\ndata: ${JSON.stringify(view(await loadHome(home.homeId)))}\n\n`);
        } catch (error) {
          console.error(error);
        } finally {
          sending = false;
          if (queued) {
            queued = false;
            schedule();
          }
        }
      };

      const schedule = () => {
        if (timer || closed) return;
        timer = setTimeout(() => {
          timer = undefined;
          void send();
        }, THROTTLE_MS);
      };

      const watchIntegrations = async () => {
        for (const cleanup of watching) cleanup();
        const rows = await db.select().from(integration).where(eq(integration.userId, home.homeId));
        watching = rows.flatMap(row => {
          const stops: (() => void)[] = [listen(integrationTopic(row.id), schedule)];
          try {
            const unsubscribe = createProvider(row).subscribe?.(schedule);
            if (unsubscribe) stops.push(unsubscribe);
          } catch (error) {
            console.error(error);
          }
          return stops;
        });
        if (closed) for (const cleanup of watching) cleanup();
      };

      cleanups.push(listen(userTopic(home.homeId), () => void watchIntegrations().then(schedule)));
      const heartbeat = setInterval(() => write(": keepalive\n\n"), HEARTBEAT_MS);
      cleanups.push(() => clearInterval(heartbeat), () => clearTimeout(timer));
      request.signal.addEventListener("abort", () => {
        stop();
        try {
          controller.close();
        } catch {}
      });

      if (isServerless()) {
        const lifetime = setTimeout(() => {
          stop();
          try {
            controller.close();
          } catch {}
        }, SERVERLESS_LIFETIME_MS);
        cleanups.push(() => clearTimeout(lifetime));
      }
      write("retry: 3000\n\n");
      void watchIntegrations().then(send);
    },
    cancel: stop,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
