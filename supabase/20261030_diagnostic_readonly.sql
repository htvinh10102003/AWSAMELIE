-- AWSAMELIE - SQL CHAN DOAN CHI DOC (khong thay doi du lieu)
-- Chay trong Supabase Dashboard > SQL Editor, copy ket qua gui lai neu muon toi uu sau hon.
-- 1. Dung luong tung bang (lon nhat truoc)
select schemaname, tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_total_relation_size(schemaname||'.'||tablename) as total_bytes
from pg_tables where schemaname = 'public' order by total_bytes desc;
-- 2. Index hien co cua cac bang chinh
select tablename, indexname, indexdef from pg_indexes
where schemaname = 'public'
  and tablename in ('orders','order_products','order_histories','product_inventories','system_configs','return_audit_logs','working_schedules')
order by tablename, indexname;
-- 3. RLS co bat khong, va policy nao
select tablename, rowsecurity as rls_enabled from pg_tables where schemaname = 'public' order by tablename;
select tablename, policyname, cmd, roles from pg_policies where schemaname = 'public' order by tablename, policyname;
-- 4. So dong uoc luong (reltuples, khong phai dem chinh xac)
select relname as tablename, n_live_tup as estimated_rows from pg_stat_user_tables order by n_live_tup desc;
