/** Errors the storefront and admin can show to a person. `code` is stable for clients; `message` is safe to display. */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus = 400,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("VALIDATION_ERROR", message, 400, details);
  }
}

/** A write that a template demo store (docs/38) refuses: no orders, no SMS codes, no reviews. */
export class DemoStoreError extends DomainError {
  constructor() {
    super("DEMO_STORE", "This is a demo store, so it does not take real orders. Start your own store to sell for real.", 403);
  }
}

/** Something a visitor's demo copy does not allow: changing the account, plan, domains, team or integration keys. */
export class DemoLockedError extends DomainError {
  constructor(what = "This") {
    super("DEMO_LOCKED", `${what} is not available in the demo. Start your free trial to use it for real.`, 403);
  }
}

export class InsufficientStockError extends DomainError {
  constructor(message: string, readonly variantId: string, readonly available: number) {
    super("INSUFFICIENT_STOCK", message, 409, { variantId, available });
  }
}

export class CouponError extends DomainError {
  constructor(message: string) {
    super("COUPON_INVALID", message, 422);
  }
}

export class BlockedCustomerError extends DomainError {
  constructor() {
    // Deliberately vague: do not tell a blocked customer why.
    super("ORDER_NOT_ALLOWED", "We could not place this order. Please call the store.", 403);
  }
}

export class InvalidTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super("INVALID_TRANSITION", `Order cannot move from ${from} to ${to}`, 409, { from, to });
  }
}

export class NotFoundError extends DomainError {
  constructor(what: string) {
    super("NOT_FOUND", `${what} not found`, 404);
  }
}

/** The plan's hard cap on a resource. The UI turns this into the upgrade prompt (AdmLimit). */
export class PlanLimitError extends DomainError {
  constructor(readonly metric: "products" | "staff" | "storage" | "landing pages" | "pages built from sections", readonly limit: number, readonly used: number) {
    super("PLAN_LIMIT", `Your plan allows ${limit} ${metric}. Upgrade to add more.`, 403, { metric, limit, used });
  }
}

export class ForbiddenError extends DomainError {
  constructor() {
    super("FORBIDDEN", "You do not have access to this.", 403);
  }
}

/** A feature the plan does not include (not a numeric limit). The UI turns this into the upgrade prompt. */
export class PlanFeatureError extends DomainError {
  constructor(readonly feature: string) {
    super("PLAN_FEATURE", "Your plan does not include this. Upgrade to use it.", 403, { feature });
  }
}

export class OrderRateLimitError extends DomainError {
  constructor() {
    super("ORDER_RATE_LIMIT", "Too many orders from this number today. Please call the store to place another.", 429);
  }
}

export class StorePausedError extends DomainError {
  constructor() {
    super("STORE_PAUSED", "This store is not taking orders right now. Please check back soon.", 503);
  }
}

export class PaymentMethodUnavailableError extends DomainError {
  constructor(message: string) {
    super("PAYMENT_METHOD_UNAVAILABLE", message, 422, { field: "paymentMethod" });
  }
}

/** A courier refused or failed a call. `message` is safe to show: it never contains keys or tokens. */
export class CourierError extends DomainError {
  constructor(message: string, readonly provider: string, readonly ambiguous = false) {
    super("COURIER_ERROR", message, 502, { provider, ambiguous });
  }
}

/** A webhook that failed its signature check. Answered with 401 and no detail. */
export class WebhookAuthError extends DomainError {
  constructor() {
    super("WEBHOOK_AUTH", "Invalid signature", 401);
  }
}

/** The store is unpaid and read-only, or locked. Reading still works; changes do not. */
export class ReadOnlyError extends DomainError {
  constructor(locked = false) {
    super("READ_ONLY", locked ? "This store is locked until the plan is paid." : "Your store is read-only until the plan is paid. You can still look at everything and download your data.", 403);
  }
}

export class AiQuotaExhaustedError extends DomainError {
  constructor(message = "Monthly AI generation quota reached for your plan. Add your own free Google Gemini API key in Store Settings for unlimited generations.") {
    super("AI_QUOTA_EXHAUSTED", message, 429);
  }
}
