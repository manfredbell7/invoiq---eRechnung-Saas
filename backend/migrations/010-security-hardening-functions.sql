-- 010: Security-Härtung für DB-Funktionen (Supabase-Advisor-Findings)
--
-- 1) rls_auto_enable() ist SECURITY DEFINER und war über PostgREST
--    (/rest/v1/rpc/...) für anon/authenticated aufrufbar. Die Funktion ist
--    nur ein Wartungs-Helper (RLS auf neuen Tabellen aktivieren) und darf
--    ausschließlich vom Service-Role/Owner ausgeführt werden.
-- 2) Trigger-/Helper-Funktionen ohne festen search_path sind anfällig für
--    Search-Path-Hijacking; search_path wird explizit auf public gepinnt.

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

alter function public.update_updated_at() set search_path = public;
alter function public.increment_doc_usage() set search_path = public;
alter function public.increment_vendor_corrections(p_org uuid, p_vat text) set search_path = public;
alter function public.rls_auto_enable() set search_path = public;
