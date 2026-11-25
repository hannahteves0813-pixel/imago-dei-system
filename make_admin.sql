-- Promote a user to ADMIN.
-- 1) Supabase Dashboard > Authentication > Users > Add user > create the account
-- 2) SQL Editor > run this with the real email:
update public.profiles p
set role = 'admin'
from auth.users u
where u.id = p.id
  and u.email = 'admin@example.com';   -- <-- CHANGE THIS EMAIL
