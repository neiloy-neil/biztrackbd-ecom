import { NextResponse, type NextRequest } from "next/server";
import { getBasePrisma, createTenantPrismaClient, type TenantClient } from "@biztrackbd/db";
import {
  authenticateApiKey,
  checkRateLimit,
  rateLimitHeaders,
  hasScope,
  logApiRequest,
  type AuthenticatedApiKeyContext,
  type ApiProblemDetails,
} from "@biztrackbd/core";

export interface ApiAuthSuccess {
  ok: true;
  context: AuthenticatedApiKeyContext;
  rateLimitHeaders: Record<string, string>;
  prisma: TenantClient;
  logResponse: (statusCode: number) => void;
}

export interface ApiAuthFailure {
  ok: false;
  response: NextResponse;
}

export type ApiAuthGuardResult = ApiAuthSuccess | ApiAuthFailure;

/**
 * Authenticates an incoming public developer REST API request.
 * Enforces:
 * 1. Bearer API key validation via SHA-256 hash lookup in PostgreSQL.
 * 2. 120 req/min sliding window rate limiter per tenant.
 * 3. Required permission scope check (e.g. 'products:read', 'orders:write').
 * 4. High-signal audit logging with Bearer tokens stripped.
 */
export async function guardApiRequest(
  req: NextRequest,
  requiredScope?: string
): Promise<ApiAuthGuardResult> {
  const start = Date.now();
  const authHeader = req.headers.get("authorization");
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const endpoint = req.nextUrl.pathname;
  const method = req.method;

  const authResult = await authenticateApiKey(getBasePrisma(), authHeader);

  if (!authResult.authenticated) {
    // Non-blocking log if tenant can be identified, or base log
    return {
      ok: false,
      response: NextResponse.json(authResult.error, {
        status: authResult.statusCode,
        headers: {
          "Content-Type": "application/problem+json",
        },
      }),
    };
  }

  const { context } = authResult;
  const rl = checkRateLimit(context.tenantId, 120);
  const headers = rateLimitHeaders(rl);

  if (!rl.allowed) {
    const error: ApiProblemDetails = {
      type: "https://api.biztrack.bd/errors/rate_limit_exceeded",
      title: "Rate Limit Exceeded",
      status: 429,
      detail: "Rate limit of 120 requests per minute exceeded. Please retry after reset time.",
    };

    logApiRequest(getBasePrisma(), {
      tenantId: context.tenantId,
      apiKeyId: context.apiKeyId,
      keyPrefix: context.keyPrefix,
      endpoint,
      method,
      statusCode: 429,
      ipAddress,
      durationMs: Date.now() - start,
    }).catch(() => {});

    return {
      ok: false,
      response: NextResponse.json(error, {
        status: 429,
        headers: {
          "Content-Type": "application/problem+json",
          ...headers,
        },
      }),
    };
  }

  if (requiredScope && !hasScope(context.scopes, requiredScope)) {
    const error: ApiProblemDetails = {
      type: "https://api.biztrack.bd/errors/forbidden_scope",
      title: "Insufficient Scope Permissions",
      status: 403,
      detail: `This operation requires the '${requiredScope}' permission scope.`,
    };

    logApiRequest(getBasePrisma(), {
      tenantId: context.tenantId,
      apiKeyId: context.apiKeyId,
      keyPrefix: context.keyPrefix,
      endpoint,
      method,
      statusCode: 403,
      ipAddress,
      durationMs: Date.now() - start,
    }).catch(() => {});

    return {
      ok: false,
      response: NextResponse.json(error, {
        status: 403,
        headers: {
          "Content-Type": "application/problem+json",
          ...headers,
        },
      }),
    };
  }

  const tenantPrisma = createTenantPrismaClient(context.tenantId);

  const logResponse = (statusCode: number) => {
    logApiRequest(getBasePrisma(), {
      tenantId: context.tenantId,
      apiKeyId: context.apiKeyId,
      keyPrefix: context.keyPrefix,
      endpoint,
      method,
      statusCode,
      ipAddress,
      durationMs: Date.now() - start,
    }).catch(() => {});
  };

  return {
    ok: true,
    context,
    rateLimitHeaders: headers,
    prisma: tenantPrisma,
    logResponse,
  };
}

/**
 * Standardized JSON success response with rate limiting headers.
 */
export function apiJsonResponse(
  data: unknown,
  status: number = 200,
  extraHeaders?: Record<string, string>
): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(extraHeaders || {}),
    },
  });
}

/**
 * Standardized RFC 7807 problem details error response.
 */
export function apiProblemResponse(
  problem: ApiProblemDetails,
  extraHeaders?: Record<string, string>
): NextResponse {
  return NextResponse.json(problem, {
    status: problem.status,
    headers: {
      "Content-Type": "application/problem+json",
      ...(extraHeaders || {}),
    },
  });
}
