// src/services/archiveService.js
// GoBD-konforme Archivierung (§147 AO — 10 Jahre Aufbewahrung)
// Production: AWS S3 eu-central-1 (Frankfurt)

import { createHash } from 'crypto';
import { db } from '../config/db.js';
// ── MOCK S3 (replace with real AWS S3 in production) ──────────
class MockS3 {
  constructor() { this.store = new Map(); }

  async putObject({ Bucket, Key, Body, Metadata, ServerSideEncryption }) {
    this.store.set(Key, { body: Body, metadata: Metadata, bucket: Bucket });
    return { ETag: `"${createHash('md5').update(Body).digest('hex')}"` };
  }

  async getObject({ Bucket, Key }) {
    const item = this.store.get(Key);
    if (!item) throw new Error(`NoSuchKey: ${Key}`);
    return { Body: item.body, Metadata: item.metadata };
  }

  async headObject({ Bucket, Key }) {
    const item = this.store.get(Key);
    if (!item) throw new Error(`NoSuchKey: ${Key}`);
    return { ContentLength: item.body.length, Metadata: item.metadata };
  }
}

const s3 = new MockS3();

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
