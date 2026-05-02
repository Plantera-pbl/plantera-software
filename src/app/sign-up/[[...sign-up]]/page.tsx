import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-green-50 via-emerald-50 to-teal-50">
      <SignUp />
    </main>
  );
}
