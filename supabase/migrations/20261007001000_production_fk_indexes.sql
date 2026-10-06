-- ProBee V2 production FK indexes identified by live Supabase advisor.
create index if not exists admin_users_created_by_idx on public.admin_users(created_by);
create index if not exists admin_users_updated_by_idx on public.admin_users(updated_by);
create index if not exists digital_delivery_assets_created_by_idx on public.digital_delivery_assets(created_by);
create index if not exists payment_proofs_verified_by_idx on public.payment_proofs(verified_by);
create index if not exists payment_settings_updated_by_idx on public.payment_settings(updated_by);
create index if not exists payments_verified_by_idx on public.payments(verified_by);
create index if not exists reviews_moderated_by_idx on public.reviews(moderated_by);
create index if not exists transactional_email_logs_entitlement_id_idx on public.transactional_email_logs(entitlement_id);
create index if not exists transactional_email_logs_order_id_idx on public.transactional_email_logs(order_id);
create index if not exists transactional_email_logs_payment_id_idx on public.transactional_email_logs(payment_id);
