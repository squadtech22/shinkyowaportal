import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AuthShell from "@/components/admin/AuthShell";
import { getCurrentUser } from "@/lib/admin/auth";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = { title: "Create an account" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/admin");
  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
      <p className="mt-1 text-sm text-slate-500">A manager reviews every new account before it can be used.</p>
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
