import Link from "next/link";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { HydrateClient } from "@/trpc/server";

const FEATURES = [
  {
    icon: "💧",
    title: "Soil Moisture",
    description: "Know exactly when to water with real-time soil readings.",
  },
  {
    icon: "☀️",
    title: "Light Tracking",
    description: "Monitor sunlight exposure and optimise plant placement.",
  },
  {
    icon: "🌡️",
    title: "Temp & Humidity",
    description: "Track environmental conditions for ideal plant health.",
  },
  {
    icon: "📊",
    title: "Smart Guidance",
    description: "Get personalised care tips based on your sensor data.",
  },
];

export default async function Home() {
  return (
    <HydrateClient>
      <div className="min-h-screen bg-white">
        {/* Nav */}
        <nav className="border-b border-gray-100 px-6 py-4">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🌱</span>
              <span className="text-lg font-semibold text-green-800">
                Plantera
              </span>
            </div>
            <Show when="signed-out">
              <div className="flex items-center gap-3">
                <SignInButton mode="modal">
                  <button className="text-sm text-gray-500 transition hover:text-gray-700">
                    Sign in
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700">
                    Get started
                  </button>
                </SignUpButton>
              </div>
            </Show>
            <Show when="signed-in">
              <div className="flex items-center gap-4">
                <Link
                  href="/dashboard"
                  className="text-sm text-green-700 transition hover:text-green-900"
                >
                  Dashboard
                </Link>
                <UserButton />
              </div>
            </Show>
          </div>
        </nav>

        {/* Hero */}
        <section className="mx-auto max-w-5xl px-6 py-16 text-center sm:py-28">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500"></span>
            Real-time plant monitoring
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            Your plants,
            <br />
            always healthy.
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-lg text-gray-500">
            Connect Arduino sensors to monitor soil, light, temperature, and
            humidity in real time. Get care guidance before problems arise.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Show when="signed-out">
              <SignUpButton mode="modal">
                <button className="rounded-lg bg-green-600 px-7 py-3 font-medium text-white transition hover:bg-green-700">
                  Start monitoring free
                </button>
              </SignUpButton>
              <SignInButton mode="modal">
                <button className="text-sm text-gray-400 transition hover:text-gray-600">
                  Already have an account →
                </button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="rounded-lg bg-green-600 px-7 py-3 font-medium text-white transition hover:bg-green-700"
              >
                Go to dashboard →
              </Link>
            </Show>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-gray-100 bg-gray-50 px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-10 text-center text-2xl font-bold text-gray-900">
              Everything your plants need
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl bg-white p-5 shadow-sm"
                >
                  <div className="mb-3 text-2xl">{f.icon}</div>
                  <h3 className="mb-1 font-semibold text-gray-900">
                    {f.title}
                  </h3>
                  <p className="text-sm text-gray-500">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-100 px-6 py-8 text-center text-sm text-gray-400">
          <span className="text-green-700">🌱 Plantera</span> — Smart plant
          monitoring with Arduino &amp; AI
        </footer>
      </div>
    </HydrateClient>
  );
}
