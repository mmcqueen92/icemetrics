import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { PayloadStatus, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { ProviderFetch } from '../providers/provider.types.js';

export interface StoredProviderPayload {
  body: Uint8Array;
  contentType: string | null;
  externalKey: string;
  fetchedAt: Date;
  httpStatus: number;
  id: string;
  parameters: Readonly<Record<string, string>>;
  path: string;
  provider: string;
  resourceType: string;
  status: PayloadStatus;
}

@Injectable()
export class RawPayloadService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async store(
    fetch: ProviderFetch<unknown>,
    jobExecutionId: string,
  ): Promise<{ created: boolean; payload: StoredProviderPayload }> {
    const bodyText = new TextDecoder().decode(fetch.body);
    const parsed = tryParseJson(bodyText);
    const checksum = createHash('sha256').update(fetch.body).digest('hex');
    const identity = {
      provider: fetch.provider,
      resourceType: fetch.descriptor.resourceType,
      externalKey: fetch.descriptor.externalKey,
      checksum,
    };
    const existing = await this.prisma.providerPayload.findUnique({
      where: {
        provider_resourceType_externalKey_checksum: identity,
      },
    });
    if (existing) {
      return { created: false, payload: mapStoredPayload(existing) };
    }

    try {
      const created = await this.prisma.providerPayload.create({
        data: {
          ...identity,
          bodyText: parsed.success ? null : bodyText,
          contentType: fetch.contentType,
          fetchedAt: fetch.fetchedAt,
          httpStatus: fetch.httpStatus,
          jobExecutionId,
          payload: parsed.success ? parsed.value : Prisma.DbNull,
          requestParameters: fetch.descriptor.parameters,
          requestPath: fetch.descriptor.path,
        },
      });
      return { created: true, payload: mapStoredPayload(created) };
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
      const raced = await this.prisma.providerPayload.findUniqueOrThrow({
        where: {
          provider_resourceType_externalKey_checksum: identity,
        },
      });
      return { created: false, payload: mapStoredPayload(raced) };
    }
  }

  async get(payloadId: string): Promise<StoredProviderPayload | null> {
    const payload = await this.prisma.providerPayload.findUnique({
      where: { id: payloadId },
    });
    return payload ? mapStoredPayload(payload) : null;
  }

  async markValidated(payloadId: string): Promise<void> {
    await this.prisma.providerPayload.updateMany({
      data: { status: PayloadStatus.VALIDATED },
      where: {
        id: payloadId,
        status: { in: [PayloadStatus.FETCHED, PayloadStatus.REJECTED] },
      },
    });
  }

  async markProcessed(payloadId: string): Promise<void> {
    await this.prisma.providerPayload.update({
      data: {
        processedAt: new Date(),
        status: PayloadStatus.PROCESSED,
      },
      where: { id: payloadId },
    });
  }

  async markRejected(payloadId: string): Promise<void> {
    await this.prisma.providerPayload.update({
      data: {
        processedAt: null,
        status: PayloadStatus.REJECTED,
      },
      where: { id: payloadId },
    });
  }
}

function tryParseJson(
  value: string,
): { success: true; value: Prisma.InputJsonValue } | { success: false } {
  try {
    return {
      success: true,
      value: JSON.parse(value) as Prisma.InputJsonValue,
    };
  } catch {
    return { success: false };
  }
}

function mapStoredPayload(payload: {
  bodyText: string | null;
  contentType: string | null;
  externalKey: string;
  fetchedAt: Date;
  httpStatus: number;
  id: string;
  payload: Prisma.JsonValue | null;
  provider: string;
  requestParameters: Prisma.JsonValue;
  requestPath: string;
  resourceType: string;
  status: PayloadStatus;
}): StoredProviderPayload {
  const body =
    payload.bodyText === null
      ? JSON.stringify(payload.payload)
      : payload.bodyText;
  return {
    body: new TextEncoder().encode(body),
    contentType: payload.contentType,
    externalKey: payload.externalKey,
    fetchedAt: payload.fetchedAt,
    httpStatus: payload.httpStatus,
    id: payload.id,
    parameters: jsonStringRecord(payload.requestParameters),
    path: payload.requestPath,
    provider: payload.provider,
    resourceType: payload.resourceType,
    status: payload.status,
  };
}

function jsonStringRecord(
  value: Prisma.JsonValue,
): Readonly<Record<string, string>> {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      )
      .map(([key, entryValue]) => [key, entryValue]),
  );
}

function isUniqueConstraintError(error: unknown): error is { code: 'P2002' } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
