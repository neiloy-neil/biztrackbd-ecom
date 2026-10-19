import type { PrismaClient } from "@biztrackbd/db";

export interface IdempotencyCheckResult {
  cached: boolean;
  statusCode?: number;
  body?: unknown;
}

/**
 * Checks if an idempotent request was previously processed within the 24-hour TTL window.
 */
export async function checkIdempotency(
  prisma: PrismaClient,
  tenantId: string,
  idempotencyKey: string,
  endpoint: string
): Promise<IdempotencyCheckResult> {
  if (!idempotencyKey || typeof idempotencyKey !== "string") {
    return { cached: false };
  }

  const trimmedKey = idempotencyKey.trim();
  if (!trimmedKey) {
    return { cached: false };
  }

  const record = await prisma.apiIdempotencyRecord.findUnique({
    where: {
      tenantId_idempotencyKey: {
        tenantId,
        idempotencyKey: trimmedKey,
      },
    },
  });

  if (!record) {
    return { cached: false };
  }

  // If expired, consider cache miss and cleanup asynchronously
  if (record.expiresAt.getTime() <= Date.now()) {
    prisma.apiIdempotencyRecord
      .delete({ where: { id: record.id } })
      .catch(() => {});
    return { cached: false };
  }

  try {
    const parsedBody = JSON.parse(record.responseBody);
    return {
      cached: true,
      statusCode: record.statusCode,
      body: parsedBody,
    };
  } catch {
    return {
      cached: true,
      statusCode: record.statusCode,
      body: record.responseBody,
    };
  }
}

/**
 * Stores the response of a successful or processed mutating request for replay prevention.
 */
export async function recordIdempotency(
  prisma: PrismaClient,
  tenantId: string,
  idempotencyKey: string,
  endpoint: string,
  statusCode: number,
  responseBody: unknown,
  ttlHours: number = 24
): Promise<void> {
  if (!idempotencyKey || typeof idempotencyKey !== "string") {
    return;
  }

  const trimmedKey = idempotencyKey.trim();
  if (!trimmedKey) {
    return;
  }

  const serializedBody =
    typeof responseBody === "string"
      ? responseBody
      : JSON.stringify(responseBody);

  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  await prisma.apiIdempotencyRecord.upsert({
    where: {
      tenantId_idempotencyKey: {
        tenantId,
        idempotencyKey: trimmedKey,
      },
    },
    create: {
      tenantId,
      idempotencyKey: trimmedKey,
      endpoint,
      statusCode,
      responseBody: serializedBody,
      expiresAt,
    },
    update: {
      statusCode,
      responseBody: serializedBody,
      expiresAt,
    },
  });
}
