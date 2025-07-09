import React from "react";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    Legend,
} from "recharts";

/**
 * props:
 *   data        – масив об’єктів { year, rate }
 *   strokeColor – колір лінії
 */
export default function RetentionRateDiagram({ data, strokeColor }) {
    return (
        <ResponsiveContainer width="100%" height={300}>
            <LineChart
                data={data}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                    dataKey="year"
                    tick={{ fontSize: 12 }}
                    label={{ value: "Year", position: "insideBottom", dy: 10 }}
                />
                <YAxis
                    tick={{ fontSize: 12 }}
                    domain={[0, 100]}
                    allowDecimals={false}
                    label={{
                        value: "Retention Rate (%)",
                        angle: -90,
                        dx: -10,
                        dy: 50,
                        fontSize: 12,
                    }}
                />
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend verticalAlign="top" height={24} />
                <Line
                    type="monotone"
                    dataKey="rate"
                    name="Retention Rate"
                    stroke={strokeColor}
                    strokeWidth={3}
                    dot={{ r: 5 }}
                    activeDot={{ r: 7 }}
                />
            </LineChart>
        </ResponsiveContainer>
    );
}
