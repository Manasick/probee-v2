import Link from "next/link";
import { AdminStatus } from "@/components/admin/admin-status";
import { Container, Surface } from "@/components/ui";
import { getAdminCustomerDetail } from "@/lib/admin/operations";

function record(v: unknown): Record<string,unknown>{return v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{};}
function moneyByCurrency(value: unknown){const r=record(value);const entries=Object.entries(r);return entries.length?entries.map(([c,a])=>c+" "+Number(a).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})).join(" · "):"No paid orders";}
export const dynamic="force-dynamic";

export default async function AdminCustomerDetailPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const customer=await getAdminCustomerDetail(id);
  if(!customer)return <section className="probee-section"><Container><p className="probee-label">Customer</p><h1 className="mt-2 text-3xl font-semibold">Customer not found</h1><AdminErrorState message="The customer does not exist or is not available to staff."/></Container></section>;
  const latest=record(customer.latestOrder);
  return <section className="probee-section"><Container>
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="probee-label">Customer detail</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">{String(customer.displayName||customer.email||"Customer")}</h1><p className="mt-2 text-sm text-text-muted">{String(customer.email||"No email")}</p></div><Link href="/admin/customers" className="probee-focus-ring inline-flex min-h-11 items-center rounded-lg border border-[var(--probee-border-default)] px-4 text-sm font-semibold">Back to customers</Link></div>
    <div className="mt-8 grid gap-5 lg:grid-cols-2">
      <Surface className="p-5 sm:p-6"><p className="probee-label">Account</p><div className="mt-4 grid gap-3 text-sm"><p><span className="text-text-muted">Email:</span> {String(customer.email||"—")}</p><p><span className="text-text-muted">Phone:</span> {String(customer.phone||"—")}</p><p><span className="text-text-muted">Created:</span> {new Date(String(customer.createdAt)).toLocaleString()}</p><p className="flex flex-wrap items-center gap-2"><span className="text-text-muted">Email verification:</span><AdminStatus label={customer.emailVerifiedAt?"Verified":"Unverified"} tone={customer.emailVerifiedAt?"success":"warning"}/></p></div></Surface>
      <Surface className="p-5 sm:p-6"><p className="probee-label">Operations</p><div className="mt-4 grid gap-3 text-sm"><p>Orders: <strong>{Number(customer.orderCount||0)}</strong></p><p>Paid spend: <strong className="text-gold">{moneyByCurrency(customer.paidSpendByCurrency)}</strong></p><p>Reviews: <strong>{Number(customer.reviewCount||0)}</strong></p><p>Digital entitlements: <strong>{Number(customer.entitlementCount||0)}</strong></p></div></Surface>
    </div>
    <Surface className="mt-5 p-5 sm:p-6"><p className="probee-label">Latest order</p><h2 className="mt-2 text-xl font-semibold">{String(latest.orderReference||"No orders yet")}</h2>{latest.orderReference?<div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><p>Status: {String(latest.orderStatus)}</p><p>Payment: {String(latest.paymentStatus)}</p><p>Total: {String(latest.currency)} {Number(latest.total||0).toFixed(2)}</p><p>Date: {new Date(String(latest.createdAt)).toLocaleString()}</p></div>:<p className="mt-3 text-sm text-text-muted">No real orders for this customer.</p>}{latest.orderReference?<Link href="/admin/orders" className="probee-focus-ring mt-5 inline-flex min-h-10 items-center rounded-lg border border-[var(--probee-border-default)] px-3 text-xs font-semibold">Open order management</Link>:null}</Surface>
    <Surface className="mt-5 p-5 sm:p-6"><p className="probee-label">Privacy boundary</p><p className="mt-2 text-sm leading-6 text-text-muted">Authentication tokens, passwords, recovery codes, and Supabase Auth internals are never exposed here. Customer impersonation is not available.</p></Surface>
  </Container></section>;
}
