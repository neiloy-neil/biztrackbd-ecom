"use client";

import { useState } from "react";
import { Drawer, SaveBar, Section, Segmented, ToastProvider, useToast } from "@biztrackbd/ui";

function Inner() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Rina's Closet");
  const [saved, setSaved] = useState("Rina's Closet");
  const [lang, setLang] = useState<"en" | "bn">("en");
  const dirty = name !== saved;
  return (
    <form onSubmit={(e) => { e.preventDefault(); setSaved(name); toast("Store details saved"); }} style={{ marginBottom: 14 }}>
      <Section title="Store details" description="Edit the name to see the save bar react." action={<Segmented label="Language" value={lang} onChange={setLang} options={[{ value: "en", label: "English" }, { value: "bn", label: "বাংলা" }]} />}>
        <label className="field"><span className="label">Store name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <div className="row">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>Open drawer</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => toast("Something went wrong", "bad")}>Error toast</button>
        </div>
      </Section>
      <SaveBar dirty={dirty} onDiscard={() => setName(saved)} />
      <Drawer open={open} onClose={() => setOpen(false)} title="Order #1042">
        <p className="muted">A side panel on desktop, a bottom sheet on phones. Use it for quick views so people do not lose their place in a list.</p>
      </Drawer>
    </form>
  );
}

export function KitDemo() {
  return <ToastProvider><Inner /></ToastProvider>;
}
