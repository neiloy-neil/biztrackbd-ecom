"use client";

import { useEffect, useState } from "react";

/** Registers the service worker in production only (in development it would fight with hot reload). */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
  return null;
}

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** "Install app" for browsers that offer it, and plain steps for iPhones (which have no install prompt). */
export function InstallApp() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (installed) return <p className="muted">The app is installed on this device.</p>;
  if (evt) {
    return <button type="button" className="btn btn-primary btn-block" onClick={async () => { await evt.prompt(); await evt.userChoice; setEvt(null); }}>Install the app</button>;
  }
  if (ios) return <p className="muted">On iPhone: tap the Share button, then Add to Home Screen.</p>;
  return <p className="muted">Open this page in Chrome on your phone to install it as an app.</p>;
}
