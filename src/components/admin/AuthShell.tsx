import Link from "next/link";

// Two-column layout shared by the sign-in, sign-up and "waiting for approval"
// pages: brand panel on the left (desktop), content on the right.
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand-900 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-brand-700/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-accent-600/25 blur-3xl" />
        <Link href="/" className="relative w-fit">
          <img src="/logo.png" alt="Shinkyowa International" className="w-56" />
        </Link>
        <div className="relative">
          <p className="text-3xl leading-tight font-semibold text-white">Your vehicles, from Japan to your port.</p>
          <p className="mt-4 max-w-md text-brand-200">
            Customers follow their vehicles, shipping, documents and payments. Staff manage stock, customers and payments.
          </p>
        </div>
        <p className="relative text-sm text-brand-300">© {new Date().getFullYear()} Shinkyowa International</p>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 block rounded-xl bg-brand-900 p-4 lg:hidden">
            <img src="/logo.png" alt="Shinkyowa International" className="w-44" />
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
