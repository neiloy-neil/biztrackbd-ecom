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
    <form action={action} className="card p-md">
      <input type="hidden" name="body_en" value={bodies.en} />
      <input type="hidden" name="body_bn" value={bodies.bn} />

      <div className="flex-between items-start mb-md flex-wrap gap-md">
        <div>
          <div className="row items-center gap-sm">
            <h3 className="font-bold text-base m-0">
              {template.label}
            </h3>
            {enabled ? (
              <span className="pill ok text-xs">Active</span>
            ) : (
              <span className="pill grey text-xs">Disabled</span>
            )}
          </div>
          <p className="muted text-sm mt-xs m-0">
            {template.when}
          </p>
        </div>

        {template.alwaysOn ? (
          <span className="pill info text-xs">
            Always Active (Cart Recovery)
          </span>
        ) : (
          <label className="row items-center gap-sm pointer font-semibold text-sm">
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

      <div className="grid-280 mb-md">
        {/* Editor Side */}
        <div>
          <div className="flex-between items-center mb-xs">
            <Segmented<MessageLocale>
              label="Language"
              value={lang}
              onChange={setLang}
              options={[
                { value: "en", label: "English" },
                { value: "bn", label: "বাংলা" },
              ]}
            />
            <span className="muted text-xs">
              Default: {LANG_NAME[template.sendsIn]}
            </span>
          </div>

          <label htmlFor={id} className="sr-only">
            {template.label} in {LANG_NAME[lang]}
          </label>
          <textarea
            ref={textareaRef}
            id={id}
            className="textarea w-full text-sm leading-relaxed"
            rows={4}
            value={currentBody}
            disabled={!canEdit}
            lang={lang === "bn" ? "bn" : "en"}
            maxLength={MESSAGE_MAX_LENGTH}
            onChange={(e) =>
              setBodies((b) => ({ ...b, [lang]: e.target.value }))
            }
          />

          <div className="row flex-wrap gap-xs mt-xs items-center">
            <span className="muted text-xs font-semibold">
              Insert Tag:
            </span>
            {template.vars.map((v) => (
              <button
                key={v}
                type="button"
                className="chip text-xs pointer"
                disabled={!canEdit}
                onClick={() => insertVar(v)}
                title={VAR_HELP[v].label}
              >
                {`{${v}}`}
              </button>
            ))}
          </div>
        </div>

        {/* Live Preview Side */}
        <div className="bg-subtle border rounded-md p-md flex-col-between">
          <div>
            <div className="text-xs font-bold text-ink-3 uppercase tracking-wider mb-xs">
              Customer Phone Screen Preview
            </div>
            <div
              className="p-md rounded-md bg-surface border text-sm leading-relaxed text-ink shadow-sm whitespace-pre-wrap break-word"
              lang={lang === "bn" ? "bn" : "en"}
            >
              {preview || "…"}
            </div>
          </div>

          <div className="flex-between items-center mt-sm text-xs text-ink-3">
            <span>
              <strong>{parts.chars}</strong> chars &bull;{" "}
              <strong>{parts.parts}</strong> SMS {parts.parts === 1 ? "credit" : "credits"}
            </span>
            {parts.unicode && (
              <span className="pill warn text-xs">
                Bangla Unicode (70 chars/credit)
              </span>
            )}
          </div>
        </div>
      </div>

      {state.error && (
        <div className="notice bad mb-sm">
          {state.error}
        </div>
      )}
      {state.ok && !dirty && (
        <div className="notice good mb-sm">
          Template saved successfully.
        </div>
      )}

      {canEdit && (
        <div className="row gap-sm items-center">
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
