-- Storage policies for enrollment-photos bucket.
-- Allows authenticated users to upload/read photos in their institution's folder.
-- This lets us switch from admin client to session client for photo uploads.

-- Allow authenticated users to upload to their institution's folder
create policy "upload to own institution folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'enrollment-photos'
    and (storage.foldername(name))[1] = public.current_institution_id()::text
  );

-- Allow authenticated users to read from their institution's folder
create policy "read from own institution folder" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'enrollment-photos'
    and (storage.foldername(name))[1] = public.current_institution_id()::text
  );
