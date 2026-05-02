"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { SensorChart } from "./SensorChart";
import { api } from "@/trpc/react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HistoryPoint {
  time: string;
  value: number;
}

interface PlantHistory {
  light: HistoryPoint[];
  soilMoisture: HistoryPoint[];
  temperature: HistoryPoint[];
  humidity: HistoryPoint[];
}

interface SensorData {
  light: number; // 0-4095
  soilMoisture: number; // 0-4095
  temperature: number; // -40-80 C
  humidity: number; // 0-100 %
}

interface Plant {
  id: string;
  name: string;
  species: string;
  topic: string;
  photo: string | null; // data URL
  sensors: SensorData;
  history: PlantHistory;
}

// ─── Placeholder data ─────────────────────────────────────────────────────────

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function generateHistory(
  min: number,
  max: number,
  seed: number,
): HistoryPoint[] {
  let current = min + (max - min) * (0.3 + seededRandom(seed) * 0.5);
  const now = new Date();
  return Array.from({ length: 24 }, (_, i) => {
    const t = new Date(now.getTime() - (23 - i) * 3_600_000);
    current += (seededRandom(seed + i * 7) - 0.5) * (max - min) * 0.12;
    current = Math.max(min, Math.min(max, current));
    return {
      time: `${String(t.getHours()).padStart(2, "0")}:00`,
      value: Math.round(current * 10) / 10,
    };
  });
}

function generatePlantData(seed: number): {
  sensors: SensorData;
  history: PlantHistory;
} {
  const r = (s: number) => seededRandom(seed * 31 + s);
  return {
    sensors: {
      light: Math.round(500 + r(1) * 3000),
      soilMoisture: Math.round(800 + r(2) * 2800),
      temperature: Math.round((15 + r(3) * 20) * 10) / 10,
      humidity: Math.round((40 + r(4) * 40) * 10) / 10,
    },
    history: {
      light: generateHistory(0, 4095, seed * 11 + 1),
      soilMoisture: generateHistory(0, 4095, seed * 11 + 2),
      temperature: generateHistory(-40, 80, seed * 11 + 3),
      humidity: generateHistory(0, 100, seed * 11 + 4),
    },
  };
}

const INITIAL_PLANTS: Plant[] = [];

// ─── Guidance ─────────────────────────────────────────────────────────────────

interface Guidance {
  type: "success" | "warning" | "info";
  icon: string;
  title: string;
  description: string;
}

function getGuidance(sensors: SensorData): Guidance[] {
  const items: Guidance[] = [];

  if (sensors.soilMoisture < 600) {
    items.push({
      type: "warning",
      icon: "💧",
      title: "Water immediately",
      description: "Soil is critically dry. Water your plant now.",
    });
  } else if (sensors.soilMoisture < 1400) {
    items.push({
      type: "info",
      icon: "💧",
      title: "Water soon",
      description: "Soil moisture is low. Water in the next 1-2 days.",
    });
  } else if (sensors.soilMoisture > 3200) {
    items.push({
      type: "warning",
      icon: "🌊",
      title: "Overwatered",
      description: "Soil is very wet. Allow to dry before next watering.",
    });
  }

  if (sensors.light < 400) {
    items.push({
      type: "warning",
      icon: "☀️",
      title: "Too dark",
      description: "Move to a brighter spot or add a grow light.",
    });
  } else if (sensors.light < 1200) {
    items.push({
      type: "info",
      icon: "☀️",
      title: "Low light",
      description: "Consider moving closer to a window.",
    });
  }

  if (sensors.temperature < 10) {
    items.push({
      type: "warning",
      icon: "🥶",
      title: "Too cold",
      description: "Move away from cold drafts or windows.",
    });
  } else if (sensors.temperature > 32) {
    items.push({
      type: "warning",
      icon: "🔥",
      title: "Too hot",
      description: "Ensure good ventilation and shade from direct sun.",
    });
  }

  if (sensors.humidity < 30) {
    items.push({
      type: "info",
      icon: "💨",
      title: "Low humidity",
      description: "Mist occasionally or use a pebble tray with water.",
    });
  } else if (sensors.humidity > 80) {
    items.push({
      type: "info",
      icon: "🌫️",
      title: "High humidity",
      description: "Improve air circulation to prevent fungal issues.",
    });
  }

  if (items.length === 0) {
    items.push({
      type: "success",
      icon: "✅",
      title: "All conditions good",
      description: "Your plant is in a healthy environment. Keep it up!",
    });
  }

  return items;
}

