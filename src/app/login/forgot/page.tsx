import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthShell } from "../auth-shell";
import { ForgotForm } from "./forgot-form";

export const metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter the email you sign in with and we'll send you a link to choose a new password."
      footer={
        <a href="/login" className="hover:underline">
          ← Back to sign in
        </a>
      }
    >
      <ForgotForm />
    </AuthShell>
  );
}
