"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { SensorChart } from "./SensorChart";
import {
  useNotifications,
  DEFAULT_DEVICE_CONFIG,
  type DeviceConfig,
} from "./useNotifications";
import { api } from "@/trpc/react";
import { ThemeToggle } from "@/app/_components/ThemeToggle";

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
  light: number; // 0–100 %
  soilMoisture: number; // 0–100 %
  temperature: number; // °C (-40–80)
  humidity: number; // 0–100 %
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
      light: Math.round((20 + r(1) * 75) * 10) / 10,
      soilMoisture: Math.round((20 + r(2) * 65) * 10) / 10,
      temperature: Math.round((15 + r(3) * 20) * 10) / 10,
      humidity: Math.round((40 + r(4) * 40) * 10) / 10,
    },
    history: {
      light: generateHistory(0, 100, seed * 11 + 1),
      soilMoisture: generateHistory(0, 100, seed * 11 + 2),
      temperature: generateHistory(-40, 80, seed * 11 + 3),
      humidity: generateHistory(0, 100, seed * 11 + 4),
    },
  };
}

const INITIAL_PLANTS: Plant[] = [];

// ─── Broker ───────────────────────────────────────────────────────────────────

const BROKER_URL = process.env.NEXT_PUBLIC_BROKER_URL ?? "";

interface BrokerReading {
  id: number;
  device_id: number;
  timestamp: string;
  payload: Record<string, unknown>;
  light: number | null;
  soil_moisture: number | null;
  temp: number | null;
  ambient_humidity: number | null;
}

async function fetchLatest(deviceId: string): Promise<BrokerReading | null> {
  if (!BROKER_URL || !deviceId) return null;
  try {
    const res = await fetch(
      `${BROKER_URL}/api/v1/devices/${deviceId}/readings/latest`,
    );
    if (!res.ok) return null;
    return res.json() as Promise<BrokerReading>;
  } catch {
    return null;
  }
}

async function fetchHistory(
  deviceId: string,
  limit = 48,
): Promise<BrokerReading[]> {
  if (!BROKER_URL || !deviceId) return [];
  try {
    const res = await fetch(
      `${BROKER_URL}/api/v1/devices/${deviceId}/readings?limit=${limit}`,
    );
    if (!res.ok) return [];
    return res.json() as Promise<BrokerReading[]>;
  } catch {
    return [];
  }
}

function toHistoryPoint(r: BrokerReading): {
  time: string;
  light: number;
  soilMoisture: number;
  temperature: number;
  humidity: number;
} {
  const t = new Date(r.timestamp);
  return {
    time: `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`,
    light: r.light ?? 0,
    soilMoisture: r.soil_moisture ?? 0,
    temperature: r.temp ?? 0,
    humidity: r.ambient_humidity ?? 0,
  };
}

// ─── Guidance ─────────────────────────────────────────────────────────────────

interface Guidance {
  type: "success" | "warning" | "info";
  icon: string;
  title: string;
  description: string;
}

