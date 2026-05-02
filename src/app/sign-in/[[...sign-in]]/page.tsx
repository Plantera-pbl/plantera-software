import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-green-50 via-emerald-50 to-teal-50">
      <SignIn />
    </main>
  );
}
