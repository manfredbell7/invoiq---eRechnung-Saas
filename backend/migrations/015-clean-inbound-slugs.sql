-- 015: Saubere e-Rechnungs-Adressen ohne Zufalls-Suffix
--
-- Neu: [firmenname]@rechnungen.invoiq.de statt [firmenname]-a1b2c3@…
-- Bestehende Mandanten werden migriert; ihre alte Adresse bleibt über
-- inbound_email_slug_legacy als Alias empfangbar (bereits kommunizierte
-- Adressen brechen nicht).

alter table organizations
  add column if not exists inbound_email_slug_legacy text;

create index if not exists idx_orgs_inbound_slug_legacy
  on organizations (inbound_email_slug_legacy)
  where inbound_email_slug_legacy is not null;

-- Bestehende Zufalls-Suffix-Slugs auf saubere Varianten migrieren.
do $$
declare
  r record;
  base text;
  candidate text;
  n int;
  reserved text[] := array['postmaster','abuse','admin','administrator','hostmaster',
    'webmaster','root','info','mail','noreply','no-reply','support','security',
    'billing','rechnung','rechnungen','invoiq','test','demo'];
begin
  for r in
    select id, inbound_email_slug from organizations
    where inbound_email_slug ~ '-[0-9a-f]{6}$'
    order by created_at
  loop
    base := regexp_replace(r.inbound_email_slug, '-[0-9a-f]{6}$', '');
    if base = '' then continue; end if;
    candidate := base; n := 1;
    while candidate = any(reserved)
       or exists (select 1 from organizations where (inbound_email_slug = candidate or inbound_email_slug_legacy = candidate) and id <> r.id)
    loop
      n := n + 1;
      candidate := base || '-' || n;
      exit when n > 20;
    end loop;
    if n <= 20 then
      update organizations
        set inbound_email_slug_legacy = inbound_email_slug,
            inbound_email_slug = candidate
        where id = r.id;
    end if;
  end loop;
end $$;