function getGuidance(sensors: SensorData): Guidance[] {
  const items: Guidance[] = [];

  if (sensors.soilMoisture < 15) {
    items.push({
      type: "warning",
      icon: "💧",
      title: "Water immediately",
      description: "Soil is critically dry. Water your plant now.",
    });
  } else if (sensors.soilMoisture < 35) {
    items.push({
      type: "info",
      icon: "💧",
      title: "Water soon",
      description: "Soil moisture is low. Water in the next 1-2 days.",
    });
  } else if (sensors.soilMoisture > 78) {
    items.push({
      type: "warning",
      icon: "🌊",
      title: "Overwatered",
      description: "Soil is very wet. Allow to dry before next watering.",
    });
  }

  if (sensors.light < 10) {
    items.push({
      type: "warning",
      icon: "☀️",
      title: "Too dark",
      description: "Move to a brighter spot or add a grow light.",
    });
  } else if (sensors.light < 30) {
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
    max: 100,
    unit: "%",
    color: "#f59e0b",
    format: (v: number) => `${Math.round(v)}%`,
    sub: "0–100 %",
  },
  {
    key: "soilMoisture" as const,
    label: "Soil Moisture",
    icon: "💧",
    min: 0,
    max: 100,
    unit: "%",
    color: "#3b82f6",
    format: (v: number) => `${Math.round(v)}%`,
    sub: "0–100 %",
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
    icon: "💦",
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

  // ── Notifications (DB-backed) ──────────────────────────────────────────────
  const { data: dbNotifications } = api.notification.list.useQuery();
  const createNotification = api.notification.create.useMutation({
    onSuccess: () => utils.notification.list.invalidate(),
  });
  const markAllReadMutation = api.notification.markAllRead.useMutation({
    onSuccess: () => utils.notification.list.invalidate(),
  });

  const notifications = dbNotifications ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const { checkAndNotify, checkReminders } = useNotifications({
    onSave: ({ title, body, plantId, category, severity }) => {
      void createNotification.mutateAsync({
        title,
        body,
        plantId,
        category,
        severity,
      });
    },
  });

  // ── DB state ───────────────────────────────────────────────────────────────
  const { data: dbPlants, isLoading } = api.plant.list.useQuery();

  const createPlant = api.plant.create.useMutation({
    onSuccess: () => utils.plant.list.invalidate(),
  });
  const updatePlant = api.plant.update.useMutation({
    onSuccess: () => utils.plant.list.invalidate(),
  });
  const deletePlant = api.plant.delete.useMutation({
    onSuccess: () => utils.plant.list.invalidate(),
  });

  // ── Local sensor state (simulated) ─────────────────────────────────────────
  const [plants, setPlants] = useState<Plant[]>(INITIAL_PLANTS);
  const [selectedId, setSelectedId] = useState<string>("");
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingId, setEditingId] = useState<string>("");
  const [editForm, setEditForm] = useState({
    name: "",
    species: "",
    topic: "",
    photo: null as string | null,
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    name: "",
    species: "",
    topic: "",
    photo: null as string | null,
  });
  const photoInputRef = useRef<HTMLInputElement>(null);
  const editPhotoInputRef = useRef<HTMLInputElement>(null);
  // Always holds the current selected plant's name for use inside intervals
  const selectedNameRef = useRef<string>("Your plant");
  useEffect(() => {
    const p = plants.find((pl) => pl.id === selectedId);
    if (p) selectedNameRef.current = p.name;
  }, [plants, selectedId]);

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

  const selectedTopic = plants.find((p) => p.id === selectedId)?.topic ?? "";

  // ── Per-plant device config + reminders ────────────────────────────────────
  const selectedDbId = Number.parseInt(selectedId, 10);
  const hasSelectedDbId = Number.isFinite(selectedDbId);
  const { data: deviceConfigData } = api.config.get.useQuery(
    { plantId: selectedDbId },
    { enabled: hasSelectedDbId },
  );
  const upsertConfig = api.config.upsert.useMutation({
    onSuccess: () => utils.config.get.invalidate(),
  });
  const activeConfig: DeviceConfig = useMemo(
    () =>
      deviceConfigData
        ? {
            wateringCooldownMin: deviceConfigData.wateringCooldownMin,
            wateringOnPct: deviceConfigData.wateringOnPct,
            wateringOffPct: deviceConfigData.wateringOffPct,
            wateringDurationSec: deviceConfigData.wateringDurationSec,
            fanOnPct: deviceConfigData.fanOnPct,
            fanOffPct: deviceConfigData.fanOffPct,
            lightOnPct: deviceConfigData.lightOnPct,
            lightOffPct: deviceConfigData.lightOffPct,
            quietHours:
              (deviceConfigData.quietHours as {
                start: string;
                end: string;
              }[]) ?? [],
            timezoneOffsetMin: deviceConfigData.timezoneOffsetMin,
            deviceOn: deviceConfigData.deviceOn,
          }
        : DEFAULT_DEVICE_CONFIG,
    [deviceConfigData],
  );

  const { data: remindersData } = api.reminder.list.useQuery();
  const createReminder = api.reminder.create.useMutation({
    onSuccess: () => utils.reminder.list.invalidate(),
  });
  const markReminderDone = api.reminder.markDone.useMutation({
    onSuccess: () => utils.reminder.list.invalidate(),
  });
  const deleteReminder = api.reminder.delete.useMutation({
    onSuccess: () => utils.reminder.list.invalidate(),
  });
  const reminders = remindersData ?? [];

  // Keep activeConfig in a ref so the 5s poll uses the freshest value
  // without restarting the interval each render.
  const activeConfigRef = useRef<DeviceConfig>(activeConfig);
  useEffect(() => {
    activeConfigRef.current = activeConfig;
  }, [activeConfig]);

  // Check reminders every 30s
  useEffect(() => {
    checkReminders(reminders);
    const id = setInterval(() => checkReminders(reminders), 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminders]);

  // ── Broker: load history when selected plant changes ───────────────────────
  useEffect(() => {
    if (!BROKER_URL || !selectedTopic) return;
    let cancelled = false;
    void fetchHistory(selectedTopic).then((readings) => {
      if (cancelled || readings.length === 0) return;
      const pts = [...readings].reverse().map(toHistoryPoint);
      const latest = readings[0]!;
      setPlants((prev) =>
        prev.map((p) =>
          p.id === selectedId
            ? {
                ...p,
                sensors: {
                  light: latest.light ?? p.sensors.light,
                  soilMoisture: latest.soil_moisture ?? p.sensors.soilMoisture,
                  temperature: latest.temp ?? p.sensors.temperature,
                  humidity: latest.ambient_humidity ?? p.sensors.humidity,
                },
                history: {
                  light: pts.map((pt) => ({ time: pt.time, value: pt.light })),
                  soilMoisture: pts.map((pt) => ({
                    time: pt.time,
                    value: pt.soilMoisture,
                  })),
                  temperature: pts.map((pt) => ({
                    time: pt.time,
                    value: pt.temperature,
                  })),
                  humidity: pts.map((pt) => ({
                    time: pt.time,
                    value: pt.humidity,
                  })),
                },
              }
            : p,
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId, selectedTopic]);

  // ── Broker: poll for live readings every 5 s ──────────────────────────────
  useEffect(() => {
    if (!BROKER_URL || !selectedTopic) return;
    const id = setInterval(() => {
      void (async () => {
        const reading = await fetchLatest(selectedTopic);
        if (!reading) return;
        const ts = new Date(reading.timestamp);
        const time = `${String(ts.getHours()).padStart(2, "0")}:${String(ts.getMinutes()).padStart(2, "0")}`;
        const newSensors = {
          light: reading.light ?? 0,
          soilMoisture: reading.soil_moisture ?? 0,
          temperature: reading.temp ?? 0,
          humidity: reading.ambient_humidity ?? 0,
        };
        checkAndNotify(
          selectedId,
          selectedNameRef.current,
          newSensors,
          activeConfigRef.current,
        );
        setPlants((prev) =>
          prev.map((p) => {
            if (p.id !== selectedId) return p;
            return {
              ...p,
              sensors: newSensors,
              history: {
                light: [
                  ...p.history.light.slice(-47),
                  { time, value: newSensors.light },
                ],
                soilMoisture: [
                  ...p.history.soilMoisture.slice(-47),
                  { time, value: newSensors.soilMoisture },
                ],
                temperature: [
                  ...p.history.temperature.slice(-47),
                  { time, value: newSensors.temperature },
                ],
                humidity: [
                  ...p.history.humidity.slice(-47),
                  { time, value: newSensors.humidity },
                ],
              },
            };
          }),
        );
      })();
    }, 5_000);
    return () => clearInterval(id);
    // checkAndNotify is stable (ref-based), intentionally omitted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedTopic]);

  // ── Simulate updates for plants without a broker connection ────────────────
  useEffect(() => {
    if (BROKER_URL) return;
    const id = setInterval(() => {
      setPlants((prev) =>
        prev.map((p) => ({
          ...p,
          sensors: {
            light: clamp(p.sensors.light + rand(2), 0, 100),
            soilMoisture: clamp(p.sensors.soilMoisture + rand(1), 0, 100),
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

  function handleEditOpen(id: string) {
    const plant = plants.find((p) => p.id === id);
    if (!plant) return;
    setEditingId(id);
    setEditForm({
      name: plant.name,
      species: plant.species,
      topic: plant.topic,
      photo: plant.photo,
    });
    setShowEdit(true);
  }

  async function handleEditSave() {
    if (!editForm.name.trim()) return;
    await updatePlant.mutateAsync({
      id: Number(editingId),
      name: editForm.name.trim(),
      species: editForm.species.trim() || undefined,
      topic: editForm.topic.trim() || undefined,
      photoUrl: editForm.photo ?? undefined,
    });
    setShowEdit(false);
  }

  function handleEditPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      setEditForm((f) => ({ ...f, photo: reader.result as string }));
    reader.readAsDataURL(file);
  }

  // Close notification dropdown on outside click
  useEffect(() => {
    if (!notifOpen) return;
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [notifOpen]);

  function selectPlant(id: string) {
    setSelectedId(id);
    setSidebarOpen(false);
  }

  const sidebarContent = (
    <>
      <div className="flex-1 overflow-y-auto p-3">
        <p className="mb-2 px-2 text-xs font-medium tracking-wider text-gray-400 uppercase dark:text-gray-500">
          My Plants
        </p>
        {isLoading ? (
          <div className="space-y-2 px-2 pt-1">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"
              />
            ))}
          </div>
        ) : (
          <nav className="space-y-0.5">
            {plants.map((p) => (
              <button
                key={p.id}
                onClick={() => selectPlant(p.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${selectedId === p.id ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400" : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"}`}
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
                  <div className="truncate text-xs text-gray-400 dark:text-gray-500">
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
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-green-300 py-2.5 text-sm text-green-600 transition hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/20"
        >
          <span className="text-lg leading-none">+</span> Add plant
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-[100dvh] flex-col bg-gray-50 dark:bg-gray-950">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-900">
        {/* Mobile: hamburger */}
        <button
          className="flex items-center gap-2 md:hidden"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open plant list"
        >
          <svg
            className="h-5 w-5 text-gray-500 dark:text-gray-400"
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
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {selected?.name ?? "Plants"}
          </span>
        </button>
        {/* Desktop: logo */}
        <Link href="/" className="hidden items-center gap-2 md:flex">
          <span className="text-xl">🌱</span>
          <span className="font-semibold text-green-800 dark:text-green-400">
            Plantera
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {/* Notification bell */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => {
                setNotifOpen((o) => !o);
                if (!notifOpen) void markAllReadMutation.mutateAsync();
              }}
              aria-label="Notifications"
              className="relative rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
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
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <NotificationDropdown
                notifications={notifications}
                onClose={() => setNotifOpen(false)}
              />
            )}
          </div>
          {/* Reminders */}
          <button
            onClick={() => setShowReminders(true)}
            aria-label="Reminders"
            title="Reminders"
            className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
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
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
          {/* Per-plant settings */}
          {hasSelectedDbId && (
            <button
              onClick={() => setShowSettings(true)}
              aria-label="Plant settings"
              title="Plant device settings"
              className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
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
                  d="M10.325 4.317a1 1 0 011.35 0l.755.755a1 1 0 001.06.226l1.013-.338a1 1 0 011.281.628l.338 1.013a1 1 0 00.776.776l1.013.338a1 1 0 01.628 1.281l-.338 1.013a1 1 0 00.226 1.06l.755.755a1 1 0 010 1.35l-.755.755a1 1 0 00-.226 1.06l.338 1.013a1 1 0 01-.628 1.281l-1.013.338a1 1 0 00-.776.776l-.338 1.013a1 1 0 01-1.281.628l-1.013-.338a1 1 0 00-1.06.226l-.755.755a1 1 0 01-1.35 0l-.755-.755a1 1 0 00-1.06-.226l-1.013.338a1 1 0 01-1.281-.628l-.338-1.013a1 1 0 00-.776-.776l-1.013-.338a1 1 0 01-.628-1.281l.338-1.013a1 1 0 00-.226-1.06l-.755-.755a1 1 0 010-1.35l.755-.755a1 1 0 00.226-1.06l-.338-1.013a1 1 0 01.628-1.281l1.013-.338a1 1 0 00.776-.776l.338-1.013a1 1 0 011.281-.628l1.013.338a1 1 0 001.06-.226l.755-.755zM12 15a3 3 0 100-6 3 3 0 000 6z"
                />
              </svg>
            </button>
          )}
          <ThemeToggle />
          <UserButton />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden w-56 shrink-0 flex-col border-r border-gray-200 bg-white md:flex dark:border-gray-700 dark:bg-gray-900">
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
              config={activeConfig}
              onDelete={handleDelete}
              onEdit={handleEditOpen}
              isDeleting={deletePlant.isPending}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="text-4xl">🌱</div>
              <p className="text-sm text-gray-400 dark:text-gray-500">
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
            className="absolute top-0 bottom-0 left-0 flex w-72 flex-col bg-white shadow-xl dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-100 px-4 dark:border-gray-700">
              <Link href="/" className="flex items-center gap-2">
                <span className="text-xl">🌱</span>
                <span className="font-semibold text-green-800 dark:text-green-400">
                  Plantera
                </span>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label="Close"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
          <div className="w-full rounded-t-2xl bg-white p-6 shadow-xl sm:max-w-sm sm:rounded-2xl dark:bg-gray-900">
            <h2 className="mb-5 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Add plant
            </h2>
            <div className="space-y-3">
              {/* Photo upload */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Photo (optional)
                </label>
                <div
                  className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-4 transition hover:border-green-300 hover:bg-green-50 dark:border-gray-700 dark:hover:border-green-600 dark:hover:bg-green-900/10"
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
                      <span className="mt-1 text-xs text-gray-400 dark:text-gray-500">
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
                    className="mt-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
              <Field label="Device ID">
                <input
                  className="input font-mono"
                  placeholder="e.g. 1"
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
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
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

      {/* Settings dialog */}
      {showSettings && hasSelectedDbId && (
        <SettingsDialog
          plantId={selectedDbId}
          plantName={selected?.name ?? "Plant"}
          initial={activeConfig}
          onClose={() => setShowSettings(false)}
          onSave={async (cfg) => {
            await upsertConfig.mutateAsync({ plantId: selectedDbId, ...cfg });
            setShowSettings(false);
          }}
          isSaving={upsertConfig.isPending}
        />
      )}

      {/* Reminders dialog */}
      {showReminders && (
        <RemindersDialog
          reminders={reminders}
          plants={plants}
          onClose={() => setShowReminders(false)}
          onCreate={async (input) => {
            await createReminder.mutateAsync(input);
          }}
          onDone={async (id) => {
            await markReminderDone.mutateAsync({ id });
          }}
          onDelete={async (id) => {
            await deleteReminder.mutateAsync({ id });
          }}
          isCreating={createReminder.isPending}
        />
      )}

      {/* Edit plant dialog */}
      {showEdit && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center"
          onClick={(e) => e.target === e.currentTarget && setShowEdit(false)}
        >
          <div className="w-full rounded-t-2xl bg-white p-6 shadow-xl sm:max-w-sm sm:rounded-2xl dark:bg-gray-900">
            <h2 className="mb-5 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Edit plant
            </h2>
            <div className="space-y-3">
              {/* Photo upload */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Photo (optional)
                </label>
                <div
                  className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-4 transition hover:border-green-300 hover:bg-green-50 dark:border-gray-700 dark:hover:border-green-600 dark:hover:bg-green-900/10"
                  onClick={() => editPhotoInputRef.current?.click()}
                >
                  {editForm.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={editForm.photo}
                      alt="Preview"
                      className="h-20 w-20 rounded-full object-cover"
                    />
                  ) : (
                    <>
                      <span className="text-2xl">📷</span>
                      <span className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        Tap to upload
                      </span>
                    </>
                  )}
                </div>
                <input
                  ref={editPhotoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleEditPhotoChange}
                />
                {editForm.photo && (
                  <button
                    className="mt-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    onClick={() => setEditForm((f) => ({ ...f, photo: null }))}
                  >
                    Remove photo
                  </button>
                )}
              </div>

              <Field label="Name *">
                <input
                  className="input"
                  placeholder="e.g. Living Room Monstera"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </Field>
              <Field label="Species">
                <input
                  className="input"
                  placeholder="e.g. Monstera deliciosa"
                  value={editForm.species}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, species: e.target.value }))
                  }
                />
              </Field>
              <Field label="Device ID">
                <input
                  className="input font-mono"
                  placeholder="e.g. 1"
                  value={editForm.topic}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, topic: e.target.value }))
                  }
                />
              </Field>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowEdit(false)}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={!editForm.name.trim() || updatePlant.isPending}
                className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-40"
              >
                {updatePlant.isPending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Notification dropdown ────────────────────────────────────────────────────

function NotificationDropdown({
  notifications,
  onClose,
}: {
  notifications: {
    id: number;
    title: string;
    body: string;
    read: boolean;
    category?: string | null;
    severity?: string | null;
    createdAt: Date;
  }[];
  onClose: () => void;
}) {
  function formatTime(d: Date) {
    return new Date(d).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function severityClass(sev: string | null | undefined) {
    switch (sev) {
      case "success":
        return "border-l-green-500";
      case "warning":
        return "border-l-amber-500";
      case "critical":
        return "border-l-red-500";
      default:
        return "border-l-blue-500";
    }
  }

  return (
    <div className="fixed inset-x-2 top-14 z-50 rounded-xl border border-gray-100 bg-white shadow-lg md:absolute md:inset-x-auto md:top-full md:right-0 md:mt-2 md:w-80 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Notifications
        </span>
        <button
          onClick={onClose}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          Close
        </button>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-400">
            No notifications yet
          </p>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`border-b border-l-4 border-gray-50 px-4 py-3 last:border-b-0 dark:border-gray-800 ${severityClass(n.severity)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {n.title}
                </p>
                <span className="shrink-0 text-[10px] text-gray-400">
                  {formatTime(n.createdAt)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {n.body}
              </p>
              {n.category && (
                <span className="mt-1 inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-gray-500 uppercase dark:bg-gray-800 dark:text-gray-400">
                  {n.category}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Plant detail view ────────────────────────────────────────────────────────

function PlantView({
  plant,
  config,
  onDelete,
  onEdit,
  isDeleting,
}: {
  plant: Plant;
  config: DeviceConfig;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  isDeleting: boolean;
}) {
  const guidance = getGuidance(plant.sensors);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [timePoints, setTimePoints] = useState(Infinity);

  const TIME_RANGES = [
    { label: "1h", points: 4 },
    { label: "6h", points: 10 },
    { label: "12h", points: 18 },
    { label: "24h", points: Infinity },
  ] as const;

  function filterHistory(data: { time: string; value: number }[]) {
    if (timePoints === Infinity) return data;
    return data.slice(-timePoints);
  }

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
          <h1 className="truncate text-xl font-bold text-gray-900 sm:text-2xl dark:text-gray-100">
            {plant.name}
          </h1>
          <p className="truncate text-sm text-gray-400 italic dark:text-gray-500">
            {plant.species}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
            <span className="truncate font-mono text-xs text-gray-400 dark:text-gray-500">
              {plant.topic}
            </span>
          </div>
        </div>
        {/* Edit + Delete */}
        <div className="flex shrink-0 items-center gap-2">
          {confirmDelete ? (
            <>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Remove?
              </span>
              <button
                onClick={() => onDelete(plant.id)}
                disabled={isDeleting}
                className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-600 disabled:opacity-40"
              >
                {isDeleting ? "…" : "Yes"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                No
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onEdit(plant.id)}
                className="rounded-lg border border-gray-200 p-2 text-gray-400 transition hover:border-green-200 hover:text-green-500 dark:border-gray-600 dark:hover:border-green-700"
                aria-label="Edit plant"
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
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="rounded-lg border border-gray-200 p-2 text-gray-400 transition hover:border-red-200 hover:text-red-400 dark:border-gray-600 dark:hover:border-red-700"
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
            </>
          )}
        </div>
      </div>

      {/* Sensor cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SENSORS.map((s) => {
          const value = plant.sensors[s.key];
          const pct = ((value - s.min) / (s.max - s.min)) * 100;
          return (
            <div
              key={s.key}
              className="rounded-xl bg-white p-3 shadow-sm sm:p-4 dark:bg-gray-900"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {s.label}
                </span>
                <span className="text-base">{s.icon}</span>
              </div>
              <div className="mt-2 text-xl font-bold text-gray-900 tabular-nums sm:text-2xl dark:text-gray-100">
                {s.format(value)}
              </div>
              <div className="mt-3 h-1 w-full rounded-full bg-gray-100 dark:bg-gray-700">
                <div
                  className="h-1 rounded-full transition-[width] duration-700"
                  style={{
                    width: `${Math.max(0, Math.min(100, pct))}%`,
                    backgroundColor: s.color,
                  }}
                />
              </div>
              <div className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                {s.sub}
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
        {/* Time range filter */}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Sensor history
          </span>
          <div className="flex gap-1">
            {TIME_RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => setTimePoints(r.points)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${timePoints === r.points ? "bg-green-600 text-white" : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SENSORS.map((s) => {
            // Map sensor → configured ON/OFF thresholds so the chart can
            // draw reference lines that reflect the actual automation.
            let onThreshold: number | undefined;
            let offThreshold: number | undefined;
            if (s.key === "soilMoisture") {
              onThreshold = config.wateringOnPct;
              offThreshold = config.wateringOffPct;
            } else if (s.key === "humidity") {
              onThreshold = config.fanOnPct;
              offThreshold = config.fanOffPct;
            } else if (s.key === "light") {
              onThreshold = config.lightOnPct;
              offThreshold = config.lightOffPct;
            } else if (s.key === "temperature") {
              onThreshold = 10; // cold alert
              offThreshold = 32; // hot alert
            }
            return (
              <div
                key={s.key}
                className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm">{s.icon}</span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {s.label}
                  </span>
                </div>
                <SensorChart
                  data={filterHistory(plant.history[s.key])}
                  color={s.color}
                  min={s.min}
                  max={s.max}
                  unit={s.unit}
                  onThreshold={onThreshold}
                  offThreshold={offThreshold}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Guidance */}
      <div className="rounded-xl bg-white p-4 shadow-sm sm:p-5 dark:bg-gray-900">
        <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Care Guidance
        </h2>
        <div className="space-y-2">
          {guidance.map((g, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-lg p-3 text-sm ${g.type === "warning" ? "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300" : g.type === "success" ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300" : "bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300"}`}
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
      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
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

// ─── Settings (per-plant device config) ───────────────────────────────────────

function SettingsDialog({
  plantId: _plantId,
  plantName,
  initial,
  onClose,
  onSave,
  isSaving,
}: {
  plantId: number;
  plantName: string;
  initial: DeviceConfig;
  onClose: () => void;
  onSave: (cfg: DeviceConfig) => Promise<void> | void;
  isSaving: boolean;
}) {
  const [cfg, setCfg] = useState<DeviceConfig>(initial);

  function num(
    key: keyof DeviceConfig,
    label: string,
    suffix = "",
    min = 0,
    max = 100,
  ) {
    return (
      <Field label={`${label}${suffix ? ` (${suffix})` : ""}`}>
        <input
          type="number"
          className="input"
          min={min}
          max={max}
          value={cfg[key] as number}
          onChange={(e) =>
            setCfg((c) => ({ ...c, [key]: Number(e.target.value) }))
          }
        />
      </Field>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:max-w-md sm:rounded-2xl dark:bg-gray-900">
        <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Device settings
        </h2>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          {plantName} — these thresholds drive both the device and the
          notification engine.
        </p>

        <div className="mb-4 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Device enabled
          </span>
          <button
            onClick={() => setCfg((c) => ({ ...c, deviceOn: !c.deviceOn }))}
            className={`relative h-6 w-11 rounded-full transition ${cfg.deviceOn ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`}
            aria-label="Toggle device"
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${cfg.deviceOn ? "translate-x-5" : ""}`}
            />
          </button>
        </div>

        <div className="space-y-4">
          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              💧 Watering
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {num("wateringOnPct", "Trigger ≤", "%")}
              {num("wateringOffPct", "Stop ≥", "%")}
              {num("wateringDurationSec", "Burst", "s", 1, 600)}
              {num("wateringCooldownMin", "Cooldown", "min", 0, 720)}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              🌀 Fan (humidity)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {num("fanOnPct", "Trigger ≥", "%")}
              {num("fanOffPct", "Stop ≤", "%")}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              💡 Grow light
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {num("lightOnPct", "Trigger ≤", "%")}
              {num("lightOffPct", "Stop ≥", "%")}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              🌙 Quiet hours
            </h3>
            <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
              No notifications fire during these windows. Times are in local
              time (24h, HH:mm).
            </p>
            {cfg.quietHours.map((w, i) => (
              <div key={i} className="mb-2 flex items-center gap-2">
                <input
                  type="time"
                  className="input flex-1"
                  value={w.start}
                  onChange={(e) =>
                    setCfg((c) => {
                      const next = [...c.quietHours];
                      next[i] = { ...next[i]!, start: e.target.value };
                      return { ...c, quietHours: next };
                    })
                  }
                />
                <span className="text-xs text-gray-400">→</span>
                <input
                  type="time"
                  className="input flex-1"
                  value={w.end}
                  onChange={(e) =>
                    setCfg((c) => {
                      const next = [...c.quietHours];
                      next[i] = { ...next[i]!, end: e.target.value };
                      return { ...c, quietHours: next };
                    })
                  }
                />
                <button
                  onClick={() =>
                    setCfg((c) => ({
                      ...c,
                      quietHours: c.quietHours.filter((_, j) => j !== i),
                    }))
                  }
                  className="rounded p-1 text-gray-400 hover:text-red-500"
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                setCfg((c) => ({
                  ...c,
                  quietHours: [
                    ...c.quietHours,
                    { start: "22:00", end: "07:00" },
                  ],
                }))
              }
              className="text-xs text-green-600 hover:underline dark:text-green-400"
            >
              + Add quiet window
            </button>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              🌐 Timezone offset (minutes from UTC)
            </h3>
            <input
              type="number"
              className="input"
              min={-840}
              max={840}
              value={cfg.timezoneOffsetMin}
              onChange={(e) =>
                setCfg((c) => ({
                  ...c,
                  timezoneOffsetMin: Number(e.target.value),
                }))
              }
            />
            <p className="mt-1 text-xs text-gray-400">
              e.g. 120 for UTC+2, -300 for UTC-5
            </p>
          </section>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={() => void onSave(cfg)}
            disabled={isSaving}
            className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-40"
          >
            {isSaving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reminders dialog ─────────────────────────────────────────────────────────

function RemindersDialog({
  reminders,
  plants,
  onClose,
  onCreate,
  onDone,
  onDelete,
  isCreating,
}: {
  reminders: {
    id: number;
    title: string;
    note: string | null;
    plantId: number | null;
    dueAt: Date | string;
    done: boolean;
  }[];
  plants: Plant[];
  onClose: () => void;
  onCreate: (input: {
    title: string;
    note?: string;
    plantId?: number;
    dueAt: Date;
  }) => Promise<void>;
  onDone: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  isCreating: boolean;
}) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [days, setDays] = useState(30);
  const [plantId, setPlantId] = useState<string>("");

  async function add() {
    if (!title.trim()) return;
    const dueAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await onCreate({
      title: title.trim(),
      note: note.trim() || undefined,
      plantId: plantId ? Number(plantId) : undefined,
      dueAt,
    });
    setTitle("");
    setNote("");
    setDays(30);
    setPlantId("");
  }

  function fmt(d: Date | string) {
    return new Date(d).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:max-w-md sm:rounded-2xl dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          ⏰ Reminders
        </h2>

        <div className="mb-5 space-y-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
          <Field label="Title">
            <input
              className="input"
              placeholder="e.g. Add fertiliser"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="Note (optional)">
            <input
              className="input"
              placeholder="e.g. Use diluted NPK 10-10-10"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="In how many days">
              <input
                type="number"
                className="input"
                min={1}
                max={365}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              />
            </Field>
            <Field label="Plant (optional)">
              <select
                className="input"
                value={plantId}
                onChange={(e) => setPlantId(e.target.value)}
              >
                <option value="">— Any —</option>
                {plants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <button
            onClick={() => void add()}
            disabled={!title.trim() || isCreating}
            className="w-full rounded-lg bg-green-600 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-40"
          >
            {isCreating ? "Adding…" : "+ Add reminder"}
          </button>
        </div>

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {reminders.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              No reminders yet
            </p>
          ) : (
            reminders.map((r) => {
              const overdue =
                !r.done && new Date(r.dueAt).getTime() < Date.now();
              return (
                <div
                  key={r.id}
                  className={`rounded-lg border p-3 ${r.done ? "border-gray-100 bg-gray-50 opacity-60 dark:border-gray-700 dark:bg-gray-800" : overdue ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20" : "border-gray-100 dark:border-gray-700"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium ${r.done ? "line-through" : ""} text-gray-800 dark:text-gray-200`}
                      >
                        {r.title}
                      </p>
                      {r.note && (
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {r.note}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-gray-400">
                        Due {fmt(r.dueAt)}
                        {overdue && " · overdue"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {!r.done && (
                        <button
                          onClick={() => void onDone(r.id)}
                          className="rounded p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                          aria-label="Mark done"
                          title="Mark done"
                        >
                          ✓
                        </button>
                      )}
                      <button
                        onClick={() => void onDelete(r.id)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800"
                        aria-label="Delete"
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-5">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-gray-200 py-2.5 text-sm text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
