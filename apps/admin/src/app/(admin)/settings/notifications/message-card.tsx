"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Segmented } from "@biztrackbd/ui";
import { DEFAULT_MESSAGES, MESSAGE_MAX_LENGTH, VAR_HELP, renderMessage, sampleVars, smsParts, type MessageEvent, type MessageLocale, type MessageVar } from "@biztrackbd/core/messages-client";
import type { MessageTemplateView } from "@biztrackbd/core";
import { resetMessageAction, saveMessageAction, type MessageState } from "./actions";

const LANG_NAME: Record<MessageLocale, string> = { en: "English", bn: "Bangla" };

export function MessageCard({ t, storeName }: { t: MessageTemplateView; storeName: string }) {
  const [state, action, pending] = useActionState<MessageState, FormData>(saveMessageAction.bind(null, t.event), {});
  const [enabled, setEnabled] = useState(t.enabled);
  const [lang, setLang] = useState<MessageLocale>(t.sendsIn);
  const [bodies, setBodies] = useState<Record<MessageLocale, string>>({ en: t.texts.en.body, bn: t.texts.bn.body });
  // What is saved, as far as this card knows. It moves when a save or a reset succeeds, so the card never needs to be rebuilt.
  const [saved, setSaved] = useState({ enabled: t.enabled, en: t.texts.en.body, bn: t.texts.bn.body });
  const [ready, setReady] = useState(false);
  const [resetting, startReset] = useTransition();
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setReady(true), []);
  useEffect(() => { if (state.ok) setSaved({ enabled, en: bodies.en, bn: bodies.bn }); }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = enabled !== saved.enabled || bodies.en !== saved.en || bodies.bn !== saved.bn;
  const body = bodies[lang];
  const parts = smsParts(renderMessage(body, sampleVars(storeName)));
  const isDefault = body === DEFAULT_MESSAGES[t.event as MessageEvent][lang];
  const preview = renderMessage(body, sampleVars(storeName));
  const id = `msg-${t.event}`;

  function insert(v: string) {
    const el = box.current;
    const at = el ? [el.selectionStart, el.selectionEnd] : [body.length, body.length];
    const next = `${body.slice(0, at[0])}{${v}}${body.slice(at[1])}`;
    setBodies((b) => ({ ...b, [lang]: next }));
    requestAnimationFrame(() => { el?.focus(); const p = at[0]! + v.length + 2; el?.setSelectionRange(p, p); });
  }

  return (
    <form action={action} className="card msg-card" data-testid={`msg-${t.event}`} data-ready={ready ? "1" : "0"}>
      <input type="hidden" name="body_en" value={bodies.en} />
      <input type="hidden" name="body_bn" value={bodies.bn} />
      <div className="msg-head">
        <div>
          <h2 style={{ margin: 0 }}>{t.label}</h2>
          <div className="muted" style={{ fontSize: 13.5 }}>{t.when}</div>
        </div>
        {t.alwaysOn ? <span className="pill grey">Sent when cart reminders are on</span> : (
          <label className="check msg-switch">
            <input type="checkbox" name="enabled" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} data-testid={`msg-on-${t.event}`} />
            <span>{enabled ? "On" : "Off"}</span>
          </label>
        )}
      </div>

      <div className="msg-body">
        <div className="row" style={{ justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
          <Segmented<MessageLocale> label="Language" value={lang} onChange={setLang} options={[{ value: "en", label: "English" }, { value: "bn", label: "Bangla" }]} />
          <span className="muted" style={{ fontSize: 12.5 }}>Customers get the {LANG_NAME[t.sendsIn]} text</span>
        </div>
        <label htmlFor={id} className="sr-only">{t.label} in {LANG_NAME[lang]}</label>
        <textarea ref={box} id={id} className="textarea" rows={4} value={body} lang={lang === "bn" ? "bn" : "en"} maxLength={MESSAGE_MAX_LENGTH} onChange={(e) => setBodies((b) => ({ ...b, [lang]: e.target.value }))} data-testid={`msg-text-${t.event}`} />
        <div className="msg-chips" role="group" aria-label="Add a detail to the message">
          {t.vars.map((v) => <button key={v} type="button" className="chip" onClick={() => insert(v)} title={VAR_HELP[v].label}>{`{${v}}`}</button>)}
        </div>
        <div className="msg-preview" data-testid={`msg-preview-${t.event}`}>
          <div className="muted" style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>WHAT THE CUSTOMER SEES</div>
          <div className="bubble" lang={lang === "bn" ? "bn" : "en"}>{preview || "…"}</div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{parts.chars} characters · {parts.parts} SMS {parts.parts === 1 ? "part" : "parts"}{parts.unicode ? " (Bangla letters take more room)" : ""}</div>
        </div>
      </div>

      {state.error && <div className="notice bad" role="alert" data-testid={`msg-error-${t.event}`}>{state.error}</div>}
      {state.ok && !dirty && <div className="notice good" role="status" data-testid={`msg-saved-${t.event}`}>Saved.</div>}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={!dirty || pending} aria-busy={pending} data-testid={`msg-save-${t.event}`}>{pending ? "Saving…" : "Save"}</button>
        {!isDefault && <button className="btn btn-secondary" type="button" disabled={resetting} data-testid={`msg-reset-${t.event}`}
          onClick={() => startReset(async () => { await resetMessageAction(t.event, lang); const d = DEFAULT_MESSAGES[t.event as MessageEvent][lang]; setBodies((b) => ({ ...b, [lang]: d })); setSaved((x) => ({ ...x, [lang]: d })); })}>Use the ready-made {LANG_NAME[lang]} text</button>}
      </div>
    </form>
  );
}
