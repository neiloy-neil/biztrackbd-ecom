"use client";

import { useActionState, useRef, useState } from "react";
import { saveBlogPostAction, type BlogFormState } from "./actions";

export interface PostFormValues {
  slug: string;
  title: string;
  description: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  publishedAt: string;
  seoTitle: string;
  seoDescription: string;
  coverImage: string;
  coverAlt: string;
  noindex: boolean;
}

const label = { display: "block", fontSize: 12.5, fontWeight: 700, marginBottom: 6 } as const;
const hint = { fontSize: 12, color: "var(--ink-3)", marginTop: 4 } as const;
const SITE = "biztrack.bd";

export function DeleteButton() {
  return (
    <button
      type="submit"
      className="btn btn-secondary"
      style={{ color: "var(--danger)" }}
      onClick={(e) => {
        if (!confirm("Delete this post for good? It disappears from the site.")) e.preventDefault();
      }}
    >
      Delete post
    </button>
  );
}

/** Sends one picture to the upload endpoint and returns its public address. Throws a readable message on failure. */
async function uploadPicture(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/blog-images", { method: "POST", body: fd });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? "The picture could not be uploaded");
  return data.url;
}

function Counter({ value, min, max }: { value: string; min: number; max: number }) {
  const n = value.trim().length;
  const ok = n === 0 || (n >= min && n <= max);
  return <span style={{ color: ok ? "var(--ink-3)" : "var(--danger)", fontWeight: ok ? 400 : 700 }}>{n} / {max}</span>;
}

