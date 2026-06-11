// routes/admin/index.js — Admin Panel API
// Nur für super_admin / owner zugänglich

import { authMiddleware } from '../../middleware/auth.js';
import { supabase } from '../../config/database.js';

const PLAN_MRR = { free: 0, starter: 49, business: 149, enterprise: 349, pro: 149 };

export async function adminRoutes(fastify) {

  // Zugriffsschutz: nur Admins
  const adminGuard = async (req, reply) => {
    await authMiddleware(req, reply);
    if (reply.sent) return;
    const role = req.user?.role;
    if (role !== 'super_admin' && role !== 'owner' && role !== 'admin') {
      return reply.code(403).send({ error: 'Kein Admin-Zugriff' });
    }
  };

  // ── STATS ────────────────────────────────────────────────────
  fastify.get('/stats', { preHandler: adminGuard }, async (req) => {
    const orgId = req.org.id;
    const [{ count: docs }, { count: errors }, { count: users }] = await Promise.all([
      supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'error'),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
    ]);
    return {
      docs_used:   docs   || 0,
      docs_limit:  req.org.plan_doc_limit || 100,
      errors:      errors || 0,
      users:       users  || 0,
      open_errors: errors || 0,
    };
  });

  // ── ORGS (super_admin sieht alle, sonst nur eigene) ──────────
  fastify.get('/orgs', { preHandler: adminGuard }, async (req) => {
    let query = supabase.from('organizations')
      .select('id, name, slug, vat_id, plan, plan_doc_used, plan_doc_limit, active, created_at');
    if (req.user.role !== 'super_admin') query = query.eq('id', req.org.id);

    const { data: orgs, error } = await query.order('created_at', { ascending: false });
    if (error) return { orgs: [] };

    return {
      orgs: (orgs || []).map(o => ({
        ...o,
        status: o.active === false ? 'suspended' : 'active',
        mrr: PLAN_MRR[o.plan] ?? 0,
        compliance: 100,
        open_errors: 0,
        pending_inbound: 0,
      })),
    };
  });

  // ── USERS ────────────────────────────────────────────────────
  fastify.get('/users', { preHandler: adminGuard }, async (req) => {
    let query = supabase.from('users')
      .select('id, email, full_name, role, org_id, last_login_at, active, created_at');
    if (req.user.role !== 'super_admin') query = query.eq('org_id', req.org.id);

    const { data: users, error } = await query.order('created_at', { ascending: false });
    if (error) return { users: [] };

    // Org-Namen nachladen
    const orgIds = [...new Set((users || []).map(u => u.org_id).filter(Boolean))];
    const { data: orgs } = await supabase.from('organizations').select('id, name').in('id', orgIds);
    const orgMap = Object.fromEntries((orgs || []).map(o => [o.id, o.name]));

    return {
      users: (users || []).map(u => ({
        ...u,
        org_name: orgMap[u.org_id] || '—',
        status: u.active === false ? 'suspended' : 'active',
      })),
    };
  });
}
