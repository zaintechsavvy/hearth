export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { isServerless, setupProblems } = await import("@/lib/setup-check");
  if (setupProblems().length) return;
  const { isHelperWorker, migrationsShipped, runMigrations } = await import("@/lib/db");
  if (isHelperWorker() || (isServerless() && !migrationsShipped())) return;
  await runMigrations();
  if (process.env.NEXT_PHASE === "phase-production-build" || process.env.HEARTH_MONITOR === "off" || isServerless()) return;
  const { startHomeMonitor } = await import("@/lib/monitor/start");
  startHomeMonitor();
}
