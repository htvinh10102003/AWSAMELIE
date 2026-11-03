-- Nhat ky thao tac don + hien dien + lich su dang nhap (phuc vu tab
-- Quan ly Users cua Owner). Chay 1 lan trong Supabase SQL Editor.
-- Doc ghi qua edge (service role) nen khong can policy SELECT; chi can
-- policy INSERT cho client thuong (ghi log in don, heartbeat, lich su
-- dang nhap) voi rang buoc dung user_id cua chinh minh.

-- 1. Log thao tac don (Gửi/Sửa/Hủy/In). Ghi tu edge nhanh-order-actions
-- (send/edit/cancel) va tu frontend (print).
create table if not exists public.admin_action_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid,
  user_email text,
  action text not null,
  target_type text,
  target_id text,
  details jsonb,
  result text
);
create index if not exists idx_admin_action_logs_created_at
  on public.admin_action_logs (created_at desc);
create index if not exists idx_admin_action_logs_user_created
  on public.admin_action_logs (user_id, created_at desc);
alter table public.admin_action_logs enable row level security;
drop policy if exists "authenticated insert own action logs" on public.admin_action_logs;
create policy "authenticated insert own action logs"
  on public.admin_action_logs for insert to authenticated
  with check (auth.uid() = user_id);

-- 2. Hien dien: moi dong la 1 thiet bi cua 1 user, cap nhat moi 5 phut
-- khi app dang mo. Online = last_seen_at trong 10 phut gan nhat.
create table if not exists public.user_presence (
  user_id uuid not null,
  device_id text not null,
  user_email text,
  user_agent text,
  last_seen_at timestamptz not null default now(),
  primary key (user_id, device_id)
);
create index if not exists idx_user_presence_last_seen
  on public.user_presence (last_seen_at desc);
alter table public.user_presence enable row level security;
drop policy if exists "authenticated upsert own presence" on public.user_presence;
create policy "authenticated upsert own presence"
  on public.user_presence for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "authenticated update own presence" on public.user_presence;
create policy "authenticated update own presence"
  on public.user_presence for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. Lich su dang nhap: 1 dong moi lan dang nhap thanh cong (SIGNED_IN).
create table if not exists public.user_login_history (
  id bigint generated always as identity primary key,
  signed_in_at timestamptz not null default now(),
  user_id uuid,
  user_email text,
  user_agent text
);
create index if not exists idx_user_login_history_user_signed_in
  on public.user_login_history (user_id, signed_in_at desc);
alter table public.user_login_history enable row level security;
drop policy if exists "authenticated insert own login history" on public.user_login_history;
create policy "authenticated insert own login history"
  on public.user_login_history for insert to authenticated
  with check (auth.uid() = user_id);
