-- STEP 27: align payment-proof storage administration with V2 staff authorization
-- Customer access remains restricted to their own order paths.
-- Staff review/delete access uses the V2 authorization helper instead of the legacy schema.

drop policy if exists "Admins can view payment proofs" on storage.objects;
drop policy if exists "Admins can delete payment proofs" on storage.objects;

create policy "Staff can view payment proofs"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and (select private.is_staff())
);

create policy "Staff can delete payment proofs"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'payment-proofs'
  and (select private.is_staff())
);
