"use client";

import { useEffect, useRef } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SensorSnapshot {
  light: number; // 0–100 %
  soilMoisture: number; // 0–100 %
  temperature: number; // °C
  humidity: number; // 0–100 %
}

export interface DeviceConfig {
  wateringCooldownMin: number;
  wateringOnPct: number;
  wateringOffPct: number;
  wateringDurationSec: number;
  fanOnPct: number;
  fanOffPct: number;
  lightOnPct: number;
  lightOffPct: number;
  quietHours: { start: string; end: string }[];
  timezoneOffsetMin: number;
  deviceOn: boolean;
}

export const DEFAULT_DEVICE_CONFIG: DeviceConfig = {
  wateringCooldownMin: 30,
  wateringOnPct: 35,
  wateringOffPct: 60,
  wateringDurationSec: 20,
  fanOnPct: 75,
  fanOffPct: 60,
  lightOnPct: 30,
  lightOffPct: 55,
  quietHours: [],
  timezoneOffsetMin: 0,
  deviceOn: true,
};

export interface InAppNotification {
  id: number;
  title: string;
  body: string;
  read: boolean;
  category: string | null;
  severity: string | null;
  plantId: number | null;
  createdAt: Date;
}

export type Severity = "info" | "success" | "warning" | "critical";

interface PendingNotification {
  key: string;
  category: string;
  severity: Severity;
  title: string;
  body: string;
}

interface PlantState {
  watering: boolean; // true between WATERING_STARTED and WATERING_COMPLETED
  fanOn: boolean;
  lightOn: boolean;
  tempAlert: "low" | "high" | null;
}

