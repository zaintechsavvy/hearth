"use client";

import { Copy, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { Checkbox } from "@/components/arc/checkbox/checkbox";
import { ConfirmMorph } from "@/components/arc/confirm-morph/confirm-morph";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Glass } from "@/components/glass/glass";
import { createInvite, leaveHome, removeMember, revokeInvite, setGuestPages } from "@/lib/household-actions";
import styles from "./connections.module.css";
import { SettingsSection } from "./settings-section";

export interface HouseholdMember {
  id: string;
  name: string;
  email: string;
  role: "member" | "guest";
  pages: string[] | null;
}

interface HouseholdSectionProps {
  role: "owner" | "member";
  ownerName: string;
  members: HouseholdMember[];
  invites: { code: string; role: "member" | "guest"; expiresAt: string }[];
  pages: { id: string; name: string }[];
}

function PageChoice({ pages, value, onChange }: { pages: HouseholdSectionProps["pages"]; value: string[]; onChange: (pages: string[]) => void }) {
  return (
    <div className={styles.pageChoice} role="group" aria-label="Pages the guest sees">
      {pages.map(page => <Checkbox key={page.id} label={page.name} checked={value.includes(page.id)} onCheckedChange={on => onChange(on === true ? [...value, page.id] : value.filter(id => id !== page.id))} />)}
    </div>
  );
}

/** Who shares this home. Owners invite members and guests; members can leave. */
export function HouseholdSection({ role, ownerName, members, invites, pages }: HouseholdSectionProps) {
  const router = useRouter();
  const [inviteRole, setInviteRole] = useState<"member" | "guest">("member");
  const [guestPages, setGuestPagesDraft] = useState<string[]>(pages.slice(0, 1).map(page => page.id));
  const [link, setLink] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!link) return;
    let cancelled = false;
    void import("qrcode").then(({ toString }) => toString(link, { type: "svg", margin: 0, errorCorrectionLevel: "M" })).then(svg => { if (!cancelled) setQr(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`); });
    return () => { cancelled = true; };
  }, [link]);

  if (role === "member") {
    return (
      <SettingsSection id="household" title="Household">
        <Glass shape="panel" className={styles.group}>
          <div className={styles.row}>
            <Users className={styles.rowIcon} size={20} strokeWidth={1.75} aria-hidden="true" />
            <div className={styles.rowText}>
              <span className={styles.rowTitle}>You share {ownerName.split(" ")[0]}&apos;s home</span>
              <span className={styles.rowMeta}>Leave to go back to your own dashboard and devices.</span>
            </div>
            <div className={styles.rowActions}>
              <ConfirmMorph label="Leave" prompt={`Leave ${ownerName.split(" ")[0]}'s home?`} confirmLabel="Leave" pendingLabel="Leaving" doneLabel="Left" onConfirm={async () => { await leaveHome(); router.replace("/dashboard"); router.refresh(); }} />
            </div>
          </div>
        </Glass>
      </SettingsSection>
    );
  }

  const make = async () => {
    setError(null);
    const result = await createInvite({ role: inviteRole, pages: inviteRole === "guest" ? guestPages : undefined });
    if (!result.ok) return setError(result.error);
    setCopied(false);
    setLink(`${window.location.origin}/join/${result.code}`);
    router.refresh();
  };

  return (
    <SettingsSection id="household" title="Household" description={<>Invite the people you live with.</>}>
      <Glass shape="panel" className={styles.group}>
        {members.map(member => (
          <div key={member.id} className={`${styles.row} ${member.role === "guest" ? styles.stacked : ""}`}>
            <div className={styles.inline} style={{ flex: 1, alignItems: "center" }}>
              <div className={styles.rowText}>
                <span className={styles.rowTitle}>{member.name} <Badge size="sm" tone={member.role === "member" ? "info" : undefined}>{member.role === "member" ? "Member" : "Guest"}</Badge></span>
                <span className={styles.rowMeta}>{member.email}</span>
              </div>
              <div className={styles.rowActions}>
                <ConfirmMorph label="Remove" prompt={`Remove ${member.name.split(" ")[0]}?`} confirmLabel="Remove" pendingLabel="Removing" doneLabel="Removed" onConfirm={async () => { await removeMember(member.id); router.refresh(); }} />
              </div>
            </div>
            {member.role === "guest" && <PageChoice pages={pages} value={member.pages ?? []} onChange={async next => { if (next.length) { await setGuestPages(member.id, next); router.refresh(); } }} />}
          </div>
        ))}
        <div className={`${styles.row} ${styles.stacked}`}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Invite someone</span>
            <span className={styles.rowMeta}>The link works once and lasts a week.</span>
          </div>
          <SegmentedControl label="As" value={inviteRole} onValueChange={value => setInviteRole(value as "member" | "guest")} options={[{ value: "member", label: "Member" }, { value: "guest", label: "Guest" }]} />
          {inviteRole === "guest" && <PageChoice pages={pages} value={guestPages} onChange={setGuestPagesDraft} />}
          {error && <p className={styles.rowMeta} role="alert">{error}</p>}
          <Button variant="secondary" className={styles.alignEnd} onClick={() => void make()}>Make an invite link</Button>
          {link && (
            <div className={styles.inviteLink}>
              {qr && (
                // eslint-disable-next-line @next/next/no-img-element -- a generated inline SVG data URL
                <img src={qr} alt="QR code for the invite link" className={styles.inviteQr} />
              )}
              <div className={styles.inviteText}>
                <code className={styles.inviteCode}>{link}</code>
                <Button variant="secondary" size="sm" onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); }}><Copy size={16} strokeWidth={1.75} aria-hidden="true" /> {copied ? "Copied" : "Copy link"}</Button>
              </div>
            </div>
          )}
        </div>
        {invites.length > 0 && (
          <div className={`${styles.row} ${styles.stacked}`}>
            <span className={styles.rowTitle}>Waiting to be accepted</span>
            {invites.map(item => (
              <div key={item.code} className={styles.inline} style={{ alignItems: "center" }}>
                <span className={styles.rowMeta} style={{ flex: 1 }}>{item.role === "member" ? "Member" : "Guest"} invite · expires {new Date(item.expiresAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                <ConfirmMorph label="Revoke" prompt="Revoke this invite?" pendingLabel="Revoking" doneLabel="Revoked" onConfirm={async () => { await revokeInvite(item.code); router.refresh(); }} />
              </div>
            ))}
          </div>
        )}
      </Glass>
    </SettingsSection>
  );
}
