import type { PrismaClient } from "@biztrackbd/db";
import { generateApiKey, hashApiKey } from "./crypto";
import type {
  ApiKeyEnvironment,
  ApiKeyView,
  ApiProblemDetails,
  AuthenticatedApiKeyContext,
  CreateApiKeyInput,
  CreateApiKeyResult,
} from "./types";

export type AuthResult =
  | { authenticated: true; context: AuthenticatedApiKeyContext }
  | { authenticated: false; error: ApiProblemDetails; statusCode: number };

/**
 * Creates a new API key for a tenant, storing its irreversible SHA-256 hash
 * and returning the plaintext secret token exactly once.
 */
export async function createApiKey(
  prisma: PrismaClient,
  input: CreateApiKeyInput
): Promise<CreateApiKeyResult> {
  const env: ApiKeyEnvironment = input.environment === "TEST" ? "TEST" : "LIVE";
  const generated = generateApiKey(env);

  const created = await prisma.apiKeyCredential.create({
    data: {
      tenantId: input.tenantId,
      name: input.name.trim(),
      keyPrefix: generated.keyPrefix,
      hashedToken: generated.hashedToken,
      environment: generated.environment,
      scopes: input.scopes,
      expiresAt: input.expiresAt || null,
      isActive: true,
    },
  });

  return {
    id: created.id,
    name: created.name,
    keyPrefix: created.keyPrefix,
    token: generated.token, // ONE-TIME REVEAL
    environment: created.environment as ApiKeyEnvironment,
    scopes: created.scopes,
    expiresAt: created.expiresAt,
    createdAt: created.createdAt,
  };
}

/**
 * Lists all API keys associated with a tenant.
 */
export async function listApiKeys(
  prisma: PrismaClient,
  tenantId: string
): Promise<ApiKeyView[]> {
  const keys = await prisma.apiKeyCredential.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });

  return keys.map((k) => ({
    id: k.id,
    tenantId: k.tenantId,
    name: k.name,
    keyPrefix: k.keyPrefix,
    environment: (k.environment || "LIVE") as ApiKeyEnvironment,
    scopes: k.scopes,
    lastUsedAt: k.lastUsedAt,
    expiresAt: k.expiresAt,
    revokedAt: k.revokedAt,
    isActive: k.isActive,
    createdAt: k.createdAt,
  }));
}

/**
 * Revokes an API key, preventing any future authentications.
 */
export async function revokeApiKey(
  prisma: PrismaClient,
  tenantId: string,
  apiKeyId: string
): Promise<boolean> {
  const updated = await prisma.apiKeyCredential.updateMany({
    where: { id: apiKeyId, tenantId },
    data: {
      isActive: false,
      revokedAt: new Date(),
    },
  });

  return updated.count > 0;
}

/**
 * Permanently deletes an API key credential.
 */
export async function deleteApiKey(
  prisma: PrismaClient,
  tenantId: string,
  apiKeyId: string
): Promise<boolean> {
  const deleted = await prisma.apiKeyCredential.deleteMany({
    where: { id: apiKeyId, tenantId },
  });

  return deleted.count > 0;
}

/**
 * Authenticates an incoming public API request by resolving its Bearer token.
 * Hashes the token using SHA-256 and retrieves the matching tenant & scopes in O(1) time.
 */
export async function authenticateApiKey(
  prisma: PrismaClient,
  authHeader: string | null | undefined
): Promise<AuthResult> {
  if (!authHeader || typeof authHeader !== "string") {
    return {
      authenticated: false,
      statusCode: 401,
      error: {
        type: "https://api.biztrack.bd/errors/unauthorized",
        title: "Missing Authorization Header",
        status: 401,
        detail: "Requests must include an 'Authorization: Bearer <token>' header.",
      },
    };
  }

  const parts = authHeader.trim().split(/\s+/);
  const scheme = parts[0];
  const token = parts[1];
  if (parts.length !== 2 || !scheme || !token || scheme.toLowerCase() !== "bearer") {
    return {
      authenticated: false,
      statusCode: 401,
      error: {
        type: "https://api.biztrack.bd/errors/invalid_auth_header",
        title: "Invalid Authorization Scheme",
        status: 401,
        detail: "Authorization header must use the format 'Bearer <token>'.",
      },
    };
  }

  if (!token.startsWith("bzk_live_") && !token.startsWith("bzk_test_")) {
    return {
      authenticated: false,
      statusCode: 401,
      error: {
        type: "https://api.biztrack.bd/errors/invalid_key_prefix",
        title: "Invalid API Key Prefix",
        status: 401,
        detail: "API keys must begin with 'bzk_live_' or 'bzk_test_'.",
      },
    };
  }

  const hashedToken = hashApiKey(token);

  const credential = await prisma.apiKeyCredential.findUnique({
    where: { hashedToken },
  });

  if (!credential) {
    return {
      authenticated: false,
      statusCode: 401,
      error: {
        type: "https://api.biztrack.bd/errors/invalid_key",
        title: "Invalid API Key",
        status: 401,
        detail: "The provided API key does not exist or has been deleted.",
      },
    };
  }

  if (!credential.isActive) {
    return {
      authenticated: false,
      statusCode: 403,
      error: {
        type: "https://api.biztrack.bd/errors/revoked_key",
        title: "Revoked API Key",
        status: 403,
        detail: "This API key has been revoked and can no longer be used.",
      },
    };
  }

  if (credential.expiresAt && credential.expiresAt.getTime() < Date.now()) {
    return {
      authenticated: false,
      statusCode: 403,
      error: {
        type: "https://api.biztrack.bd/errors/expired_key",
        title: "Expired API Key",
        status: 403,
        detail: "This API key has expired.",
      },
    };
  }

  // Update lastUsedAt asynchronously without blocking request pipeline
  prisma.apiKeyCredential
    .update({
      where: { id: credential.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});

  return {
    authenticated: true,
    context: {
      tenantId: credential.tenantId,
      apiKeyId: credential.id,
      keyPrefix: credential.keyPrefix,
      environment: (credential.environment || "LIVE") as ApiKeyEnvironment,
      scopes: credential.scopes,
    },
  };
}

/**
 * Checks whether an authenticated context possesses the required scope.
 */
export function hasScope(scopes: string[], requiredScope: string): boolean {
  return scopes.includes(requiredScope);
}

/**
 * Logs an API request into the audit table.
 */
export async function logApiRequest(
  prisma: PrismaClient,
  data: {
    tenantId: string;
    apiKeyId?: string | null;
    keyPrefix?: string | null;
    endpoint: string;
    method: string;
    statusCode: number;
    ipAddress?: string | null;
    durationMs: number;
  }
): Promise<void> {
  try {
    await prisma.apiRequestLog.create({
      data: {
        tenantId: data.tenantId,
        apiKeyId: data.apiKeyId || null,
        keyPrefix: data.keyPrefix || null,
        endpoint: data.endpoint,
        method: data.method.toUpperCase(),
        statusCode: data.statusCode,
        ipAddress: data.ipAddress || null,
        durationMs: data.durationMs,
      },
    });
  } catch {
    // Non-fatal logging failure
  }
}

/**
 * Lists recent API request logs for a tenant.
 */
export async function listApiRequestLogs(
  prisma: PrismaClient,
  tenantId: string,
  limit: number = 50
) {
  return prisma.apiRequestLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
