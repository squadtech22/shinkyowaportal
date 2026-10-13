import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AuthShell from "@/components/admin/AuthShell";
import { getCurrentUser } from "@/lib/admin/auth";
import { getCurrentCustomer } from "@/lib/client/auth";
import SignInForm from "./SignInForm";

export const metadata: Metadata = { title: "Sign in" };

/** The one sign-in for staff and customers; the account decides where it leads. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/admin");
  if (await getCurrentCustomer()) redirect("/client");
  const { next } = await searchParams;
  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-slate-500">
        Customers and Shinkyowa staff sign in here with their email and password.
      </p>
      <SignInForm next={next} />
      <p className="mt-6 text-center text-sm text-slate-500">
        Customer without a password? Ask your Shinkyowa sales agent.
      </p>
      <p className="mt-2 text-center text-sm text-slate-500">
        New staff member?{" "}
        <Link href="/admin/register" className="font-medium text-brand-700 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
