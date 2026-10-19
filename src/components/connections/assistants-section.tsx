"use client";

import { Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useSWRConfig } from "swr";
import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { ConfirmMorph } from "@/components/arc/confirm-morph/confirm-morph";
import { Dialog, DialogClose, DialogContent } from "@/components/arc/dialog/dialog";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Input } from "@/components/arc/input/input";
import { PasswordField } from "@/components/arc/password-field/password-field";
import { RadioCards } from "@/components/arc/radio-cards/radio-cards";
import { Glass, glassSheetClass } from "@/components/glass/glass";
import { addAssistant, removeAssistant, setDefaultAssistant, updateAssistant } from "@/lib/actions";
import { ASSISTANT_PROVIDERS, ASSISTANT_PROVIDER_IDS, type AssistantProvider } from "@/lib/assistant/providers";
import { ASSISTANT_INFO_KEY } from "@/components/assistant/assistant-dock";
import styles from "./connections.module.css";
import { SettingsSection } from "./settings-section";

export interface AssistantSummary {
  id: string;
  provider: AssistantProvider;
  model: string;
  baseUrl: string | null;
  isDefault: boolean;
}

export function AssistantsSection({ assistants }: { assistants: AssistantSummary[] }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const changed = () => {
    router.refresh();
    void mutate(ASSISTANT_INFO_KEY);
  };
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AssistantSummary | null>(null);
  const [provider, setProvider] = useState<AssistantProvider>("anthropic");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const info = ASSISTANT_PROVIDERS[provider];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const result = await addAssistant({ provider, apiKey: String(form.get("apiKey") ?? ""), model: String(form.get("model") ?? ""), baseUrl: String(form.get("baseUrl") ?? "") });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setAdding(false);
    changed();
  }

  return (
    <SettingsSection id="assistants" title="AI assistants" description={<>Ask for changes in plain words.</>} action={<Button variant="secondary" onClick={() => setAdding(true)}><Plus size={16} strokeWidth={1.75} aria-hidden="true" /> Add</Button>}>

      <Glass shape="panel" className={styles.group}>
        {assistants.length === 0 ? (
          <EmptyState className={styles.empty} icon={<Sparkles size={24} strokeWidth={1.75} />} title="No assistant yet" description="Connect Claude, ChatGPT, Grok, Gemini, Muse, or Groq to control your home in plain words." />
        ) : assistants.map(item => (
          <div key={item.id} className={styles.row}>
            <Sparkles className={styles.rowIcon} size={20} strokeWidth={1.75} aria-hidden="true" />
            <div className={styles.rowText}>
              <span className={styles.rowTitle}>{ASSISTANT_PROVIDERS[item.provider].label}</span>
              <span className={styles.rowMeta}>{item.baseUrl ?? ASSISTANT_PROVIDERS[item.provider].company} · {item.model}</span>
            </div>
            <div className={styles.rowActions}>
              <Button variant="ghost" size="sm" onClick={() => setEditing(item)}>Edit</Button>
              {item.isDefault ? <Badge tone="info" size="sm">Default</Badge> : (
                <Button variant="ghost" size="sm" onClick={async () => { await setDefaultAssistant(item.id); changed(); }}>Use by default</Button>
              )}
              <ConfirmMorph label="Remove" prompt={`Remove ${ASSISTANT_PROVIDERS[item.provider].label}?`} confirmLabel="Remove" pendingLabel="Removing" doneLabel="Removed" onConfirm={async () => {
                const result = await removeAssistant(item.id);
                if (!result.ok) throw new Error(result.error);
                changed();
              }} />
            </div>
          </div>
        ))}
      </Glass>

      <Dialog open={adding} onOpenChange={open => { setAdding(open); if (!open) setError(null); }}>
        <DialogContent className={glassSheetClass} title="Add an AI assistant" description="Hearth checks the key with the provider before saving it.">
          <form className={styles.form} onSubmit={submit}>
            <RadioCards
              aria-label="Provider"
              minColumnWidth={110}
              value={provider}
              onValueChange={value => { setProvider(value as AssistantProvider); setError(null); }}
              options={ASSISTANT_PROVIDER_IDS.map(id => ({ value: id, label: ASSISTANT_PROVIDERS[id].label, description: ASSISTANT_PROVIDERS[id].company }))}
            />
            {provider === "custom" && (
              <Input label="Server address" name="baseUrl" type="url" placeholder="http://localhost:11434/v1" required autoComplete="off" description="Any server that speaks the Chat Completions API with tools: Ollama, LM Studio, vLLM, or OpenRouter." />
            )}
            <PasswordField key={`key-${provider}`} label="API key" name="apiKey" required={provider !== "custom"} autoComplete="off" description={info.keyHint} />
            {provider !== "custom" && (
              <p className={styles.help}>
                Get a key from <a href={info.keyUrl} target="_blank" rel="noreferrer" className={styles.inlineLink}>{info.company}</a>. Usage is billed to your account with them.
              </p>
            )}
            <Input key={`model-${provider}`} label="Model" name="model" defaultValue={info.defaultModel} autoComplete="off" description="Change it to any model your key can use." />
            <Alert tone="danger" title="Could not add the assistant" open={Boolean(error)}>{error ?? ""}</Alert>
            <div className={styles.formActions}>
              <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
              <Button type="submit" loading={pending}>Add {info.label}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <EditAssistant assistant={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); changed(); }} />
    </SettingsSection>
  );
}

/** Changes the model, and the key or server address when new ones are typed; the saved key stays when the field is left empty. */
function EditAssistant({ assistant, onClose, onSaved }: { assistant: AssistantSummary | null; onClose: () => void; onSaved: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const info = assistant ? ASSISTANT_PROVIDERS[assistant.provider] : null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assistant) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const result = await updateAssistant(assistant.id, { model: String(form.get("model") ?? ""), apiKey: String(form.get("apiKey") ?? ""), baseUrl: String(form.get("baseUrl") ?? "") });
    setPending(false);
    if (!result.ok) return setError(result.error);
    onSaved();
  }
  return (
    <Dialog open={Boolean(assistant)} onOpenChange={open => { if (!open) { setError(null); onClose(); } }}>
      {assistant && info && (
        <DialogContent className={glassSheetClass} title={`Edit ${info.label}`} description="Hearth checks the model and key with the provider before saving.">
          <form key={assistant.id} className={styles.form} onSubmit={submit}>
            <Input label="Model" name="model" defaultValue={assistant.model} required autoComplete="off" description={`The model's id, such as ${info.defaultModel}. A name like the one on the provider's site works too.`} />
            {assistant.provider === "custom" && <Input label="Server address" name="baseUrl" type="url" defaultValue={assistant.baseUrl ?? ""} autoComplete="off" />}
            <PasswordField label="New API key" name="apiKey" autoComplete="off" description="Leave empty to keep the saved key." />
            <Alert tone="danger" title="Could not save" open={Boolean(error)}>{error ?? ""}</Alert>
            <div className={styles.formActions}>
              <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
              <Button type="submit" loading={pending}>Save</Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
