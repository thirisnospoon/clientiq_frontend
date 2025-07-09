import React from "react";
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
} from "recharts";

/**
 * props:
 *   data    – масив { name, value }
 *   colors  – масив кольорів
 *   height  – висота діаграми (responsive)
 */
export default function TotalClientsDiagram({ data, colors, height = 300 }) {
    return (
        <ResponsiveContainer width="100%" height={height}>
            <PieChart>
                <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="85%"
                    paddingAngle={2}
                    stroke="none"
                    label={({ name, value }) => `${name}: ${value}`}
                >
                    {data.map((entry, idx) => (
                        <Cell key={entry.name} fill={colors[idx % colors.length]} />
                    ))}
                </Pie>
                <Tooltip />
            </PieChart>
        </ResponsiveContainer>
    );
}