interface UseNotificationsOptions {
  /** Persists notification to DB (called once per new event after cooldown filter). */
  onSave: (n: {
    title: string;
    body: string;
    plantId?: number;
    category?: string;
    severity?: Severity;
  }) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function pct(v: number) {
  return Math.round(v);
}

function tempStr(v: number) {
  return `${Math.round(v * 10) / 10}°C`;
}

/** Returns true if `now` (UTC) falls inside any of the user's quiet windows. */
function isQuietNow(
  now: Date,
  windows: { start: string; end: string }[],
  tzOffsetMin: number,
): boolean {
  if (windows.length === 0) return false;
  const localMs = now.getTime() + tzOffsetMin * 60_000;
  const local = new Date(localMs);
  const hhmm = local.getUTCHours() * 60 + local.getUTCMinutes();

  for (const w of windows) {
    const [sh, sm] = w.start.split(":").map(Number);
    const [eh, em] = w.end.split(":").map(Number);
    if (
      sh === undefined ||
      sm === undefined ||
      eh === undefined ||
      em === undefined
    )
      continue;
    const s = sh * 60 + sm;
    const e = eh * 60 + em;
    if (s === e) continue;
    // Window may cross midnight (e.g. 22:00 → 07:00)
    if (s < e ? hhmm >= s && hhmm < e : hhmm >= s || hhmm < e) return true;
  }
  return false;
}

/**
 * Compute notifications that should fire by comparing prev → next snapshot
 * against the configured ON/OFF thresholds.
 */
function diffEvents(
  plantName: string,
  prev: SensorSnapshot | null,
  next: SensorSnapshot,
  state: PlantState,
  cfg: DeviceConfig,
): { events: PendingNotification[]; nextState: PlantState } {
  const events: PendingNotification[] = [];
  const ns: PlantState = { ...state };

  // ── Watering (soil moisture) ───────────────────────────────────────────────
  if (!ns.watering && next.soilMoisture < cfg.wateringOnPct) {
    ns.watering = true;
    const from = prev ? `${pct(prev.soilMoisture)}% → ` : "";
    events.push({
      key: "watering-start",
      category: "watering",
      severity: "info",
      title: `💧 ${plantName} — watering started`,
      body: `Soil moisture ${from}${pct(next.soilMoisture)}% dropped below ${cfg.wateringOnPct}% trigger. The device is delivering water (${cfg.wateringDurationSec}s burst).`,
    });
  } else if (ns.watering && next.soilMoisture >= cfg.wateringOffPct) {
    ns.watering = false;
    const from = prev ? `${pct(prev.soilMoisture)}% → ` : "";
    events.push({
      key: "watering-done",
      category: "watering",
      severity: "success",
      title: `✅ ${plantName} — watering complete`,
      body: `Soil moisture restored ${from}${pct(next.soilMoisture)}% (target ≥ ${cfg.wateringOffPct}%). Cycle finished.`,
    });
  }

  // ── Fan (humidity) ─────────────────────────────────────────────────────────
  if (!ns.fanOn && next.humidity > cfg.fanOnPct) {
    ns.fanOn = true;
    const from = prev ? `${pct(prev.humidity)}% → ` : "";
    events.push({
      key: "fan-start",
      category: "fan",
      severity: "info",
      title: `🌀 ${plantName} — fan started`,
      body: `Ambient humidity ${from}${pct(next.humidity)}% rose above ${cfg.fanOnPct}% trigger. Ventilating to bring it down.`,
    });
  } else if (ns.fanOn && next.humidity <= cfg.fanOffPct) {
    ns.fanOn = false;
    const from = prev ? `${pct(prev.humidity)}% → ` : "";
    events.push({
      key: "fan-stop",
      category: "fan",
      severity: "success",
      title: `✅ ${plantName} — fan stopped`,
      body: `Humidity is back to a comfortable ${from}${pct(next.humidity)}% (target ≤ ${cfg.fanOffPct}%).`,
    });
  }

  // ── Grow light ─────────────────────────────────────────────────────────────
  if (!ns.lightOn && next.light < cfg.lightOnPct) {
    ns.lightOn = true;
    const from = prev ? `${pct(prev.light)}% → ` : "";
    events.push({
      key: "light-on",
      category: "light",
      severity: "info",
      title: `💡 ${plantName} — grow light on`,
      body: `Ambient light ${from}${pct(next.light)}% fell below ${cfg.lightOnPct}% trigger. Supplementing with LED.`,
    });
  } else if (ns.lightOn && next.light >= cfg.lightOffPct) {
    ns.lightOn = false;
    const from = prev ? `${pct(prev.light)}% → ` : "";
    events.push({
      key: "light-off",
      category: "light",
      severity: "success",
      title: `✅ ${plantName} — grow light off`,
      body: `Ambient light recovered ${from}${pct(next.light)}% (target ≥ ${cfg.lightOffPct}%). LED shut off.`,
    });
  }

  // ── Temperature (informational only — device can't fix this) ───────────────
  let tempAlert: PlantState["tempAlert"] = null;
  if (next.temperature < 10) tempAlert = "low";
  else if (next.temperature > 32) tempAlert = "high";

  if (tempAlert !== ns.tempAlert) {
    if (tempAlert === "low") {
      events.push({
        key: "temp-low",
        category: "temperature",
        severity: "warning",
        title: `🥶 ${plantName} — cold reading`,
        body: `Temperature dropped to ${tempStr(next.temperature)}. The device cannot heat — consider moving the plant.`,
      });
    } else if (tempAlert === "high") {
      events.push({
        key: "temp-high",
        category: "temperature",
        severity: "warning",
        title: `🔥 ${plantName} — hot reading`,
        body: `Temperature climbed to ${tempStr(next.temperature)}. The device cannot cool — ensure shade / ventilation.`,
      });
    } else {
      events.push({
        key: "temp-ok",
        category: "temperature",
        severity: "success",
        title: `✅ ${plantName} — temperature back to normal`,
        body: `Temperature is now ${tempStr(next.temperature)}.`,
      });
    }
    ns.tempAlert = tempAlert;
  }

  return { events, nextState: ns };
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useNotifications({ onSave }: UseNotificationsOptions) {
  // Per-plant runtime state used to detect transitions.
  const stateRef = useRef<Map<string, PlantState>>(new Map());
  const prevSnapshotRef = useRef<Map<string, SensorSnapshot>>(new Map());
  // Per-plant per-event-key cooldown timestamps (ms epoch).
  const cooldownRef = useRef<Map<string, number>>(new Map());
  // Reminders we've already fired in this session.
  const firedRemindersRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

  function emit(pid: number | undefined, n: PendingNotification) {
    onSave({
      title: n.title,
      body: n.body,
      plantId: pid,
      category: n.category,
      severity: n.severity,
    });

    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      new Notification(n.title, {
        body: n.body,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-192x192.png",
        tag: `${pid ?? "x"}:${n.key}`,
        silent: false,
      });
    }
  }

  /**
   * Compare the new sensor snapshot against the previous one for `plantId`,
   * fire any threshold-crossing events (respecting config, device state,
   * quiet hours and cooldown), and persist them via `onSave`.
   */
  function checkAndNotify(
    plantId: string,
    plantName: string,
    sensors: SensorSnapshot,
    config: DeviceConfig = DEFAULT_DEVICE_CONFIG,
  ) {
    const now = new Date();

    // Always update prev snapshot so future transitions stay accurate even
    // when we suppress this one.
    const prev = prevSnapshotRef.current.get(plantId) ?? null;
    prevSnapshotRef.current.set(plantId, sensors);

    // Master switch and quiet hours fully suppress alerts.
    if (!config.deviceOn) return;
    if (isQuietNow(now, config.quietHours, config.timezoneOffsetMin)) return;

    const state = stateRef.current.get(plantId) ?? {
      watering: false,
      fanOn: false,
      lightOn: false,
      tempAlert: null,
    };

    const { events, nextState } = diffEvents(
      plantName,
      prev,
      sensors,
      state,
      config,
    );
    stateRef.current.set(plantId, nextState);

    const cooldownMs = Math.max(1, config.wateringCooldownMin) * 60_000;
    const nowMs = now.getTime();
    const pidNum = Number.parseInt(plantId, 10);
    const pid = Number.isFinite(pidNum) ? pidNum : undefined;

    for (const ev of events) {
      const cdKey = `${plantId}:${ev.key}`;
      const last = cooldownRef.current.get(cdKey) ?? 0;
      if (nowMs - last < cooldownMs) continue;
      cooldownRef.current.set(cdKey, nowMs);
      emit(pid, ev);
    }
  }

  /**
   * Walk the user's reminders and fire any whose `dueAt` is in the past
   * and that we have not already fired this session.
   */
  function checkReminders(
    reminders: {
      id: number;
      title: string;
      note: string | null;
      dueAt: Date | string;
      done: boolean;
      plantId: number | null;
    }[],
  ) {
    const now = Date.now();
    for (const r of reminders) {
      if (r.done) continue;
      if (firedRemindersRef.current.has(r.id)) continue;
      const due = new Date(r.dueAt).getTime();
      if (due > now) continue;

      firedRemindersRef.current.add(r.id);
      emit(r.plantId ?? undefined, {
        key: `reminder-${r.id}`,
        category: "reminder",
        severity: "info",
        title: `⏰ Reminder: ${r.title}`,
        body: r.note ?? "Scheduled reminder is due.",
      });
    }
  }

  return { checkAndNotify, checkReminders };
}
