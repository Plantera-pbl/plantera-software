"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Props {
  data: { time: string; value: number }[];
  color: string;
  min: number;
  max: number;
  unit: string;
}

export function SensorChart({ data, color, min, max, unit }: Props) {
  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart
        data={data}
        margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
      >
        <XAxis
          dataKey="time"
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
          interval={5}
        />
        <YAxis
          domain={[min, max]}
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "white",
            border: "1px solid #f3f4f6",
            borderRadius: 8,
            fontSize: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
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
