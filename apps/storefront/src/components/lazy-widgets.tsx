"use client";

import dynamic from "next/dynamic";

/**
 * Floating extras that are not needed for the first paint. Loaded as their own chunks after hydration so they stop adding to the
 * JavaScript every store page ships. Both are fixed-position or transient, so appearing a moment later shifts nothing.
 */
export const AiChatWidget = dynamic(() => import("./ai-chat-widget").then((m) => m.AiChatWidget), { ssr: false });
export const SocialProofToasts = dynamic(() => import("./social-proof-toasts").then((m) => m.SocialProofToasts), { ssr: false });
