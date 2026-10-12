import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { atLeast, homeFor, type HomeAccess, type Role } from "@/lib/household";

export async function getUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  return user;
}

/** The signed-in person and the home they act in, or null when signed out. */
export async function getHome(): Promise<HomeAccess | null> {
  const user = await getUser();
  return user ? homeFor({ id: user.id, name: user.name, email: user.email }) : null;
}

/** For pages: signs out people back to sign in, and sends anyone below `role` to the dashboard. */
export async function requireHome(role: Role = "guest"): Promise<HomeAccess> {
  const home = await getHome();
  if (!home) redirect("/sign-in");
  if (!atLeast(home.role, role)) redirect("/dashboard");
  return home;
}