// ─── Sensor config ────────────────────────────────────────────────────────────

const SENSORS = [
  {
    key: "light" as const,
    label: "Light",
    icon: "☀️",
    min: 0,
    max: 4095,
    unit: "",
    color: "#f59e0b",
    format: (v: number) => `${Math.round(v)}`,
    sub: "ADC 0–4095",
  },
  {
    key: "soilMoisture" as const,
    label: "Soil Moisture",
    icon: "💧",
    min: 0,
    max: 4095,
    unit: "",
    color: "#3b82f6",
    format: (v: number) => `${Math.round(v)}`,
    sub: "ADC 0–4095",
  },
  {
    key: "temperature" as const,
    label: "Temperature",
    icon: "🌡️",
    min: -40,
    max: 80,
    unit: "°C",
    color: "#ef4444",
    format: (v: number) => `${Math.round(v * 10) / 10}°C`,
    sub: "-40 to 80 °C",
  },
  {
    key: "humidity" as const,
    label: "Humidity",
    icon: "🌫️",
    min: 0,
    max: 100,
    unit: "%",
    color: "#8b5cf6",
    format: (v: number) => `${Math.round(v * 10) / 10}%`,
    sub: "Relative humidity",
  },
] as const;

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function Dashboard() {
  const utils = api.useUtils();

  // ── DB state ───────────────────────────────────────────────────────────────
  const { data: dbPlants, isLoading } = api.plant.list.useQuery();

  const createPlant = api.plant.create.useMutation({
    onSuccess: () => utils.plant.list.invalidate(),
  });
  const deletePlant = api.plant.delete.useMutation({
    onSuccess: () => utils.plant.list.invalidate(),
  });

  // ── Local sensor state (simulated) ─────────────────────────────────────────
  const [plants, setPlants] = useState<Plant[]>(INITIAL_PLANTS);
  const [selectedId, setSelectedId] = useState<string>("");
  const [showAdd, setShowAdd] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    species: "",
    topic: "",
    photo: null as string | null,
  });
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Hydrate local plant list from DB whenever the DB data changes
  useEffect(() => {
    if (!dbPlants) return;
    setPlants((prev) => {
      // Build map of existing local plants by id to preserve live sensor data
      const byId = new Map(prev.map((p) => [p.id, p]));
      const next = dbPlants.map((dp) => {
        const id = String(dp.id);
        const existing = byId.get(id);
        if (existing)
          return {
            ...existing,
            name: dp.name,
            species: dp.species ?? "",
            topic: dp.topic ?? "",
            photo: dp.photoUrl ?? null,
          };
        // New plant from DB – generate placeholder sensor data seeded by id
        return {
          id,
          name: dp.name,
          species: dp.species ?? "Unknown species",
          topic:
            dp.topic ??
            `plantera/${dp.name.toLowerCase().replace(/\s+/g, "-")}`,
          photo: dp.photoUrl ?? null,
          ...generatePlantData(dp.id),
        };
      });
      // Keep selected id valid
      if (
        next.length > 0 &&
        (!selectedId || !next.find((p) => p.id === selectedId))
      ) {
        setSelectedId(next[0]!.id);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbPlants]);

  // Simulate broker updates every 3 s
  useEffect(() => {
    const id = setInterval(() => {
      setPlants((prev) =>
        prev.map((p) => ({
          ...p,
          sensors: {
            light: clamp(p.sensors.light + rand(80), 0, 4095),
            soilMoisture: clamp(p.sensors.soilMoisture + rand(30), 0, 4095),
            temperature: clamp(p.sensors.temperature + rand(0.5), -40, 80),
            humidity: clamp(p.sensors.humidity + rand(0.8), 0, 100),
          },
        })),
      );
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const selected = plants.find((p) => p.id === selectedId);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      setForm((f) => ({ ...f, photo: reader.result as string }));
    reader.readAsDataURL(file);
  }

  async function handleAdd() {
    if (!form.name.trim()) return;
    await createPlant.mutateAsync({
      name: form.name.trim(),
      species: form.species.trim() || undefined,
      topic: form.topic.trim() || undefined,
      photoUrl: form.photo ?? undefined,
    });
    setForm({ name: "", species: "", topic: "", photo: null });
    setShowAdd(false);
  }

  async function handleDelete(id: string) {
    await deletePlant.mutateAsync({ id: Number(id) });
    if (selectedId === id)
      setSelectedId(plants.find((p) => p.id !== id)?.id ?? "");
  }

  function selectPlant(id: string) {
    setSelectedId(id);
    setSidebarOpen(false);
  }

  const sidebarContent = (
    <>
      <div className="flex-1 overflow-y-auto p-3">
        <p className="mb-2 px-2 text-xs font-medium tracking-wider text-gray-400 uppercase">
          My Plants
        </p>
        {isLoading ? (
          <div className="space-y-2 px-2 pt-1">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-lg bg-gray-100"
              />
            ))}
          </div>
        ) : (
          <nav className="space-y-0.5">
            {plants.map((p) => (
              <button
                key={p.id}
                onClick={() => selectPlant(p.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${selectedId === p.id ? "bg-green-50 text-green-800" : "text-gray-600 hover:bg-gray-50"}`}
              >
                {p.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.photo}
                    alt={p.name}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-base">
                    🌿
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.name}</div>
                  <div className="truncate text-xs text-gray-400">
                    {p.species}
                  </div>
                </div>
              </button>
            ))}
          </nav>
        )}
      </div>
      <div className="p-3">
        <button
          onClick={() => {
            setSidebarOpen(false);
            setShowAdd(true);
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-green-300 py-2.5 text-sm text-green-600 transition hover:bg-green-50"
        >
          <span className="text-lg leading-none">+</span> Add plant
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-[100dvh] flex-col bg-gray-50">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4">
        {/* Mobile: hamburger */}
        <button
          className="flex items-center gap-2 md:hidden"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open plant list"
        >
          <svg
            className="h-5 w-5 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
          <span className="text-sm font-medium text-gray-700">
            {selected?.name ?? "Plants"}
          </span>
        </button>
        {/* Desktop: logo */}
        <Link href="/" className="hidden items-center gap-2 md:flex">
          <span className="text-xl">🌱</span>
          <span className="font-semibold text-green-800">Plantera</span>
        </Link>
        <UserButton />
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden w-56 shrink-0 flex-col border-r border-gray-200 bg-white md:flex">
          {sidebarContent}
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
            </div>
          ) : selected ? (
            <PlantView
              plant={selected}
              onDelete={handleDelete}
              isDeleting={deletePlant.isPending}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="text-4xl">🌱</div>
              <p className="text-sm text-gray-400">
                No plants yet. Add your first plant!
              </p>
              <button
                onClick={() => setShowAdd(true)}
                className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-green-700"
              >
                Add plant
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute top-0 bottom-0 left-0 flex w-72 flex-col bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-100 px-4">
              <Link href="/" className="flex items-center gap-2">
                <span className="text-xl">🌱</span>
                <span className="font-semibold text-green-800">Plantera</span>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label="Close"
                className="text-gray-400 hover:text-gray-600"
              >
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Add plant dialog */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center"
          onClick={(e) => e.target === e.currentTarget && setShowAdd(false)}
        >
          <div className="w-full rounded-t-2xl bg-white p-6 shadow-xl sm:max-w-sm sm:rounded-2xl">
            <h2 className="mb-5 text-lg font-semibold text-gray-900">
              Add plant
            </h2>
            <div className="space-y-3">
              {/* Photo upload */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Photo (optional)
                </label>
                <div
                  className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-4 transition hover:border-green-300 hover:bg-green-50"
                  onClick={() => photoInputRef.current?.click()}
                >
                  {form.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.photo}
                      alt="Preview"
                      className="h-20 w-20 rounded-full object-cover"
                    />
                  ) : (
                    <>
                      <span className="text-2xl">📷</span>
                      <span className="mt-1 text-xs text-gray-400">
                        Tap to upload
                      </span>
                    </>
                  )}
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
                {form.photo && (
                  <button
                    className="mt-1 text-xs text-gray-400 hover:text-gray-600"
                    onClick={() => setForm((f) => ({ ...f, photo: null }))}
                  >
                    Remove photo
                  </button>
                )}
              </div>

              <Field label="Name *">
                <input
                  className="input"
                  placeholder="e.g. Living Room Monstera"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </Field>
              <Field label="Species">
                <input
                  className="input"
                  placeholder="e.g. Monstera deliciosa"
                  value={form.species}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, species: e.target.value }))
                  }
                />
              </Field>
              <Field label="Broker topic">
                <input
                  className="input font-mono"
                  placeholder="plantera/my-plant"
                  value={form.topic}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, topic: e.target.value }))
                  }
                />
              </Field>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => {
                  setShowAdd(false);
                  setForm({ name: "", species: "", topic: "", photo: null });
                }}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm text-gray-600 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!form.name.trim() || createPlant.isPending}
                className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-40"
              >
                {createPlant.isPending ? "Saving…" : "Add plant"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Plant detail view ────────────────────────────────────────────────────────

function PlantView({
  plant,
  onDelete,
  isDeleting,
}: {
  plant: Plant;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  const guidance = getGuidance(plant.sensors);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        {plant.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={plant.photo}
            alt={plant.name}
            className="h-16 w-16 rounded-2xl object-cover shadow-sm"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-green-100 text-3xl shadow-sm">
            🌿
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">
            {plant.name}
          </h1>
          <p className="truncate text-sm text-gray-400 italic">
            {plant.species}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
            <span className="truncate font-mono text-xs text-gray-400">
              {plant.topic}
            </span>
          </div>
        </div>
        {/* Delete */}
        {confirmDelete ? (
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-gray-500">Remove?</span>
            <button
              onClick={() => onDelete(plant.id)}
              disabled={isDeleting}
              className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-600 disabled:opacity-40"
            >
              {isDeleting ? "…" : "Yes"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition hover:bg-gray-50"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="shrink-0 rounded-lg border border-gray-200 p-2 text-gray-400 transition hover:border-red-200 hover:text-red-400"
            aria-label="Delete plant"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Sensor cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SENSORS.map((s) => {
          const value = plant.sensors[s.key];
          const pct = ((value - s.min) / (s.max - s.min)) * 100;
          return (
            <div
              key={s.key}
              className="rounded-xl bg-white p-3 shadow-sm sm:p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{s.label}</span>
                <span className="text-base">{s.icon}</span>
              </div>
              <div className="mt-2 text-xl font-bold text-gray-900 tabular-nums sm:text-2xl">
                {s.format(value)}
              </div>
              <div className="mt-3 h-1 w-full rounded-full bg-gray-100">
                <div
                  className="h-1 rounded-full transition-[width] duration-700"
                  style={{
                    width: `${Math.max(0, Math.min(100, pct))}%`,
                    backgroundColor: s.color,
                  }}
                />
              </div>
              <div className="mt-1.5 text-xs text-gray-400">{s.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SENSORS.map((s) => (
          <div key={s.key} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm">{s.icon}</span>
              <span className="text-sm font-medium text-gray-700">
                {s.label}
              </span>
              <span className="ml-auto text-xs text-gray-400">24 h</span>
            </div>
            <SensorChart
              data={plant.history[s.key]}
              color={s.color}
              min={s.min}
              max={s.max}
              unit={s.unit}
            />
          </div>
        ))}
      </div>

      {/* Guidance */}
      <div className="rounded-xl bg-white p-4 shadow-sm sm:p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">
          Care Guidance
        </h2>
        <div className="space-y-2">
          {guidance.map((g, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-lg p-3 text-sm ${g.type === "warning" ? "bg-amber-50 text-amber-800" : g.type === "success" ? "bg-green-50 text-green-800" : "bg-blue-50 text-blue-800"}`}
            >
              <span className="mt-0.5 shrink-0 text-base">{g.icon}</span>
              <div>
                <div className="font-medium">{g.title}</div>
                <div className="mt-0.5 opacity-75">{g.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
    </div>
  );
}

function rand(scale: number) {
  return (Math.random() - 0.5) * 2 * scale;
}
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
