import React from "react";
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
} from "recharts";

/**
 * data   – масив із полями { name, value }
 * colors – масив кольорів (три елементи)
 */
export default function TotalClientsDiagram({ data, colors }) {
    const RADIAN = Math.PI / 180;

    // Функція для відображення підписів трохи далі від лінії
    const renderCustomizedLabel = ({
                                       cx,
                                       cy,
                                       midAngle,
                                       outerRadius,
                                       name,
                                       value,
                                   }) => {
        // Відстань від центру: беремо зовнішній радіус плюс відступ
        const radius = outerRadius + 20;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return (
            <text
                x={x}
                y={y}
                fill="#000"
                textAnchor={x > cx ? "start" : "end"}
                dominantBaseline="central"
            >
                {`${name}: ${value}`}
            </text>
        );
    };

    return (
        <ResponsiveContainer width="100%" height={300}>
            <PieChart>
                <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="85%"
                    paddingAngle={2}
                    stroke="none"
                    label={renderCustomizedLabel}
                    // labelLine можна налаштувати за потреби
                >
                    {data.map((entry, idx) => (
                        <Cell
                            key={entry.name}
                            fill={colors[idx % colors.length]}
                        />
                    ))}
                </Pie>
                <Tooltip />
            </PieChart>
        </ResponsiveContainer>
    );
}
