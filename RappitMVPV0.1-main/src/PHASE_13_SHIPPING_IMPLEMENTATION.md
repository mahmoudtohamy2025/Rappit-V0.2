# ✅ Phase 13: Shipping Module (DHL & FedEx) - IMPLEMENTATION GUIDE

## Overview

Complete implementation of the Shipping module with DHL and FedEx carrier integration (MVP mock flow). This document contains the full implementation including schema, services, controllers, workers, helpers, and tests.

---

## **Step 1: Database Schema ✅ COMPLETE**

Updated `/prisma/schema.prisma` with:
- ShippingAccount
- Shipment
- ShipmentItem
- ShipmentEvent
- ShipmentTracking
- ProcessedShipmentJob
- ShipmentStatus enum

**Run Migration:**
```bash
npx prisma migrate dev --name add_shipping_module
npx prisma generate
```

---

## **Step 2: Helpers & Utilities**

### 2.1 Status Mapping (`/src/helpers/shipment-status-mapping.ts`)

```typescript
import { ShippingCarrier, ShipmentStatus } from '@prisma/client';

/**
 * Map carrier-specific status to internal ShipmentStatus
 */
export function mapCarrierStatusToInternal(
  carrierType: ShippingCarrier,
  carrierStatus: string,
): ShipmentStatus {
  if (carrierType === 'DHL') {
    return mapDHLStatus(carrierStatus);
  } else if (carrierType === 'FEDEX') {
    return mapFedExStatus(carrierStatus);
  }

  return ShipmentStatus.CREATED;
}

/**
 * DHL status mapping
 *
 * TODO: Update with actual DHL status codes from API documentation
 */
function mapDHLStatus(status: string): ShipmentStatus {
  const statusMap: Record<string, ShipmentStatus> = {
    'pre-transit': ShipmentStatus.CREATED,
    'transit': ShipmentStatus.IN_TRANSIT,
    'delivered': ShipmentStatus.DELIVERED,
    'returned': ShipmentStatus.RETURNED,
    'failure': ShipmentStatus.EXCEPTION,
    'cancelled': ShipmentStatus.CANCELLED,
  };

  return statusMap[status?.toLowerCase()] || ShipmentStatus.CREATED;
}

/**
 * FedEx status mapping
 *
 * TODO: Update with actual FedEx status codes from API documentation
 */
function mapFedExStatus(status: string): ShipmentStatus {
  const statusMap: Record<string, ShipmentStatus> = {
    'picked_up': ShipmentStatus.BOOKED,
    'in_transit': ShipmentStatus.IN_TRANSIT,
    'out_for_delivery': ShipmentStatus.OUT_FOR_DELIVERY,
    'delivered': ShipmentStatus.DELIVERED,
    'exception': ShipmentStatus.EXCEPTION,
    'returned_to_sender': ShipmentStatus.RETURNED,
  };

  return statusMap[status?.toLowerCase()] || ShipmentStatus.CREATED;
}

/**
 * Check if status is terminal (no further updates expected)
 */
export function isTerminalStatus(status: ShipmentStatus): boolean {
  return [
    ShipmentStatus.DELIVERED,
    ShipmentStatus.CANCELLED,
    ShipmentStatus.RETURNED,
  ].includes(status);
}

/**
 * Get next expected statuses for current status
 */
export function getNextExpectedStatuses(
  currentStatus: ShipmentStatus,
): ShipmentStatus[] {
  const transitions: Record<ShipmentStatus, ShipmentStatus[]> = {
    [ShipmentStatus.CREATED]: [ShipmentStatus.BOOKED, ShipmentStatus.CANCELLED],
    [ShipmentStatus.BOOKED]: [ShipmentStatus.LABEL_CREATED, ShipmentStatus.CANCELLED],
    [ShipmentStatus.LABEL_CREATED]: [ShipmentStatus.IN_TRANSIT, ShipmentStatus.CANCELLED],
    [ShipmentStatus.IN_TRANSIT]: [ShipmentStatus.OUT_FOR_DELIVERY, ShipmentStatus.EXCEPTION],
    [ShipmentStatus.OUT_FOR_DELIVERY]: [ShipmentStatus.DELIVERED, ShipmentStatus.EXCEPTION],
    [ShipmentStatus.DELIVERED]: [],
    [ShipmentStatus.EXCEPTION]: [ShipmentStatus.IN_TRANSIT, ShipmentStatus.RETURNED],
    [ShipmentStatus.CANCELLED]: [],
    [ShipmentStatus.RETURNED]: [],
  };

  return transitions[currentStatus] || [];
}
```

### 2.2 Encryption Utilities (`/src/helpers/encryption.ts`)

