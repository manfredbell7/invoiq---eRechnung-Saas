// backend/config/database.js
// Supabase client — single shared instance

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.'
  );
}

// ACHTUNG — Service-Role-Key: dieser Client umgeht Row Level Security (RLS)
// vollständig. Mandantentrennung (org_id) wird dadurch NICHT von der
// Datenbank erzwungen — jede Query, die mandantenspezifische Daten liest
// oder schreibt, MUSS auf Anwendungsebene explizit nach org_id filtern
// (siehe config/db.js, z.B. updateInvoice).
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Convenience wrapper — throws on Supabase errors so callers use try/catch
export async function dbQuery(table, operation, params = {}) {
  const ref = supabase.from(table);
  let query;

  switch (operation) {
    case 'select':
      query = ref.select(params.columns ?? '*');
      if (params.match) query = query.match(params.match);
      if (params.eq) query = query.eq(params.eq[0], params.eq[1]);
      if (params.order) query = query.order(params.order.column, { ascending: params.order.ascending ?? false });
      if (params.limit) query = query.limit(params.limit);
      break;
    case 'insert':
      query = ref.insert(params.data).select();
      break;
    case 'update':
      query = ref.update(params.data).eq(params.eq[0], params.eq[1]).select();
      break;
    case 'upsert':
      query = ref.upsert(params.data).select();
      break;
    case 'delete':
      query = ref.delete().eq(params.eq[0], params.eq[1]);
      break;
    default:
      throw new Error(`Unknown db operation: ${operation}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`DB error [${table}/${operation}]: ${error.message}`);
  return data;
}

export default supabase;
