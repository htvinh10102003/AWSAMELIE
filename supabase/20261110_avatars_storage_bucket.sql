-- Anh dai dien tai khoan (Task C): bucket Storage public `avatars`.
-- CHI TAO, KHONG CHAY TU DONG — Owner chay file nay 1 lan trong Supabase
-- Dashboard > SQL Editor roi moi dung duoc tinh nang avatar.
--
-- Thiet ke:
--  - 1 user = 1 file `<userId>/avatar.jpg` (ghi de khi doi anh). File da
--    duoc thu nho con 256px o trinh duyet truoc khi tai len.
--  - Chi URL public ngan duoc luu vao user_metadata.avatar_url; khong luu
--    base64 vao metadata (metadata di kem trong JWT moi request).
--  - Bucket public: ai cung doc duoc anh (avatar hien o header + danh sach
--    Users cho moi nguoi dang nhap). Ghi thi gioi han: tu tai anh cua minh,
--    hoac Owner tai anh cua bat ky ai.
--  - RLS tren storage.objects mac dinh da bat o Supabase.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Doc: cong khai, ai cung xem duoc avatar.
drop policy if exists "Avatars: xem cong khai" on storage.objects;
create policy "Avatars: xem cong khai"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Ghi: moi nguoi chi duoc tai/cap nhat/xoa file trong thu muc cua minh.
drop policy if exists "Avatars: tu tai len anh cua minh" on storage.objects;
create policy "Avatars: tu tai len anh cua minh"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Avatars: tu cap nhat anh cua minh" on storage.objects;
create policy "Avatars: tu cap nhat anh cua minh"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Avatars: tu xoa anh cua minh" on storage.objects;
create policy "Avatars: tu xoa anh cua minh"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Ghi: Owner (user_metadata.is_owner = true) duoc tai/cap nhat/xoa anh cua
-- bat ky user nao — phuc vu Owner doi avatar cho nhan vien tu Admin.
drop policy if exists "Avatars: Owner quan ly moi anh" on storage.objects;
create policy "Avatars: Owner quan ly moi anh"
  on storage.objects for all
  using (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and ((auth.jwt() -> 'user_metadata' ->> 'is_owner')::boolean is true)
  )
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and ((auth.jwt() -> 'user_metadata' ->> 'is_owner')::boolean is true)
  );
