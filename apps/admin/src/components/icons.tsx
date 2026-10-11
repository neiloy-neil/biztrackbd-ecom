import type { SVGProps } from "react";

const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, width: 22, height: 22 } as const;
type P = SVGProps<SVGSVGElement>;

export const HomeIcon = (p: P) => <svg {...base} {...p}><path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z" /></svg>;
export const OrdersIcon = (p: P) => <svg {...base} {...p}><path d="M6 3h12l2 4v13a1 1 0 01-1 1H5a1 1 0 01-1-1V7zM4 7h16M9 11h6" /></svg>;
export const ProductsIcon = (p: P) => <svg {...base} {...p}><path d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8" /></svg>;
export const CustomersIcon = (p: P) => <svg {...base} {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.5-3.5 3-5.5 6.5-5.5s6 2 6.5 5.5M16 4.5a3.5 3.5 0 010 7M18 14.8c2 .6 3.2 2.3 3.5 5.2" /></svg>;
export const MoreIcon = (p: P) => <svg {...base} {...p}><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></svg>;
export const BoxIcon = (p: P) => <svg {...base} {...p}><path d="M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10" /></svg>;
export const TagIcon = (p: P) => <svg {...base} {...p}><path d="M3 12V4a1 1 0 011-1h8l9 9-9 9zM8 8h.01" /></svg>;
export const ChartIcon = (p: P) => <svg {...base} {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
export const GearIcon = (p: P) => <svg {...base} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>;
export const BoltIcon = (p: P) => <svg {...base} {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>;
export const PlusIcon = (p: P) => <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>;
export const CameraIcon = (p: P) => <svg {...base} {...p}><path d="M4 8h3l2-3h6l2 3h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" /><circle cx="12" cy="13.5" r="3.5" /></svg>;
export const PrintIcon = (p: P) => <svg {...base} {...p}><path d="M7 9V3h10v6M7 17H4a1 1 0 01-1-1v-6a1 1 0 011-1h16a1 1 0 011 1v6a1 1 0 01-1 1h-3M7 14h10v7H7z" /></svg>;
export const SearchIcon = (p: P) => <svg {...base} {...p}><path d="M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4" /></svg>;
export const BellIcon = (p: P) => <svg {...base} {...p}><path d="M6 16v-5a6 6 0 0112 0v5l2 2H4zM10 21h4" /></svg>;
export const ExternalIcon = (p: P) => <svg {...base} {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" /></svg>;
export const ChevronIcon = (p: P) => <svg {...base} {...p}><path d="M6 9l6 6 6-6" /></svg>;
export const StoreIcon = (p: P) => <svg {...base} {...p}><path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0A2.7 2.7 0 0020 9M10 20v-6h4v6" /></svg>;
export const PuzzleIcon = (p: P) => <svg {...base} {...p}><path d="M10 4a2 2 0 114 0v1h4a1 1 0 011 1v4h-1a2 2 0 100 4h1v4a1 1 0 01-1 1h-4v-1a2 2 0 10-4 0v1H6a1 1 0 01-1-1v-4h1a2 2 0 100-4H5V6a1 1 0 011-1h4z" /></svg>;
export const MegaphoneIcon = (p: P) => <svg {...base} {...p}><path d="M3 11v3a1 1 0 001 1h2l3 5h2l-1.5-5H12l8 4V6l-8 4H4a1 1 0 00-1 1z" /></svg>;