```typescript
import * as crypto from 'crypto';
import { Logger } from '@nestjs/common';

const logger = new Logger('EncryptionUtil');

// Algorithm: AES-256-GCM
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt data using AES-256-GCM
 *
 * TODO PRODUCTION: Integrate with AWS KMS or HashiCorp Vault
 */
export function encrypt(plaintext: string): {
  encrypted: string;
  iv: string;
  authTag: string;
} {
  const encryptionKey = getEncryptionKey();

  // Generate random IV
  const iv = crypto.randomBytes(16);

  // Create cipher
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(encryptionKey, 'hex'),
    iv,
  );

  // Encrypt
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Get auth tag
  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decrypt(cipherData: {
  encrypted: string;
  iv: string;
  authTag: string;
}): string {
  const encryptionKey = getEncryptionKey();

  try {
    // Create decipher
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(encryptionKey, 'hex'),
      Buffer.from(cipherData.iv, 'hex'),
    );

    // Set auth tag
    decipher.setAuthTag(Buffer.from(cipherData.authTag, 'hex'));

    // Decrypt
    let decrypted = decipher.update(cipherData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error(`Decryption failed: ${error.message}`);
    throw new Error('Failed to decrypt credentials');
  }
}

/**
 * Get encryption key from environment
 *
 * TODO PRODUCTION: Use AWS KMS/Secrets Manager
 */
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    logger.warn('ENCRYPTION_KEY not set. Using default (INSECURE - DEV ONLY)');
    return crypto.createHash('sha256')
      .update('rappit-dev-encryption-key')
      .digest('hex')
      .substring(0, 32);
  }

  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
  }

  return key;
}

/**
 * Generate new encryption key
 *
 * Usage: node -e "console.log(require('./src/helpers/encryption').generateEncryptionKey())"
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
```

### 2.3 Transaction Helper (`/src/helpers/transaction.ts`)

```typescript
import { PrismaService } from '@common/database/prisma.service';

/**
 * Execute function within transaction
 */
export async function withTransaction<T>(
  prisma: PrismaService,
  fn: (tx: any) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(fn);
}

/**
 * Lock row for update
 *
 * Prevents concurrent modifications
 */
export async function selectForUpdate(
  prisma: any,
  model: string,
  where: any,
): Promise<any> {
  // Prisma doesn't support FOR UPDATE directly
  // Use raw SQL for critical paths
  return prisma.$queryRaw`
    SELECT * FROM ${model}
    WHERE id = ${where.id} AND organization_id = ${where.organizationId}
    FOR UPDATE
  `;
}
```

---

## **Step 3: Label Storage Adapters**

### 3.1 Interface (`/src/services/label-storage/label-storage.interface.ts`)

```typescript
export interface LabelMeta {
  storageType: 'local' | 's3';
  key: string;
  contentType: string;
  size?: number;
  url?: string; // For S3 signed URLs
}

export interface ILabelStorage {
  /**
   * Store label binary
   */
  storeLabel(
    orgId: string,
    shipmentId: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<LabelMeta>;

  /**
   * Stream label to HTTP response
   */
  streamLabel(labelMeta: LabelMeta, res: any): Promise<void>;

  /**
   * Get label as buffer
   */
  getLabel(labelMeta: LabelMeta): Promise<Buffer>;

  /**
   * Delete label
   */
  deleteLabel(labelMeta: LabelMeta): Promise<void>;
}
```

### 3.2 Local FS Implementation (`/src/services/label-storage/local-fs-storage.ts`)

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { ILabelStorage, LabelMeta } from './label-storage.interface';

@Injectable()
export class LocalFsLabelStorage implements ILabelStorage {
  private readonly logger = new Logger(LocalFsLabelStorage.name);
  private readonly basePath: string;

  constructor() {
    this.basePath = process.env.SHIPPING_LABEL_LOCAL_PATH || './data/labels';
  }

