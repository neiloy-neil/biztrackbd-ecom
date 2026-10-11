import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "BizTrackBD Admin",
    short_name: "BizTrack",
    description: "Run your store: orders, payments, products and customers.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FAFAFC",
    theme_color: "#5B4FE8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New order", url: "/orders/new", description: "Key in an order from Messenger, WhatsApp or the phone" },
      { name: "Payments to check", url: "/orders?tab=check", description: "bKash and Nagad payments waiting for you" },
    ],
  };
}
