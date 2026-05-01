import Link from "next/link";
import { HydrateClient } from "@/trpc/server";

export default async function Home() {
  return (
    <HydrateClient>
      <main className="min-h-screen bg-gradient-to-b from-green-50 via-emerald-50 to-teal-50">
        {/* Navigation */}
        <nav className="fixed top-0 z-50 w-full border-b border-green-100 bg-white/80 backdrop-blur-md">
          <div className="container mx-auto flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-2">
              <span className="text-3xl">🌱</span>
              <span className="text-2xl font-bold text-green-800">
                Plantera
              </span>
            </div>
            <div className="hidden items-center gap-8 md:flex">
              <Link
                href="#features"
                className="text-green-700 transition hover:text-green-900"
              >
                Features
              </Link>
              <Link
                href="#how-it-works"
                className="text-green-700 transition hover:text-green-900"
              >
                How It Works
              </Link>
              <Link
                href="#tech"
                className="text-green-700 transition hover:text-green-900"
              >
                Technology
              </Link>
            </div>
            <button className="rounded-full bg-green-600 px-6 py-2 font-semibold text-white shadow-lg shadow-green-200 transition hover:bg-green-700">
              Get Started
            </button>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative px-6 pt-32 pb-20">
          <div className="container mx-auto text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-2 text-green-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
              </span>
              Powered by Arduino & AI
            </div>
            <h1 className="mb-6 text-5xl font-extrabold tracking-tight text-green-900 md:text-7xl">
              Nurture Your Plants
              <br />
              <span className="bg-gradient-to-r from-green-600 via-emerald-500 to-teal-500 bg-clip-text text-transparent">
                With Intelligence
              </span>
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-xl text-green-700">
              Track your plants&apos; health, monitor soil moisture, light
              levels, and get AI-powered care recommendations. Let technology
              help your garden thrive.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button className="flex items-center gap-2 rounded-full bg-green-600 px-8 py-4 text-lg font-semibold text-white shadow-xl shadow-green-200 transition hover:bg-green-700">
                <span>Start Growing</span>
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </button>
              <button className="rounded-full border-2 border-green-300 px-8 py-4 text-lg font-semibold text-green-700 transition hover:bg-green-100">
                Watch Demo
              </button>
            </div>
          </div>

          {/* Decorative Elements */}
          <div className="absolute top-40 left-10 animate-bounce text-6xl opacity-20">
            🌿
          </div>
          <div className="absolute top-60 right-20 animate-pulse text-5xl opacity-20">
            🌸
          </div>
          <div className="absolute bottom-20 left-1/4 animate-bounce text-4xl opacity-20 delay-300">
            🍃
          </div>
        </section>

        {/* Stats Section */}
        <section className="bg-white/50 px-6 py-16">
          <div className="container mx-auto">
            <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
              <div className="p-6">
                <div className="text-4xl font-bold text-green-600">500+</div>
                <div className="mt-2 text-green-700">Plant Species</div>
              </div>
              <div className="p-6">
                <div className="text-4xl font-bold text-green-600">
                  Real-time
                </div>
                <div className="mt-2 text-green-700">Monitoring</div>
              </div>
              <div className="p-6">
                <div className="text-4xl font-bold text-green-600">AI</div>
                <div className="mt-2 text-green-700">Powered Insights</div>
              </div>
              <div className="p-6">
                <div className="text-4xl font-bold text-green-600">24/7</div>
                <div className="mt-2 text-green-700">Plant Care</div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="px-6 py-20">
          <div className="container mx-auto">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-4xl font-bold text-green-900 md:text-5xl">
                Everything Your Plants Need
              </h2>
              <p className="mx-auto max-w-2xl text-xl text-green-700">
                From soil sensors to smart recommendations, we&apos;ve got your
                garden covered.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {/* Feature 1 */}
              <div className="group rounded-3xl bg-white p-8 shadow-lg shadow-green-100 transition-all hover:-translate-y-2 hover:shadow-xl hover:shadow-green-200">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 transition group-hover:bg-green-200">
                  <span className="text-3xl">💧</span>
                </div>
                <h3 className="mb-3 text-2xl font-bold text-green-900">
                  Moisture Tracking
                </h3>
                <p className="text-green-700">
                  Real-time soil moisture monitoring with Arduino sensors. Get
                  alerts when your plants need water.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="group rounded-3xl bg-white p-8 shadow-lg shadow-green-100 transition-all hover:-translate-y-2 hover:shadow-xl hover:shadow-green-200">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 transition group-hover:bg-amber-200">
                  <span className="text-3xl">☀️</span>
                </div>
                <h3 className="mb-3 text-2xl font-bold text-green-900">
                  Light Monitoring
                </h3>
                <p className="text-green-700">
                  Track sunlight exposure throughout the day. Ensure your plants
                  get optimal light conditions.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="group rounded-3xl bg-white p-8 shadow-lg shadow-green-100 transition-all hover:-translate-y-2 hover:shadow-xl hover:shadow-green-200">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-100 transition group-hover:bg-purple-200">
                  <span className="text-3xl">🤖</span>
                </div>
                <h3 className="mb-3 text-2xl font-bold text-green-900">
                  AI Recommendations
                </h3>
                <p className="text-green-700">
                  Smart suggestions powered by AI. Get personalized care tips
                  based on your plant&apos;s data.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="group rounded-3xl bg-white p-8 shadow-lg shadow-green-100 transition-all hover:-translate-y-2 hover:shadow-xl hover:shadow-green-200">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 transition group-hover:bg-rose-200">
                  <span className="text-3xl">🌡️</span>
                </div>
                <h3 className="mb-3 text-2xl font-bold text-green-900">
                  Temperature & Humidity
                </h3>
                <p className="text-green-700">
                  Monitor environmental conditions. Keep your plants in their
                  ideal climate zone.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="group rounded-3xl bg-white p-8 shadow-lg shadow-green-100 transition-all hover:-translate-y-2 hover:shadow-xl hover:shadow-green-200">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 transition group-hover:bg-blue-200">
                  <span className="text-3xl">📊</span>
                </div>
                <h3 className="mb-3 text-2xl font-bold text-green-900">
                  Growth Analytics
                </h3>
                <p className="text-green-700">
                  Track your plant&apos;s progress over time. Visualize growth
                  patterns and health trends.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="group rounded-3xl bg-white p-8 shadow-lg shadow-green-100 transition-all hover:-translate-y-2 hover:shadow-xl hover:shadow-green-200">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-100 transition group-hover:bg-teal-200">
                  <span className="text-3xl">📱</span>
                </div>
                <h3 className="mb-3 text-2xl font-bold text-green-900">
                  Mobile Alerts
                </h3>
                <p className="text-green-700">
                  Get instant notifications on your phone. Never miss a watering
                  schedule again.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section
          id="how-it-works"
          className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-20"
        >
          <div className="container mx-auto">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-4xl font-bold text-white md:text-5xl">
                How Plantera Works
              </h2>
              <p className="mx-auto max-w-2xl text-xl text-green-100">
                Simple setup, powerful results. Get started in minutes.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              <div className="text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/20 text-4xl">
                  1️⃣
                </div>
                <h3 className="mb-3 text-2xl font-bold text-white">
                  Connect Arduino
                </h3>
                <p className="text-green-100">
                  Set up your Arduino sensors near your plants. Easy
                  plug-and-play installation.
                </p>
              </div>

              <div className="text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/20 text-4xl">
                  2️⃣
                </div>
                <h3 className="mb-3 text-2xl font-bold text-white">
                  Sync with App
                </h3>
                <p className="text-green-100">
                  Connect your sensors to Plantera. Start receiving real-time
                  data instantly.
                </p>
              </div>

              <div className="text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/20 text-4xl">
                  3️⃣
                </div>
                <h3 className="mb-3 text-2xl font-bold text-white">
                  Get AI Insights
                </h3>
                <p className="text-green-100">
                  Let our AI analyze your data and provide personalized care
                  recommendations.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Technology Section */}
        <section id="tech" className="px-6 py-20">
          <div className="container mx-auto">
            <div className="grid items-center gap-16 md:grid-cols-2">
              <div>
                <h2 className="mb-6 text-4xl font-bold text-green-900 md:text-5xl">
                  Powered by Smart Technology
                </h2>
                <p className="mb-8 text-xl text-green-700">
                  Plantera combines IoT sensors with artificial intelligence to
                  give your plants the best care possible.
                </p>

                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100">
                      <span className="text-2xl">⚡</span>
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-green-900">
                        Arduino Integration
                      </h4>
                      <p className="text-green-700">
                        ESP32 and Arduino-compatible sensors for accurate
                        environmental monitoring.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-purple-100">
                      <span className="text-2xl">🧠</span>
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-green-900">
                        Machine Learning
                      </h4>
                      <p className="text-green-700">
                        AI models trained on thousands of plant care scenarios
                        for accurate predictions.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-green-100">
                      <span className="text-2xl">☁️</span>
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-green-900">
                        Cloud Sync
                      </h4>
                      <p className="text-green-700">
                        Access your plant data from anywhere. Seamless
                        synchronization across devices.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="rounded-3xl bg-gradient-to-br from-green-100 to-emerald-100 p-8 shadow-2xl">
                  <div className="mb-4 rounded-2xl bg-white p-6 shadow-lg">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-lg font-semibold text-green-900">
                        🌿 Monstera Deliciosa
                      </span>
                      <span className="font-medium text-green-600">
                        Healthy
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-green-700">Soil Moisture</span>
                        <div className="h-2 w-32 rounded-full bg-green-100">
                          <div
                            className="h-2 rounded-full bg-green-500"
                            style={{ width: "72%" }}
                          ></div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-green-700">Light Level</span>
                        <div className="h-2 w-32 rounded-full bg-amber-100">
                          <div
                            className="h-2 rounded-full bg-amber-500"
                            style={{ width: "85%" }}
                          ></div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-green-700">Temperature</span>
                        <span className="font-medium text-green-900">24°C</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl bg-green-600 p-4 text-white">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">💡</span>
                      <div>
                        <p className="font-semibold">AI Suggestion</p>
                        <p className="text-sm text-green-100">
                          Water in 2 days. Consider moving to brighter spot.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating elements */}
                <div className="absolute -top-4 -right-4 rounded-2xl bg-white p-4 shadow-lg">
                  <span className="text-3xl">🌱</span>
                </div>
                <div className="absolute -bottom-4 -left-4 rounded-2xl bg-white p-4 shadow-lg">
                  <span className="text-3xl">📡</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-green-900 px-6 py-20">
          <div className="container mx-auto text-center">
            <h2 className="mb-6 text-4xl font-bold text-white md:text-5xl">
              Ready to Transform Your Garden?
            </h2>
            <p className="mx-auto mb-10 max-w-2xl text-xl text-green-200">
              Join thousands of plant lovers who are growing smarter with
              Plantera.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button className="flex items-center gap-2 rounded-full bg-white px-8 py-4 text-lg font-semibold text-green-900 shadow-xl transition hover:bg-green-100">
                <span>Get Started Free</span>
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </button>
              <button className="rounded-full border-2 border-green-400 px-8 py-4 text-lg font-semibold text-white transition hover:bg-green-800">
                View Arduino Guide
              </button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-green-950 px-6 py-12">
          <div className="container mx-auto">
            <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
              <div className="flex items-center gap-2">
                <span className="text-3xl">🌱</span>
                <span className="text-2xl font-bold text-white">Plantera</span>
              </div>
              <div className="flex items-center gap-8 text-green-300">
                <Link href="#" className="transition hover:text-white">
                  Privacy
                </Link>
                <Link href="#" className="transition hover:text-white">
                  Terms
                </Link>
                <Link href="#" className="transition hover:text-white">
                  Support
                </Link>
                <Link href="#" className="transition hover:text-white">
                  GitHub
                </Link>
              </div>
              <p className="text-green-400">© 2026 Plantera. Made with 💚</p>
            </div>
          </div>
        </footer>
      </main>
    </HydrateClient>
  );
}
