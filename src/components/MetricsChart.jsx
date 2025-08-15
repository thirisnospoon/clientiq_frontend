// ------------------- MetricsChart.jsx -------------------
import React from 'react';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid
} from 'recharts';

/**
 * Generic metrics line chart.
 * (Retention graph was removed from Dashboard; this component stays generic.)
 */
export default function MetricsChart({ data, strokeColor }) {
    const chartData = data.map(({ date, value }) => ({ date: date.format('DD MMM'), value }));
    const gradientId = `grad-${String(strokeColor).replace('#', '')}`;
    return (
        <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={strokeColor} stopOpacity={0.8} />
                        <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip wrapperStyle={{ fontSize: 12 }} />
                <Line
                    type="monotone"
                    dataKey="value"
                    stroke={strokeColor}
                    strokeWidth={3}
                    dot={{ r: 3, stroke: strokeColor, strokeWidth: 1 }}
                    fillOpacity={0.1}
                    fill={`url(#${gradientId})`}
                />
            </LineChart>
        </ResponsiveContainer>
    );
}
