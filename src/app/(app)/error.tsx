"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/arc/button/button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Glass } from "@/components/glass/glass";
import styles from "./app.module.css";

/** A screen that broke: what went wrong in words that can be passed on, and a way back without losing the session. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Glass shape="panel" className={styles.error}>
      <EmptyState
        icon={<TriangleAlert size={24} strokeWidth={1.75} />}
        title="This screen hit a problem"
        description={`${error.message || "Something went wrong."}${error.digest ? ` (${error.digest})` : ""} Try again, and if it keeps happening, send this message along.`}
        action={(
          <div className={styles.errorActions}>
            <Button onClick={reset}>Try again</Button>
            <Button variant="ghost" onClick={() => location.assign("/dashboard")}>Go home</Button>
          </div>
        )}
      />
    </Glass>
  );
}
