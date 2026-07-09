// src/services/archiveService.js
// GoBD-konforme Archivierung (§147 AO — 10 Jahre Aufbewahrung)
// Production: AWS S3 eu-central-1 (Frankfurt)

import { createHash } from 'crypto';
import { db } from '../config/db.js';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

// ── AWS S3 (Frankfurt, GoBD 10-Jahres-Aufbewahrung §147 AO) ────
// WICHTIG: GoBD verlangt revisionssichere Archivierung über 10 Jahre.
// Ein In-Memory-Mock überlebt keinen Prozess-Neustart/Deploy und ist
// damit für Production untauglich — ohne vollständige AWS-Konfiguration
// darf der Prozess nicht starten.
const requiredEnv = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'AWS_S3_BUCKET'];
const missingEnv = requiredEnv.filter(k => !process.env[k]);
const hasS3 = missingEnv.length === 0;

if (!hasS3 && process.env.NODE_ENV === 'production') {
  console.error(`[archiveService] FATAL: Fehlende AWS-S3-Umgebungsvariablen: ${missingEnv.join(', ')}. GoBD-Archivierung erfordert echtes S3 — siehe .env.example.`);
  process.exit(1);
}

let s3;
if (hasS3) {
  const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  // Dünner Adapter, damit der Rest der Datei mit den bisherigen
  // putObject/getObject/headObject-Aufrufen weiterarbeiten kann.
  s3 = {
    async putObject({ Bucket, Key, Body, Metadata, ServerSideEncryption }) {
      const res = await s3Client.send(new PutObjectCommand({
        Bucket, Key, Body, Metadata, ServerSideEncryption,
      }));
      return { ETag: res.ETag };
    },
    async getObject({ Bucket, Key }) {
      const res = await s3Client.send(new GetObjectCommand({ Bucket, Key }));
      const body = await res.Body.transformToString('utf-8');
      return { Body: body, Metadata: res.Metadata };
    },
    async headObject({ Bucket, Key }) {
      const res = await s3Client.send(new HeadObjectCommand({ Bucket, Key }));
      return { ContentLength: res.ContentLength, Metadata: res.Metadata };
    },
  };
} else {
  // NUR dev/test: In-Memory-Store, damit die App lokal ohne AWS-Zugang
  // startbar und testbar bleibt. In production ist dieser Pfad durch den
  // process.exit oben ausgeschlossen — GoBD verlangt echtes S3.
  console.warn('[archiveService] WARNUNG: AWS S3 nicht konfiguriert — In-Memory-Archiv (NUR dev/test, überlebt keinen Neustart).');
  const memStore = new Map();
  s3 = {
    async putObject({ Bucket, Key, Body, Metadata }) {
      memStore.set(`${Bucket}/${Key}`, { Body, Metadata });
      return { ETag: 'dev' };
    },
    async getObject({ Bucket, Key }) {
      const obj = memStore.get(`${Bucket}/${Key}`);
      if (!obj) throw new Error(`NoSuchKey: ${Key}`);
      return obj;
    },
    async headObject({ Bucket, Key }) {
      const obj = memStore.get(`${Bucket}/${Key}`);
      if (!obj) throw new Error(`NoSuchKey: ${Key}`);
      return { ContentLength: obj.Body.length, Metadata: obj.Metadata };
    },
  };
}

// ── ARCHIVE SERVICE ───────────────────────────────────────────
export const archiveService = {

  /**
   * Archive a document — GoBD compliant
   * - Immutable storage (no modification after archiving)
   * - SHA-256 hash for integrity verification
   * - 10-year retention (§147 AO)
   * - Audit log entry
   */
  async archiveDocument({ orgId, invoiceId, xml, format, invoiceNumber }) {
    const timestamp = new Date().toISOString();
    const year = new Date().getFullYear();
    const fileHash = createHash('sha256').update(xml, 'utf8').digest('hex');
    const s3Key = `orgs/${orgId}/invoices/${year}/${invoiceId}/${invoiceNumber}.xml`;
    const retentionUntil = new Date();
    retentionUntil.setFullYear(retentionUntil.getFullYear() + 10);

    // Upload to S3 with metadata
    await s3.putObject({
      Bucket: process.env.AWS_S3_BUCKET || 'invoiq-archive-dev',
      Key: s3Key,
      Body: xml,
      ServerSideEncryption: 'AES256',
      Metadata: {
        'invoice-id': invoiceId,
        'org-id': orgId,
        'invoice-number': invoiceNumber,
        'format': format,
        'sha256': fileHash,
        'archived-at': timestamp,
        'retention-until': retentionUntil.toISOString(),
        'gobd-compliant': 'true',
        'en16931': 'true',
      }
    });

    // Store archive record in DB
    const record = await db.createArchiveRecord({
      org_id: orgId,
      invoice_id: invoiceId,
      s3_key: s3Key,
      s3_bucket: process.env.AWS_S3_BUCKET || 'invoiq-archive-dev',
      file_hash: fileHash,
      file_size: xml.length,
      content_type: 'application/xml',
      retention_until: retentionUntil.toISOString().split('T')[0],
      immutable: true,
    });

    // Audit log
    await db.createAuditLog({
      org_id: orgId,
      invoice_id: invoiceId,
      action: 'archived',
      details: {
        s3_key: s3Key,
        file_hash: fileHash,
        format,
        retention_until: retentionUntil.toISOString().split('T')[0],
        gobd: true,
      }
    });

    return {
      archive_id: record.id,
      s3_key: s3Key,
      file_hash: fileHash,
      retention_until: retentionUntil.toISOString().split('T')[0],
      archived_at: timestamp,
    };
  },

  /**
   * Retrieve archived document + verify integrity
   */
  async retrieveDocument(orgId, invoiceId) {
    const records = await db.findArchiveRecords(orgId);
    const record = records.find(r => r.invoice_id === invoiceId);
    if (!record) throw new Error('Archivdokument nicht gefunden');

    const obj = await s3.getObject({
      Bucket: record.s3_bucket,
      Key: record.s3_key,
    });

    // Integrity check
    const currentHash = createHash('sha256').update(obj.Body, 'utf8').digest('hex');
    const integrityOk = currentHash === record.file_hash;

    if (!integrityOk) {
      await db.createAuditLog({
        org_id: orgId,
        invoice_id: invoiceId,
        action: 'integrity_violation',
        details: { expected: record.file_hash, actual: currentHash }
      });
      throw new Error('GoBD-Integritätsverletzung: Dokument wurde verändert!');
    }

    return {
      xml: obj.Body,
      metadata: obj.Metadata,
      integrity_ok: integrityOk,
      file_hash: record.file_hash,
      retention_until: record.retention_until,
    };
  },

  /**
   * List archive records for an organization
   */
  async listArchive(orgId, limit = 100) {
    return db.findArchiveRecords(orgId, limit);
  },

  /**
   * Verify integrity of all archived documents
   */
  async verifyIntegrity(orgId) {
    const records = await db.findArchiveRecords(orgId, 10000);
    const results = [];

    for (const record of records) {
      try {
        const obj = await s3.getObject({ Bucket: record.s3_bucket, Key: record.s3_key });
        const currentHash = createHash('sha256').update(obj.Body, 'utf8').digest('hex');
        results.push({
          invoice_id: record.invoice_id,
          s3_key: record.s3_key,
          ok: currentHash === record.file_hash,
          stored_hash: record.file_hash,
          current_hash: currentHash,
        });
      } catch (err) {
        results.push({ invoice_id: record.invoice_id, ok: false, error: err.message });
      }
    }

    return {
      total: results.length,
      passed: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      records: results,
    };
  }
};
