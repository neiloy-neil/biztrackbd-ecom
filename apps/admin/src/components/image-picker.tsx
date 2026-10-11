"use client";

import { useEffect, useId, useRef, useState } from "react";

const ASPECTS: { key: string; label: string; ratio: number | null }[] = [
  { key: "free", label: "Keep original", ratio: null },
  { key: "1:1", label: "Square", ratio: 1 },
  { key: "4:3", label: "Wide 4:3", ratio: 4 / 3 },
  { key: "16:9", label: "Banner 16:9", ratio: 16 / 9 },
  { key: "3:4", label: "Tall 3:4", ratio: 3 / 4 },
];
const OUT_LONG_EDGE = 1600;

/**
 * Choose a picture, crop it, and upload it as WebP. The crop happens in the browser (zoom and position, with a fixed shape
 * to pick from), and the server stores and resizes it again, so a huge phone photo never reaches the store as is.
 */
export function ImagePicker({ label, value, onChange, disabled }: { label: string; value: string; onChange: (url: string) => void; disabled?: boolean }) {
  const id = useId();
  const dlg = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [src, setSrc] = useState<HTMLImageElement | null>(null);
  const [aspect, setAspect] = useState("4:3");
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The crop window in source pixels for the current shape, zoom and position.
  function windowOf(img: HTMLImageElement) {
    const ratio = ASPECTS.find((a) => a.key === aspect)?.ratio ?? img.naturalWidth / img.naturalHeight;
    let w = img.naturalWidth, h = w / ratio;
    if (h > img.naturalHeight) { h = img.naturalHeight; w = h * ratio; }
    w /= zoom; h /= zoom;
    const sx = (img.naturalWidth - w) * (x / 100);
    const sy = (img.naturalHeight - h) * (y / 100);
    return { sx, sy, w, h };
  }

  useEffect(() => {
    if (!src || !canvas.current) return;
    const { sx, sy, w, h } = windowOf(src);
    const c = canvas.current;
    const scale = 320 / Math.max(w, h);
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    c.getContext("2d")?.drawImage(src, sx, sy, w, h, 0, 0, c.width, c.height);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, aspect, zoom, x, y]);

  function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Choose a picture (JPG, PNG or WebP).");
    if (file.size > 8 * 1024 * 1024) return setError("That picture is too large. Use one under 8 MB.");
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      setZoom(1); setX(50); setY(50);
      setSrc(img);
      dlg.current?.showModal();
    };
    img.onerror = () => { URL.revokeObjectURL(url); setError("We could not open that picture."); };
    img.src = url;
  }

  async function use() {
    if (!src) return;
    setBusy(true);
    setError(null);
    try {
      const { sx, sy, w, h } = windowOf(src);
      const k = Math.min(1, OUT_LONG_EDGE / Math.max(w, h));
      const out = document.createElement("canvas");
      out.width = Math.round(w * k);
      out.height = Math.round(h * k);
      out.getContext("2d")?.drawImage(src, sx, sy, w, h, 0, 0, out.width, out.height);
      const blob = await new Promise<Blob | null>((r) => out.toBlob(r, "image/webp", 0.86));
      if (!blob) throw new Error("This browser could not prepare the picture.");
      const fd = new FormData();
      fd.append("file", new File([blob], "picture.webp", { type: "image/webp" }));
      const res = await fetch("/api/media", { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "The upload failed. Try again.");
      onChange(json.url);
      dlg.current?.close();
      setSrc(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 6 }}>
      <span className="label" id={`${id}-l`}>{label}</span>
      <div className="row" style={{ alignItems: "center", gap: 10 }}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" width={64} height={64} style={{ objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }} />
        ) : (
          <span className="muted" style={{ fontSize: 13 }}>No picture</span>
        )}
        <label className="btn btn-secondary btn-sm" style={{ cursor: disabled ? "not-allowed" : "pointer" }}>
          {value ? "Change" : "Choose picture"}
          <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={disabled} aria-labelledby={`${id}-l`} data-testid="image-file" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {value && !disabled && <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange("")}>Remove</button>}
      </div>
      {error && !src && <p className="err" role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}

      <dialog ref={dlg} aria-labelledby={`${id}-t`} className="crop-dialog" onClose={() => setSrc(null)}>
        <h2 id={`${id}-t`} style={{ fontSize: 18 }}>Crop your picture</h2>
        <div style={{ display: "grid", placeItems: "center", background: "var(--bg)", borderRadius: 8, padding: 10, margin: "10px 0" }}>
          <canvas ref={canvas} aria-label="Preview of the cropped picture" style={{ maxWidth: "100%", height: "auto" }} />
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <label className="field" style={{ margin: 0 }}><span className="label">Shape</span>
            <select className="select" value={aspect} onChange={(e) => setAspect(e.target.value)}>{ASPECTS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}</select>
          </label>
          <label className="field" style={{ margin: 0 }}><span className="label">Zoom</span><input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ width: "100%" }} /></label>
          <label className="field" style={{ margin: 0 }}><span className="label">Move left or right</span><input type="range" min={0} max={100} value={x} onChange={(e) => setX(Number(e.target.value))} style={{ width: "100%" }} /></label>
          <label className="field" style={{ margin: 0 }}><span className="label">Move up or down</span><input type="range" min={0} max={100} value={y} onChange={(e) => setY(Number(e.target.value))} style={{ width: "100%" }} /></label>
        </div>
        {error && <p role="alert" style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{error}</p>}
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
          <button type="button" className="btn btn-secondary" onClick={() => dlg.current?.close()} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={use} disabled={busy} data-testid="crop-use">{busy ? "Uploading…" : "Use this picture"}</button>
        </div>
      </dialog>
    </div>
  );
}