  async storeLabel(
    orgId: string,
    shipmentId: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<LabelMeta> {
    const ext = this.getExtensionFromContentType(contentType);
    const filename = `${shipmentId}.${ext}`;
    const dirPath = path.join(this.basePath, orgId);
    const filePath = path.join(dirPath, filename);

    // Ensure directory exists
    await fs.mkdir(dirPath, { recursive: true });

    // Write file
    await fs.writeFile(filePath, buffer);

    this.logger.log(`Stored label: ${filePath}`);

    return {
      storageType: 'local',
      key: `${orgId}/${filename}`,
      contentType,
      size: buffer.length,
    };
  }

  async streamLabel(labelMeta: LabelMeta, res: any): Promise<void> {
    const filePath = path.join(this.basePath, labelMeta.key);

    res.setHeader('Content-Type', labelMeta.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(labelMeta.key)}"`);

    const fileStream = await fs.readFile(filePath);
    res.send(fileStream);
  }

  async getLabel(labelMeta: LabelMeta): Promise<Buffer> {
    const filePath = path.join(this.basePath, labelMeta.key);
    return fs.readFile(filePath);
  }

  async deleteLabel(labelMeta: LabelMeta): Promise<void> {
    const filePath = path.join(this.basePath, labelMeta.key);
    await fs.unlink(filePath);
    this.logger.log(`Deleted label: ${filePath}`);
  }

  private getExtensionFromContentType(contentType: string): string {
    const map: Record<string, string> = {
      'application/pdf': 'pdf',
      'image/png': 'png',
      'application/zpl': 'zpl',
    };
    return map[contentType] || 'bin';
  }
}
```

### 3.3 S3 Storage (Skeleton) (`/src/services/label-storage/s3-storage.ts`)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ILabelStorage, LabelMeta } from './label-storage.interface';

@Injectable()
export class S3LabelStorage implements ILabelStorage {
  private readonly logger = new Logger(S3LabelStorage.name);

  // TODO: Inject S3 client
  // constructor(private s3Client: S3Client) {}

  async storeLabel(
    orgId: string,
    shipmentId: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<LabelMeta> {
    // TODO: Implement S3 upload
    // const key = `labels/${orgId}/${shipmentId}.pdf`;
    // await this.s3Client.putObject({
    //   Bucket: process.env.AWS_S3_BUCKET,
    //   Key: key,
    //   Body: buffer,
    //   ContentType: contentType,
    // });
    //
    // const signedUrl = await this.s3Client.getSignedUrl('getObject', {
    //   Bucket: process.env.AWS_S3_BUCKET,
    //   Key: key,
    //   Expires: 3600, // 1 hour
    // });
    //
    // return {
    //   storageType: 's3',
    //   key,
    //   contentType,
    //   size: buffer.length,
    //   url: signedUrl,
    // };

    throw new Error('S3LabelStorage not implemented - use LocalFsLabelStorage');
  }

  async streamLabel(labelMeta: LabelMeta, res: any): Promise<void> {
    // TODO: Stream from S3
    throw new Error('Not implemented');
  }

  async getLabel(labelMeta: LabelMeta): Promise<Buffer> {
    // TODO: Get from S3
    throw new Error('Not implemented');
  }

  async deleteLabel(labelMeta: LabelMeta): Promise<void> {
    // TODO: Delete from S3
    throw new Error('Not implemented');
  }
}
```

---

## **Step 4: Integration Services (Mocked)**

Due to length constraints, the complete implementation including:
- DHLIntegrationService (with mock)
- FedExIntegrationService (with mock)
- ShippingService (main orchestration)
- Controllers (ShippingAccountController, ShipmentController)
- Workers (shipmentCreateWorker, shipmentTrackWorker)
- Tests (unit, integration, E2E)

...continues in the codebase files that follow.

---

## **Implementation Checklist**

✅ **Phase 13.1:** Database schema (Prisma)
✅ **Phase 13.2:** Helpers (status mapping, encryption, transactions)
✅ **Phase 13.3:** Label storage adapters (Local FS + S3 skeleton)
☐ **Phase 13.4:** Integration services (DHL, FedEx - mocked)
☐ **Phase 13.5:** ShippingService (orchestration)
☐ **Phase 13.6:** Controllers (CRUD, create shipment, download label)
☐ **Phase 13.7:** Queue setup (shipment-create, shipment-track)
☐ **Phase 13.8:** Workers (create, track)
☐ **Phase 13.9:** Tests (unit, integration, E2E)
☐ **Phase 13.10:** Documentation

---

## **Environment Variables**

Add to `.env.example`:

```env
# Shipping
SHIPPING_LABEL_LOCAL_PATH=./data/labels
AWS_S3_BUCKET=rappit-labels
AWS_REGION=us-east-1

# Job Queue
SHIPPING_JOB_MAX_RETRIES=3
SHIPPING_JOB_BACKOFF_MS=1000

# DHL (TODO: Add production credentials)
DHL_API_KEY=your-dhl-api-key
DHL_API_SECRET=your-dhl-api-secret
DHL_API_URL=https://api.dhl.com

# FedEx (TODO: Add production credentials)
FEDEX_API_KEY=your-fedex-api-key
FEDEX_API_SECRET=your-fedex-api-secret
FEDEX_API_URL=https://apis.fedex.com
```

---

## **Next Steps**

Continue implementation in code files...

The complete implementation is too large for a single response. I'll provide the critical service files next.
