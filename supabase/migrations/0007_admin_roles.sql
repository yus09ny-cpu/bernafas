-- 3-tier admin role system, replacing api/_lib/isAdmin.ts's single
-- hardcoded-email check. NULL = ordinary user (not an admin at all);
-- 'admin' = shipping only (/admin/penghantaran); 'super' = product/order/
-- affiliate management (existing or future screens), everything 'admin'
-- can do too; 'master' = everything, INCLUDING managing other admins'
-- roles via the new /admin/pengurusan-admin screen. Hierarchy is strict
-- and linear (master ⊇ super ⊇ admin) — see api/_lib/adminRole.ts's rank
-- check, which is what actually enforces it server-side. This column is
-- read via supabaseAdmin (service-role, bypasses RLS) from api/admin/*.ts
-- routes only — never a client-side supabase-js call, same reasoning as
-- affiliates/orders/order_shipping already established in prior
-- migrations (see 0003_affiliate_program.sql's header).
alter table public.profiles
  add column if not exists admin_role text check (admin_role in ('master', 'super', 'admin'));

create index if not exists profiles_admin_role_idx on public.profiles (admin_role) where admin_role is not null;

-- Seed the first admin (product owner, previously the sole hardcoded
-- ADMIN_EMAIL in api/_lib/isAdmin.ts) as 'master' so the role system is
-- never empty right after this migration runs — there must always be at
-- least one master from the start, or /admin/pengurusan-admin (master-only)
-- would be permanently unreachable by anyone.
do $$
begin
  update public.profiles set admin_role = 'master' where email = 'yus09ny@gmail.com';
  if not found then
    raise notice 'profiles row for yus09ny@gmail.com not found (never signed in yet?) — admin_role NOT seeded. Sign in once via magic link, then run: update public.profiles set admin_role = ''master'' where email = ''yus09ny@gmail.com'';';
  end if;
end $$;
