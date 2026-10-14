"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Segmented } from "@biztrackbd/ui";
import {
  DEFAULT_MESSAGES,
  MESSAGE_MAX_LENGTH,
  VAR_HELP,
  renderMessage,
  sampleVars,
  smsParts,
  type MessageEvent,
  type MessageLocale,
} from "@biztrackbd/core/messages-client";
import type { MessageTemplateView } from "@biztrackbd/core";
import { resetNotificationAction, saveNotificationAction, type MessageState } from "./actions";

const LANG_NAME: Record<MessageLocale, string> = { en: "English", bn: "Bangla (বাংলা)" };

export function NotificationCard({
  template,
  storeName,
  canEdit,
}: {
  template: MessageTemplateView;
  storeName: string;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState<MessageState, FormData>(
    saveNotificationAction.bind(null, template.event),
    {}
  );
  const [enabled, setEnabled] = useState(template.enabled);
  const [lang, setLang] = useState<MessageLocale>(template.sendsIn);
  const [bodies, setBodies] = useState<Record<MessageLocale, string>>({
    en: template.texts.en.body,
    bn: template.texts.bn.body,
  });
  const [saved, setSaved] = useState({
    enabled: template.enabled,
    en: template.texts.en.body,
    bn: template.texts.bn.body,
  });
  const [resetting, startReset] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state.ok) {
      setSaved({ enabled, en: bodies.en, bn: bodies.bn });
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty =
    enabled !== saved.enabled ||
    bodies.en !== saved.en ||
    bodies.bn !== saved.bn;
  const currentBody = bodies[lang];
  const parts = smsParts(renderMessage(currentBody, sampleVars(storeName)));
  const isDefault =
    currentBody === DEFAULT_MESSAGES[template.event as MessageEvent][lang];
  const preview = renderMessage(currentBody, sampleVars(storeName));
  const id = `notif-${template.event}`;

  function insertVar(variable: string) {
    const el = textareaRef.current;
    const at = el
      ? [el.selectionStart, el.selectionEnd]
      : [currentBody.length, currentBody.length];
    const next = `${currentBody.slice(0, at[0])}{${variable}}${currentBody.slice(at[1])}`;
    setBodies((b) => ({ ...b, [lang]: next }));
    requestAnimationFrame(() => {
      el?.focus();
      const p = at[0]! + variable.length + 2;
      el?.setSelectionRange(p, p);
    });
  }

  return (
    <form action={action} className="card" style={{ padding: 20 }}>
      <input type="hidden" name="body_en" value={bodies.en} />
      <input type="hidden" name="body_bn" value={bodies.bn} />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              {template.label}
            </h3>
            {enabled ? (
              <span className="pill green" style={{ fontSize: 11 }}>Active</span>
            ) : (
              <span className="pill grey" style={{ fontSize: 11 }}>Disabled</span>
            )}
          </div>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
            {template.when}
          </p>
        </div>

        {template.alwaysOn ? (
          <span className="pill blue" style={{ fontSize: 12 }}>
            Always Active (Cart Recovery)
          </span>
        ) : (
          <label
            className="check"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: canEdit ? "pointer" : "default",
              fontWeight: 600,
            }}
          >
            <input
              type="checkbox"
              name="enabled"
              checked={enabled}
              disabled={!canEdit}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>{enabled ? "Enabled" : "Disabled"}</span>
          </label>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 18,
          marginBottom: 16,
        }}
      >
        {/* Editor Side */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <Segmented<MessageLocale>
              label="Language"
              value={lang}
              onChange={setLang}
              options={[
                { value: "en", label: "English" },
                { value: "bn", label: "বাংলা" },
              ]}
            />
            <span className="muted" style={{ fontSize: 12 }}>
              Default: {LANG_NAME[template.sendsIn]}
            </span>
          </div>

          <label htmlFor={id} className="sr-only">
            {template.label} in {LANG_NAME[lang]}
          </label>
          <textarea
            ref={textareaRef}
            id={id}
            className="textarea"
            rows={4}
            value={currentBody}
            disabled={!canEdit}
            lang={lang === "bn" ? "bn" : "en"}
            maxLength={MESSAGE_MAX_LENGTH}
            onChange={(e) =>
              setBodies((b) => ({ ...b, [lang]: e.target.value }))
            }
            style={{
              width: "100%",
              fontFamily: "inherit",
              fontSize: 13.5,
              lineHeight: 1.5,
              padding: 10,
              borderRadius: 8,
              border: "1px solid var(--border)",
            }}
          />

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginTop: 8,
              alignItems: "center",
            }}
          >
            <span className="muted" style={{ fontSize: 11, fontWeight: 600 }}>
              Insert Tag:
            </span>
            {template.vars.map((v) => (
              <button
                key={v}
                type="button"
                className="chip"
                disabled={!canEdit}
                onClick={() => insertVar(v)}
                title={VAR_HELP[v].label}
                style={{
                  fontSize: 11,
                  padding: "3px 8px",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                {`{${v}}`}
              </button>
            ))}
          </div>
        </div>

        {/* Live Preview Side */}
        <div
          style={{
            background: "var(--bg-subtle, #f8fafc)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 14,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--muted)",
                letterSpacing: "0.05em",
                marginBottom: 8,
                textTransform: "uppercase",
              }}
            >
              Customer Phone Screen Preview
            </div>
            <div
              style={{
                background: "#ffffff",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "12px 14px",
                fontSize: 13,
                lineHeight: 1.45,
                color: "#1e293b",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
              lang={lang === "bn" ? "bn" : "en"}
            >
              {preview || "…"}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 10,
              fontSize: 12,
              color: "var(--muted)",
            }}
          >
            <span>
              <strong>{parts.chars}</strong> chars &bull;{" "}
              <strong>{parts.parts}</strong> SMS {parts.parts === 1 ? "credit" : "credits"}
            </span>
            {parts.unicode && (
              <span className="pill orange" style={{ fontSize: 10 }}>
                Bangla Unicode (70 chars/credit)
              </span>
            )}
          </div>
        </div>
      </div>

      {state.error && (
        <div className="notice bad" style={{ marginBottom: 12 }}>
          {state.error}
        </div>
      )}
      {state.ok && !dirty && (
        <div className="notice good" style={{ marginBottom: 12 }}>
          Template saved successfully.
        </div>
      )}

      {canEdit && (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={!dirty || pending}
            aria-busy={pending}
          >
            {pending ? "Saving..." : "Save Template"}
          </button>
          {!isDefault && (
            <button
              className="btn btn-secondary"
              type="button"
              disabled={resetting}
              onClick={() =>
                startReset(async () => {
                  await resetNotificationAction(template.event, lang);
                  const d =
                    DEFAULT_MESSAGES[template.event as MessageEvent][lang];
                  setBodies((b) => ({ ...b, [lang]: d }));
                  setSaved((x) => ({ ...x, [lang]: d }));
                })
              }
            >
              {resetting ? "Resetting..." : `Reset to Default ${LANG_NAME[lang]}`}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
