"use client";

import { useEffect, useRef } from "react";

const COOLDOWN_MS = 30 * 60 * 1000; // 30 min between same alert for same plant

interface SensorSnapshot {
  light: number; // 0–100 %
  soilMoisture: number; // 0–100 %
  temperature: number; // °C
  humidity: number; // 0–100 %
}

interface Alert {
  key: string;
  title: string;
  body: string;
}

export interface InAppNotification {
  id: number;
  title: string;
  body: string;
  read: boolean;
  createdAt: Date;
}

function buildAlerts(plantName: string, s: SensorSnapshot): Alert[] {
  const out: Alert[] = [];

  if (s.soilMoisture < 15)
    out.push({
      key: "soil-critical",
      title: `💧 ${plantName} needs water now!`,
      body: `Soil moisture is critically low (${Math.round(s.soilMoisture)}%). Water immediately.`,
    });
  else if (s.soilMoisture < 35)
    out.push({
      key: "soil-low",
      title: `💧 ${plantName} needs water soon`,
      body: `Soil moisture is getting low (${Math.round(s.soilMoisture)}%). Water in the next day or two.`,
    });

  if (s.soilMoisture > 78)
    out.push({
      key: "soil-high",
      title: `🌊 ${plantName} may be overwatered`,
      body: `Soil is very wet (${Math.round(s.soilMoisture)}%). Let it dry before watering again.`,
    });

  if (s.light < 10)
    out.push({
      key: "light-critical",
      title: `☀️ ${plantName} is in the dark`,
      body: `Light level is too low (${Math.round(s.light)}%). Move to a brighter spot.`,
    });
  else if (s.light < 30)
    out.push({
      key: "light-low",
      title: `☀️ ${plantName} has low light`,
      body: `Light is at ${Math.round(s.light)}%. Consider moving closer to a window.`,
    });

  if (s.temperature < 10)
    out.push({
      key: "temp-low",
      title: `🥶 ${plantName} is too cold`,
      body: `Temperature is ${Math.round(s.temperature * 10) / 10}°C. Move away from cold drafts.`,
    });
  else if (s.temperature > 32)
    out.push({
      key: "temp-high",
      title: `🔥 ${plantName} is too hot`,
      body: `Temperature is ${Math.round(s.temperature * 10) / 10}°C. Ensure ventilation and shade.`,
    });

  return out;
}

interface UseNotificationsOptions {
  /** Called for each new alert that passes the cooldown; persists to DB */
  onSave: (title: string, body: string) => void;
}

export function useNotifications({ onSave }: UseNotificationsOptions) {
  const cooldownRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

  function checkAndNotify(
    plantId: string,
    plantName: string,
    sensors: SensorSnapshot,
  ) {
    const now = Date.now();
    const alerts = buildAlerts(plantName, sensors);

    for (const alert of alerts) {
      const key = `${plantId}:${alert.key}`;
      const last = cooldownRef.current.get(key) ?? 0;
      if (now - last < COOLDOWN_MS) continue;
      cooldownRef.current.set(key, now);

      // Persist to DB via callback
      onSave(alert.title, alert.body);

      // Browser push notification if permitted
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        new Notification(alert.title, {
          body: alert.body,
          icon: "/icons/icon-192x192.png",
          badge: "/icons/icon-192x192.png",
          tag: key,
          silent: false,
        });
      }
    }
  }

  return { checkAndNotify };
}

