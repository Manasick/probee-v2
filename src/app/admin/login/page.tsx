import { AuthForm } from "@/components/auth/auth-form";
import { AdminLoginForm } from "@/components/auth/admin-login-form";

export default function AdminLoginPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="probee-admin-login min-h-screen">
        <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-5 py-10 sm:px-8">
          <div className="grid w-full gap-10 lg:grid-cols-[1fr_460px] lg:items-center">
            <div className="hidden lg:block">
              <p className="probee-label">ProBee Operations</p>
              <h1 className="mt-4 max-w-xl text-5xl font-semibold tracking-tight">
                Command the store from one secure workspace.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-text-secondary">
                Orders, payments, catalog, reviews and digital fulfillment stay behind the staff authorization boundary.
              </p>
              <div className="mt-8 grid max-w-lg grid-cols-3 gap-3">
                <div className="rounded-2xl border border-[var(--probee-border-subtle)] bg-surface-2 p-4"><p className="text-xs text-text-muted">Orders</p><p className="mt-2 font-semibold">Live</p></div>
                <div className="rounded-2xl border border-[var(--probee-border-subtle)] bg-surface-2 p-4"><p className="text-xs text-text-muted">Payments</p><p className="mt-2 font-semibold">Protected</p></div>
                <div className="rounded-2xl border border-[var(--probee-border-subtle)] bg-surface-2 p-4"><p className="text-xs text-text-muted">Delivery</p><p className="mt-2 font-semibold">Controlled</p></div>
              </div>
            </div>
            <div className="rounded-[28px] border border-[var(--probee-gold-border)] bg-surface-1/95 p-6 shadow-2xl backdrop-blur sm:p-8">
              <div className="mb-8">
                <p className="probee-label">Staff only</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight">ProBee Admin</h2>
                <p className="mt-3 text-sm leading-6 text-text-muted">Sign in with an authorized ProBee staff account.</p>
              </div>
              <AdminLoginForm />
              <p className="mt-6 text-center text-xs leading-5 text-text-muted">Customer accounts cannot access this console.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
