-- STEP 26: customer payment-proof storage access
-- Authenticated customers may upload/read proofs only beneath orders they own.
-- The API/RPC layer remains authoritative for payment-state changes.

create policy "Customers can upload own payment proofs"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'payment-proofs'
  and (storage.foldername(name))[1] in (
    select o.id::text
    from public.orders o
    where o.user_id = (select auth.uid())
  )
);

create policy "Customers can read own payment proofs"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and (storage.foldername(name))[1] in (
    select o.id::text
    from public.orders o
    where o.user_id = (select auth.uid())
  )
);
