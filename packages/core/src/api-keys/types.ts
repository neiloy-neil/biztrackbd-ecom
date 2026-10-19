export type ApiKeyEnvironment = "LIVE" | "TEST";

export type ApiKeyScope =
  | "products:read"
  | "products:write"
  | "orders:read"
  | "orders:write"
  | "inventory:update"
  | "customers:read"
  | "webhooks:manage";

export interface ApiScopeDefinition {
  id: ApiKeyScope;
  label: string;
  description: string;
  group: "Catalog" | "Orders & Checkout" | "Inventory" | "Customers" | "Webhooks";
}

export const API_SCOPES: ApiScopeDefinition[] = [
  {
    id: "products:read",
    label: "Read Products",
    description: "Browse product catalog, variants, prices, and categories",
    group: "Catalog",
  },
  {
    id: "products:write",
    label: "Write Products",
    description: "Create, update, and manage product details and media",
    group: "Catalog",
  },
  {
    id: "inventory:update",
    label: "Adjust Inventory",
    description: "Perform batch stock quantity updates across SKUs (ERP sync)",
    group: "Inventory",
  },
  {
    id: "orders:read",
    label: "Read Orders",
    description: "View orders, customer addresses, fulfillment, and payment statuses",
    group: "Orders & Checkout",
  },
  {
    id: "orders:write",
    label: "Create & Manage Orders",
    description: "Place new orders, apply coupons, and update fulfillment",
    group: "Orders & Checkout",
  },
  {
    id: "customers:read",
    label: "Read Customers",
    description: "View customer profiles, order histories, and loyalty points",
    group: "Customers",
  },
  {
    id: "webhooks:manage",
    label: "Manage Webhooks",
    description: "Register and configure event delivery webhooks",
    group: "Webhooks",
  },
];

export interface ApiScopePreset {
  id: string;
  label: string;
  description: string;
  scopes: ApiKeyScope[];
}

export const API_SCOPE_PRESETS: ApiScopePreset[] = [
  {
    id: "full_access",
    label: "Full Access",
    description: "Grants all available permissions across catalog, orders, and inventory",
    scopes: [
      "products:read",
      "products:write",
      "inventory:update",
      "orders:read",
      "orders:write",
      "customers:read",
      "webhooks:manage",
    ],
  },
  {
    id: "erp_inventory_sync",
    label: "ERP & Inventory Sync",
    description: "Designed for ERP connectors (Tally, SAP, Odoo) to read catalog and sync stock levels",
    scopes: ["products:read", "products:write", "inventory:update", "orders:read"],
  },
  {
    id: "order_placement_pos",
    label: "Order Placement / POS",
    description: "Designed for external POS counters, ManyChat bots, or mobile sales apps to place orders",
    scopes: ["products:read", "orders:read", "orders:write"],
  },
  {
    id: "read_only_analytics",
    label: "Read-Only Analytics",
    description: "Permits BI dashboards and accounting sheets to pull sales, orders, and customer data",
    scopes: ["products:read", "orders:read", "customers:read"],
  },
];

export interface ApiProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  invalidParams?: Array<{ name: string; reason: string }>;
}

export interface CreateApiKeyInput {
  tenantId: string;
  name: string;
  environment?: ApiKeyEnvironment;
  scopes: string[];
  expiresAt?: Date | null;
}

export interface CreateApiKeyResult {
  id: string;
  name: string;
  keyPrefix: string;
  token: string; // The plaintext secret token, returned ONLY upon creation
  environment: ApiKeyEnvironment;
  scopes: string[];
  expiresAt: Date | null;
  createdAt: Date;
}

export interface ApiKeyView {
  id: string;
  tenantId: string;
  name: string;
  keyPrefix: string;
  environment: ApiKeyEnvironment;
  scopes: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}

export interface AuthenticatedApiKeyContext {
  tenantId: string;
  apiKeyId: string;
  keyPrefix: string;
  environment: ApiKeyEnvironment;
  scopes: string[];
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix epoch seconds
}
