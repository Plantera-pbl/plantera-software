"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "next-themes";

interface Props {
  data: { time: string; value: number }[];
  color: string;
  min: number;
  max: number;
  unit: string;
  /** Threshold at which the device *activates* (e.g. watering on, fan on). */
  onThreshold?: number;
  /** Threshold at which the device *deactivates* (e.g. watering off). */
  offThreshold?: number;
}

export function SensorChart({
  data,
  color,
  min,
  max,
  unit,
  onThreshold,
  offThreshold,
}: Props) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Shade the "comfort" zone between the two thresholds so users see at a
  // glance whether the sensor is currently in the band the device targets.
  const lo =
    onThreshold !== undefined && offThreshold !== undefined
      ? Math.min(onThreshold, offThreshold)
      : undefined;
  const hi =
    onThreshold !== undefined && offThreshold !== undefined
      ? Math.max(onThreshold, offThreshold)
      : undefined;

  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart
        data={data}
        margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
      >
        <XAxis
          dataKey="time"
          tick={{ fontSize: 10, fill: isDark ? "#6b7280" : "#9ca3af" }}
          tickLine={false}
          axisLine={false}
          interval={5}
        />
        <YAxis
          domain={[min, max]}
          tick={{ fontSize: 10, fill: isDark ? "#6b7280" : "#9ca3af" }}
          tickLine={false}
          axisLine={false}
        />
        {lo !== undefined && hi !== undefined && (
          <ReferenceArea
            y1={lo}
            y2={hi}
            fill={isDark ? "#16a34a" : "#22c55e"}
            fillOpacity={isDark ? 0.08 : 0.06}
            ifOverflow="extendDomain"
          />
        )}
        {onThreshold !== undefined && (
          <ReferenceLine
            y={onThreshold}
            stroke={isDark ? "#f59e0b" : "#d97706"}
            strokeDasharray="4 3"
            strokeWidth={1}
            label={{
              value: `on ${onThreshold}${unit}`,
              fill: isDark ? "#fbbf24" : "#b45309",
              fontSize: 9,
              position: "insideTopRight",
            }}
          />
        )}
        {offThreshold !== undefined && (
          <ReferenceLine
            y={offThreshold}
            stroke={isDark ? "#10b981" : "#059669"}
            strokeDasharray="4 3"
            strokeWidth={1}
            label={{
              value: `off ${offThreshold}${unit}`,
              fill: isDark ? "#34d399" : "#047857",
              fontSize: 9,
              position: "insideBottomRight",
            }}
          />
        )}
        <Tooltip
          contentStyle={{
            background: isDark ? "#1f2937" : "white",
            border: `1px solid ${isDark ? "#374151" : "#f3f4f6"}`,
            borderRadius: 8,
            fontSize: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            color: isDark ? "#f3f4f6" : "#111827",
          }}
          formatter={(value) => [`${value as number}${unit}`, ""]}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
