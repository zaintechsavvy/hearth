import { NextResponse } from "next/server";
import { z } from "zod";
import { ASSISTANT_PROVIDERS } from "@/lib/assistant/providers";
import { askAssistant, defaultAssistant } from "@/lib/assistant/service";
import { readableError } from "@/lib/home";
import { getHome } from "@/lib/session";

export const maxDuration = 60;

const requestSchema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().trim().min(1).max(2000) })).min(1).max(20),
});

export async function GET() {
  const home = await getHome();
  if (!home) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (home.role === "guest") return NextResponse.json({ error: "The assistant is for people who live here." }, { status: 403 });
  const row = await defaultAssistant(home.homeId);
  return NextResponse.json(row ? { configured: true, label: ASSISTANT_PROVIDERS[row.provider].label, model: row.model } : { configured: false });
}

export async function POST(request: Request) {
  const home = await getHome();
  if (!home) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (home.role === "guest") return NextResponse.json({ error: "The assistant is for people who live here." }, { status: 403 });
  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success || body.data.messages.at(-1)?.role !== "user") return NextResponse.json({ error: "Send a message to the assistant." }, { status: 400 });
  try {
    const result = await askAssistant(home.homeId, body.data.messages);
    if (!result) return NextResponse.json({ error: "Connect an AI assistant in Settings first." }, { status: 409 });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: readableError(error) }, { status: 502 });
  }
}
