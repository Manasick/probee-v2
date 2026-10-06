-- STEP 27: complete V2 Storage policies for product media and digital delivery.
-- Product media is readable only when linked to an active published product.
-- Digital product objects are readable only through the entitlement-aware helper.
-- Staff retain management access; customers never receive direct list/write access.

drop policy if exists "Public can view active product media" on storage.objects;
drop policy if exists "Staff can manage product media" on storage.objects;
drop policy if exists "Customers can read entitled digital products" on storage.objects;
drop policy if exists "Staff can manage digital products" on storage.objects;

create policy "Public can view active product media"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'product-media'
  and exists (
    select 1
    from public.product_media pm
    join public.products p on p.id = pm.product_id
    where pm.media_url = name
      and pm.is_active = true
      and p.is_active = true
      and p.is_published = true
  )
);

create policy "Staff can manage product media"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'product-media'
  and (select private.is_staff())
)
with check (
  bucket_id = 'product-media'
  and (select private.is_staff())
);

create policy "Customers can read entitled digital products"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'digital-products'
  and (select private.can_read_digital_asset_storage(name))
);

create policy "Staff can manage digital products"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'digital-products'
  and (select private.is_staff())
)
with check (
  bucket_id = 'digital-products'
  and (select private.is_staff())
);
