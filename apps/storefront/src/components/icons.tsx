import type { SVGProps } from "react";

const base = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const MenuIcon = (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
export const SearchIcon = (p: SVGProps<SVGSVGElement>) => <svg {...base} width={16} height={16} {...p}><path d="M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4" /></svg>;
export const UserIcon = (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c.5-4 3.5-6 8-6s7.5 2 8 6" /></svg>;
export const CartIcon = (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.5 12h11L21 7H6" /></svg>;
export const CheckIcon = (p: SVGProps<SVGSVGElement>) => <svg {...base} strokeWidth={2.4} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const TruckIcon = (p: SVGProps<SVGSVGElement>) => <svg {...base} width={20} height={20} {...p}><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></svg>;
export const WalletIcon = (p: SVGProps<SVGSVGElement>) => <svg {...base} width={20} height={20} {...p}><path d="M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 7l12-3v3" /><circle cx="16.5" cy="13.5" r="1.2" /></svg>;
export const SwapIcon = (p: SVGProps<SVGSVGElement>) => <svg {...base} width={20} height={20} {...p}><path d="M4 8h14l-3-3M20 16H6l3 3" /></svg>;
export const ChevronDownIcon = (p: SVGProps<SVGSVGElement>) => <svg {...base} width={18} height={18} strokeWidth={2.2} {...p}><path d="M6 9l6 6 6-6" /></svg>;