export function PostForm({ id, initial, live }: { id: string | null; initial: PostFormValues; live: boolean }) {
  const [state, action, pending] = useActionState<BlogFormState, FormData>(saveBlogPostAction.bind(null, id), {});
  const v = state.values ? { ...initial, ...state.values, noindex: state.noindex ?? initial.noindex } : initial;
  // Fields React resets after a submit are remounted with what was typed, so a failed save never loses the article.
  const formKey = state.values ? `retry-${state.error ?? ""}` : "first";
  const bad = (f: string) => (state.field === f ? { borderColor: "var(--danger)" } : undefined);

  const [title, setTitle] = useState(v.title);
  const [slug, setSlug] = useState(v.slug);
  const [description, setDescription] = useState(v.description);
  const [seoTitle, setSeoTitle] = useState(v.seoTitle);
  const [seoDescription, setSeoDescription] = useState(v.seoDescription);
  const [cover, setCover] = useState(v.coverImage);
  const [coverAlt, setCoverAlt] = useState(v.coverAlt);
  const [busy, setBusy] = useState<"cover" | "inline" | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  async function onCover(file: File | undefined) {
    if (!file) return;
    setBusy("cover");
    setUploadError(null);
    try {
      setCover(await uploadPicture(file));
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  /** Uploads a picture and writes the picture line into the article where the cursor is. */
  async function onInline(file: File | undefined) {
    if (!file || !bodyRef.current) return;
    setBusy("inline");
    setUploadError(null);
    try {
      const url = await uploadPicture(file);
      const ta = bodyRef.current;
      const alt = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/[[\]()]/g, "").trim() || "Describe the picture";
      const line = `![${alt}](${url})`;
      const at = ta.selectionStart ?? ta.value.length;
      const before = ta.value.slice(0, at).replace(/\n*$/, "");
      const after = ta.value.slice(ta.selectionEnd ?? at).replace(/^\n*/, "");
      ta.value = `${before}${before ? "\n\n" : ""}${line}${after ? "\n\n" : ""}${after}`;
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  const previewTitle = (seoTitle.trim() || title.trim() || "Your title") + " | BizTrackBD";
  const previewDesc = seoDescription.trim() || description.trim() || "Your description appears here.";

  return (
    <form action={action} className="card" style={{ padding: "24px 26px", display: "flex", flexDirection: "column", gap: 18 }}>
      {state.error && (
        <div role="alert" style={{ padding: "12px 16px", borderRadius: 8, background: "var(--danger-bg)", color: "var(--danger)", fontWeight: 600 }}>
          {state.error}
        </div>
      )}
      {uploadError && (
        <div role="alert" style={{ padding: "12px 16px", borderRadius: 8, background: "var(--danger-bg)", color: "var(--danger)", fontWeight: 600 }}>
          {uploadError}
        </div>
      )}

      <div>
        <label htmlFor="title" style={label}>Title</label>
        <input id="title" name="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} style={{ width: "100%", height: 42, ...bad("title") }} />
      </div>

      <div>
        <label htmlFor="slug" style={label}>Link name</label>
        <input id="slug" name="slug" className="input" value={slug} onChange={(e) => setSlug(e.target.value)} required placeholder="stop-cod-return-fraud" style={{ width: "100%", height: 42, ...bad("slug") }} />
        <div style={hint}>The page address: {SITE}/blog/<b>{slug || "link-name"}</b>. Changing it later breaks old links.</div>
      </div>

      <div>
        <label htmlFor="description" style={label}>Summary (30 to 170 characters) <Counter value={description} min={30} max={170} /></label>
        <textarea id="description" name="description" className="input" value={description} onChange={(e) => setDescription(e.target.value)} required rows={2} maxLength={170} style={{ width: "100%", padding: 10, ...bad("description") }} />
        <div style={hint}>Shown under the title on the guides page. Also used for Google unless you write a separate SEO description below.</div>
      </div>

      <fieldset style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14, margin: 0 }}>
        <legend style={{ fontSize: 13, fontWeight: 700, padding: "0 6px" }}>Search and sharing (SEO)</legend>

        <div>
          <label htmlFor="seoTitle" style={label}>SEO title (optional, 10 to 60) <Counter value={seoTitle} min={10} max={60} /></label>
          <input id="seoTitle" name="seoTitle" className="input" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder={title || "Defaults to the title"} style={{ width: "100%", height: 42, ...bad("seoTitle") }} />
          <div style={hint}>The blue headline in Google and on social cards. Put the main keyword first. BizTrackBD is added after it.</div>
        </div>

        <div>
          <label htmlFor="seoDescription" style={label}>SEO description (optional, 30 to 170) <Counter value={seoDescription} min={30} max={170} /></label>
          <textarea id="seoDescription" name="seoDescription" className="input" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} rows={2} style={{ width: "100%", padding: 10, ...bad("seoDescription") }} />
          <div style={hint}>Write one clear sentence that says what the reader will learn, ending with a reason to click.</div>
        </div>

        <div aria-label="How this looks in Google" style={{ background: "var(--bg)", borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{SITE} › blog › {slug || "link-name"}</div>
          <div style={{ fontSize: 17, color: "#1a0dab", lineHeight: 1.3 }}>{previewTitle.length > 70 ? `${previewTitle.slice(0, 67)}…` : previewTitle}</div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 2 }}>{previewDesc.length > 160 ? `${previewDesc.slice(0, 157)}…` : previewDesc}</div>
        </div>

        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}>
          <input key={`n-${formKey}`} type="checkbox" name="noindex" defaultChecked={v.noindex} />
          Hide this guide from Google (noindex). It stays reachable by link, and is left out of the sitemap.
        </label>
      </fieldset>

      <fieldset style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12, margin: 0 }}>
        <legend style={{ fontSize: 13, fontWeight: 700, padding: "0 6px" }}>Cover image</legend>
        <input type="hidden" name="coverImage" value={cover} />
        {cover ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt={coverAlt || "Cover preview"} style={{ width: "100%", maxWidth: 520, borderRadius: 10, border: "1px solid var(--line)" }} />
            <div>
              <label htmlFor="coverAlt" style={label}>Describe the cover in a few words (required)</label>
              <input id="coverAlt" name="coverAlt" className="input" value={coverAlt} onChange={(e) => setCoverAlt(e.target.value)} maxLength={160} style={{ width: "100%", height: 42, ...bad("coverAlt") }} />
            </div>
            <div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setCover(""); setCoverAlt(""); }}>Remove cover</button>
            </div>
          </>
        ) : (
          <>
            <input type="hidden" name="coverAlt" value="" />
            <div style={hint}>No cover chosen. The site draws one from the title in the BizTrackBD style. Upload a picture to replace it (JPG, PNG or WebP; wide 1200×630 works best).</div>
          </>
        )}
        <div>
          <label className="btn btn-secondary btn-sm" style={{ cursor: busy ? "wait" : "pointer" }}>
            {busy === "cover" ? "Uploading…" : cover ? "Replace cover" : "Upload cover"}
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy !== null} onChange={(e) => { void onCover(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </div>
      </fieldset>

      <div>
        <label htmlFor="body" style={label}>Article</label>
        <textarea key={`b-${formKey}`} ref={bodyRef} id="body" name="body" className="input" defaultValue={v.body} required rows={22} style={{ width: "100%", padding: 12, fontFamily: "inherit", lineHeight: 1.6, ...bad("body") }} />
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
          <label className="btn btn-secondary btn-sm" style={{ cursor: busy ? "wait" : "pointer" }}>
            {busy === "inline" ? "Uploading…" : "Insert picture"}
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy !== null} onChange={(e) => { void onInline(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <span style={hint}>Puts the picture where your cursor is. Then replace the words in [brackets] with a short description of it.</span>
        </div>
        <div style={hint}>
          Leave a blank line between paragraphs. <code>## </code> starts a heading and <code>### </code> a sub-heading. Write <code>[link text](/pricing)</code> for a link to a page on the site, or use a full https:// address. Link to your other pages and guides; it helps readers and Google.
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px" }}>
          <label htmlFor="ctaLabel" style={label}>Button text (optional)</label>
          <input key={`cl-${formKey}`} id="ctaLabel" name="ctaLabel" className="input" defaultValue={v.ctaLabel} style={{ width: "100%", height: 42, ...bad("ctaLabel") }} />
        </div>
        <div style={{ flex: "1 1 240px" }}>
          <label htmlFor="ctaHref" style={label}>Button link</label>
          <input key={`ch-${formKey}`} id="ctaHref" name="ctaHref" className="input" defaultValue={v.ctaHref} placeholder="/start" style={{ width: "100%", height: 42, ...bad("ctaHref") }} />
        </div>
      </div>

      <div style={{ maxWidth: 300 }}>
        <label htmlFor="publishedAt" style={label}>Publish date, Dhaka time (optional)</label>
        <input key={`p-${formKey}`} id="publishedAt" name="publishedAt" type="datetime-local" className="input" defaultValue={v.publishedAt} style={{ width: "100%", height: 42, ...bad("publishedAt") }} />
        <div style={hint}>Leave empty to publish now. A future date schedules the post.</div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="submit" name="intent" value="publish" className="btn btn-primary" disabled={pending || busy !== null}>
          {pending ? "Saving…" : live ? "Save and keep live" : "Publish"}
        </button>
        <button type="submit" name="intent" value="draft" className="btn btn-secondary" disabled={pending || busy !== null}>
          {live ? "Unpublish (save as draft)" : "Save draft"}
        </button>
      </div>
    </form>
  );
}
