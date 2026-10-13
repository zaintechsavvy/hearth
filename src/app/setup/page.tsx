import { randomBytes } from "node:crypto";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { setupProblems } from "@/lib/setup-check";
import styles from "./setup.module.css";

export const metadata: Metadata = { title: "Finish setting up" };
export const dynamic = "force-dynamic";

/** Shown instead of an error while the deployment is missing what it needs. Touches no database. */
export default function SetupPage() {
  const problems = setupProblems();
  if (problems.length === 0) redirect("/");
  const example = randomBytes(32).toString("base64");
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="setup-title">
        <h1 id="setup-title" className={styles.title}>Finish setting up Hearth</h1>
        <p className={styles.lede}>This deployment is missing {problems.length === 1 ? "one setting" : `${problems.length} settings`}. Add {problems.length === 1 ? "it" : "them"} as environment variables, then redeploy.</p>
        <ol className={styles.list}>
          {problems.map(problem => (
            <li key={problem.key} className={styles.item}>
              <code className={styles.key}>{problem.key}</code>
              <p className={styles.why}>{problem.why}</p>
              {problem.key === "BETTER_AUTH_SECRET" && <p className={styles.why}>A fresh random value you can use: <code className={styles.value}>{example}</code></p>}
            </li>
          ))}
        </ol>
        <p className={styles.lede}>On Vercel: open the project, then <b>Settings</b>, <b>Environment Variables</b>. For a database, <b>Storage</b>, <b>Create</b>, <b>Neon</b> adds <code className={styles.value}>DATABASE_URL</code> for you. Then <b>Deployments</b>, <b>Redeploy</b>. Hearth creates its tables on the first request.</p>
      </section>
    </main>
  );
}
