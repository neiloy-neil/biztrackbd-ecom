# BizTrackBD — Documentation Index & Architecture Guide

Welcome to the comprehensive documentation repository for BizTrackBD. Below is the structured index of all architectural specifications, operational playbooks, and strategic master plans.

---

## 1. Platform Strategy & Business Verticals

| Spec | Title | Focus & Scope |
|---|---|---|
| [51-biztrack-business-master-plan.md](file:///d:/AI/biztrackbd%20ecom/docs/51-biztrack-business-master-plan.md) | **BizTrack Business Master Plan** | Multi-mode platform (`ECOMMERCE`, `PORTFOLIO`, `HYBRID`) across 6 launch verticals (Restaurant, Clinic/Doctor, Public Figure, Company, Service Provider, Portfolio). |
| [01-architecture-and-roadmap.md](file:///d:/AI/biztrackbd%20ecom/docs/01-architecture-and-roadmap.md) | Platform Architecture & Roadmap | Monorepo structure, core system topology, and technology choices. |
| [03-competitor-analysis.md](file:///d:/AI/biztrackbd%20ecom/docs/03-competitor-analysis.md) | Competitor & Ecosystem Analysis | Analysis against Shopify, WooCommerce, StoreX, and local Bangladesh platforms. |
| [48-brand-brief-and-discovery-questionnaire.md](file:///d:/AI/biztrackbd%20ecom/docs/48-brand-brief-and-discovery-questionnaire.md) | Brand Brief & Discovery | Brand identity, mission, positioning, and target personas. |
| [49-brand-and-social-marketing-plan.md](file:///d:/AI/biztrackbd%20ecom/docs/49-brand-and-social-marketing-plan.md) | Brand & Social Marketing Plan | Go-to-market marketing strategies, acquisition funnels, and creator partnerships. |
| [50-content-pack-weeks-1-to-4.md](file:///d:/AI/biztrackbd%20ecom/docs/50-content-pack-weeks-1-to-4.md) | Content Pack (Weeks 1 to 4) | High-converting social copy, hooks, and localized Bangla marketing scripts. |

---

## 2. Core Architecture, Data & Security

| Spec | Title | Focus & Scope |
|---|---|---|
| [08-database-schema-and-rls-spec.md](file:///d:/AI/biztrackbd%20ecom/docs/08-database-schema-and-rls-spec.md) | Database Schema & Forced RLS Spec | PostgreSQL relational architecture, tenant isolation, and Row Level Security policies. |
| [13-edge-routing-and-domain-ssl-architecture.md](file:///d:/AI/biztrackbd%20ecom/docs/13-edge-routing-and-domain-ssl-architecture.md) | Edge Routing & Domain SSL | Sub-5ms edge domain routing, proxy middleware, and Vercel Domains verification. |
| [14-seo-performance-and-caching-strategy.md](file:///d:/AI/biztrackbd%20ecom/docs/14-seo-performance-and-caching-strategy.md) | SEO & Caching Strategy | Sub-second Core Web Vitals, dynamic sitemaps, JSON-LD Schema, and AVIF image pipeline. |
| [17-environment-variables-and-configuration.md](file:///d:/AI/biztrackbd%20ecom/docs/17-environment-variables-and-configuration.md) | Environment Variables & Secrets | Production configuration matrix, security guidelines, and deployment variables. |
| [19-disaster-recovery-and-backups.md](file:///d:/AI/biztrackbd%20ecom/docs/19-disaster-recovery-and-backups.md) | Disaster Recovery & Backups | Encrypted nightly database dumps, AES-256-GCM pipelines, and restoration drills. |
| [32-security-review.md](file:///d:/AI/biztrackbd%20ecom/docs/32-security-review.md) | Comprehensive Security Review | Threat modeling, CSV injection protection, bot shielding, and RBAC authorization. |

---

## 3. Storefront, Page Builder & Theme System

| Spec | Title | Focus & Scope |
|---|---|---|
| [06-theme-builder-and-manifest-spec.md](file:///d:/AI/biztrackbd%20ecom/docs/06-theme-builder-and-manifest-spec.md) | Theme Builder & Manifest Spec | Section definitions, JSON AST structure, draft previewing, and version rollback. |
| [09-design-canvas-implementation-guide.md](file:///d:/AI/biztrackbd%20ecom/docs/09-design-canvas-implementation-guide.md) | Design Canvas Guide | Canvas rendering engine and responsive preset specifications. |
| [20-theme-sdk-and-app-marketplace-spec.md](file:///d:/AI/biztrackbd%20ecom/docs/20-theme-sdk-and-app-marketplace-spec.md) | Theme SDK & App Marketplace | App extension architecture and partner integration protocols. |
| [38-template-demo-stores-plan.md](file:///d:/AI/biztrackbd%20ecom/docs/38-template-demo-stores-plan.md) | Demo Stores Plan | Automated seeding and isolated demo environments for starter templates. |
| [46-landing-pages-and-templates-plan.md](file:///d:/AI/biztrackbd%20ecom/docs/46-landing-pages-and-templates-plan.md) | Landing Page Engine | High-converting single-product funnels and order bumps. |
| [47-merchant-theme-builder-plan.md](file:///d:/AI/biztrackbd%20ecom/docs/47-merchant-theme-builder-plan.md) | Merchant Theme Customizer | Visual live-preview editor, color token management, and typography presets. |

---

## 4. Commerce, Couriers & Order Fulfillment

| Spec | Title | Focus & Scope |
|---|---|---|
| [10-courier-and-gateway-integration-protocol.md](file:///d:/AI/biztrackbd%20ecom/docs/10-courier-and-gateway-integration-protocol.md) | Courier & Payment Protocol | Steadfast, RedX, Pathao, Paperfly courier APIs and manual/automated bKash/Nagad flows. |
| [12-operations-fraud-and-abuse-policy.md](file:///d:/AI/biztrackbd%20ecom/docs/12-operations-fraud-and-abuse-policy.md) | Fraud & Abuse Protection | Courier return history checking, customer blacklists, and automated fraud scoring. |
| [27-unified-order-state-machine-and-transaction-safety.md](file:///d:/AI/biztrackbd%20ecom/docs/27-unified-order-state-machine-and-transaction-safety.md) | Order State Machine | ACID order transitions (`PENDING` -> `CONFIRMED` -> `SHIPPED` -> `DELIVERED`), return workflows. |
| [28-commercial-excellence-cod-reconciliation-and-accounting-spec.md](file:///d:/AI/biztrackbd%20ecom/docs/28-commercial-excellence-cod-reconciliation-and-accounting-spec.md) | COD Reconciliation | Courier cash payout matching, discrepancy detection, and profit & loss analytics. |

---

## 5. Marketing, Growth & Automation

| Spec | Title | Focus & Scope |
|---|---|---|
| [18-analytics-and-metrics-aggregation.md](file:///d:/AI/biztrackbd%20ecom/docs/18-analytics-and-metrics-aggregation.md) | Analytics & Metrics | Real-time sales rollups, visitor funnel conversion, and privacy-preserving tracking. |
| [24-ai-copywriter-and-catalog-generator-spec.md](file:///d:/AI/biztrackbd%20ecom/docs/24-ai-copywriter-and-catalog-generator-spec.md) | AI Studio Specification | Bilingual Bengali/English Gemini AI copywriting and page drafting. |
| [25-whatsapp-messenger-chatbot-and-webhook-spec.md](file:///d:/AI/biztrackbd%20ecom/docs/25-whatsapp-messenger-chatbot-and-webhook-spec.md) | WhatsApp Commerce & Bot | Baileys gateway integration, automated order notifications, and quick replies. |
| [26-customer-loyalty-vip-tiers-and-referrals-spec.md](file:///d:/AI/biztrackbd%20ecom/docs/26-customer-loyalty-vip-tiers-and-referrals-spec.md) | Customer Loyalty & Referrals | Points ledger, tiered VIP rewards (Bronze, Silver, Gold, Platinum), and referral tracking. |

---

## 6. Operations, QA & Production Deployment

| Spec | Title | Focus & Scope |
|---|---|---|
| [15-testing-and-qa-strategy.md](file:///d:/AI/biztrackbd%20ecom/docs/15-testing-and-qa-strategy.md) | Testing & QA Strategy | Vitest unit test suite, Playwright desktop/mobile E2E specs, and axe accessibility. |
| [16-step-by-step-implementation-plan.md](file:///d:/AI/biztrackbd%20ecom/docs/16-step-by-step-implementation-plan.md) | Implementation Master Plan | Full chronological record of system phases and verification gates. |
| [21-customer-support-operations-playbook.md](file:///d:/AI/biztrackbd%20ecom/docs/21-customer-support-operations-playbook.md) | Support Operations Playbook | Bilingual merchant help scripts, ticket SLAs, and incident handling. |
| [34-release-hardening-and-free-tier-plan.md](file:///d:/AI/biztrackbd%20ecom/docs/34-release-hardening-and-free-tier-plan.md) | Release Hardening & Deployment | Production infrastructure setup on Vercel, Supabase, and Cloudflare. |
| [35-production-setup-biztrack-bd.md](file:///d:/AI/biztrackbd%20ecom/docs/35-production-setup-biztrack-bd.md) | Production Runbook | Step-by-step DNS, SSL, environment, and migration checklists for live launch. |
| [43-go-live-checklist.md](file:///d:/AI/biztrackbd%20ecom/docs/43-go-live-checklist.md) | Go-Live Release Checklist | 50-point readiness verification before customer onboarding. |

---

## 7. Supporting Folders & Reference Assets

- [docs/assets/](file:///d:/AI/biztrackbd%20ecom/docs/assets/): WebP visual architecture diagrams and UI screenshots.
- [docs/planners/](file:///d:/AI/biztrackbd%20ecom/docs/planners/): Interactive product planning tools (e.g. `portfolio-platform-planner.html`).
- [docs/qa/](file:///d:/AI/biztrackbd%20ecom/docs/qa/): Quality assurance workbooks (`BizTrackBD-QC-QA-Checklist.xlsx`).
- [docs/financials/](file:///d:/AI/biztrackbd%20ecom/docs/financials/): Economic modeling and subscription cost projection models.
- [docs/email-templates/](file:///d:/AI/biztrackbd%20ecom/docs/email-templates/): Production transactional email copies and layouts.
