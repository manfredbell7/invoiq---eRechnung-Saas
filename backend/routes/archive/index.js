// src/routes/archive/index.js
import { db } from '../../config/db.js';
import { authMiddleware } from '../../middleware/auth.js';
import { archiveService } from '../../services/archiveService.js';

export async function archiveRoutes(fastify) {

  // List all archived documents
  fastify.get('/', { preHandler: authMiddleware }, async (req) => {
    const records = await archiveService.listArchive(req.org.id);
    return { records, total: records.length };
  });

  // Retrieve a specific document from archive
  fastify.get('/:invoiceId', { preHandler: authMiddleware }, async (req, reply) => {
    try {
      const result = await archiveService.retrieveDocument(req.org.id, req.params.invoiceId);
      reply.header('Content-Type', 'application/xml');
      reply.header('Content-Disposition', `attachment; filename="archive-${req.params.invoiceId}.xml"`);
      reply.header('X-File-Hash', result.file_hash);
      reply.header('X-Integrity-OK', String(result.integrity_ok));
      reply.header('X-Retention-Until', result.retention_until);
      return result.xml;
    } catch (err) {
      return reply.code(404).send({ error: err.message });
    }
  });

  // Verify integrity of all archived docs (GoBD audit)
  fastify.get('/verify/integrity', { preHandler: authMiddleware }, async (req) => {
    const result = await archiveService.verifyIntegrity(req.org.id);
    await db.createAuditLog({
      org_id: req.org.id,
      user_id: req.user?.id,
      action: 'integrity_check',
      details: { passed: result.passed, failed: result.failed }
    });
    return result;
  });

  // Get audit logs
  fastify.get('/audit/logs', { preHandler: authMiddleware }, async (req) => {
    const { limit = 100 } = req.query;
    const logs = await db.getAuditLogs(req.org.id, null, parseInt(limit));
    return { logs, total: logs.length };
  });
}
