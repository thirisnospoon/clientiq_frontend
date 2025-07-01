import React, { useMemo, useState } from "react";
import {
    AppBar,
    Toolbar,
    Typography,
    Container,
    Grid,
    Paper,
    Box,
    useTheme,
} from "@mui/material";

import statsData from "./data/stats_data.json";
import rawClientsData from "./data/clients_data.json";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

// components
import DateRangeSelector from "./components/DateRangeSelector";
import MetricsChart from "./components/MetricsChart";
import MedianCard from "./components/MedianCards.jsx";
import ClientFilters from "./components/ClientFilters.jsx";
import ClientsTable from "./components/ClientsTable.jsx";

// extend dayjs so it can parse your DD-MM-YYYY strings
dayjs.extend(customParseFormat);

// KPI metric configuration
const metrics = [
    {
        key: "clients_number",
        label: "Total Clients",
        medianField: "general",
        color: "primary.main",
    },
    { key: "like_to_engage", label: "Likelihood to Engage", color: "info.main" },
    {
        key: "like_to_purchase",
        label: "Likelihood to Purchase",
        color: "success.main",
    },
    { key: "like_to_churn", label: "Likelihood to Churn", color: "warning.main" },
    { key: "ltv", label: "LTV", color: "secondary.main" },
];

export default function App() {
    const theme = useTheme();

    // 1) Cleanse & normalize clients
    const clientsData = useMemo(
        () =>
            rawClientsData.map((c) => ({
                ...c,
                crm_data: {
                    last_purchase_date: c?.crm_data?.last_purchase_date ?? null,
                    last_purchase_cost: c?.crm_data?.last_purchase_cost ?? null,
                    last_purchase_type: c?.crm_data?.last_purchase_type ?? null,
                    ...(c.crm_data ?? {}),
                },
                marks: {
                    like_to_engage: c?.marks?.like_to_engage ?? 0,
                    like_to_purchase: c?.marks?.like_to_purchase ?? 0,
                    like_to_churn: c?.marks?.like_to_churn ?? 0,
                    ltv: c?.marks?.ltv ?? 0,
                    ...(c.marks ?? {}),
                },
            })),
        []
    );

    // ▶️ Compute dynamic LTV maximum
    const maxLtv = useMemo(
        () => Math.max(0, ...clientsData.map((c) => c.marks.ltv)),
        [clientsData]
    );

    // Build mark metadata, using dynamic max for LTV
    const markMeta = useMemo(
        () => [
            { key: "like_to_engage",   label: "Engagement",      max: 10,     color: "info.main"      },
            { key: "like_to_purchase", label: "Purchase Intent", max: 10,     color: "success.main"   },
            { key: "like_to_churn",    label: "Churn Risk",      max: 10,     color: "warning.main"   },
            { key: "ltv",              label: "Lifetime Value",  max: maxLtv, color: "secondary.main" },
        ],
        [maxLtv]
    );

    // 2) KPI chart full date range
    const kpiFullRange = useMemo(() => {
        const parsedDates = metrics
            .flatMap(({ key }) => Object.keys(statsData[key].by_dates))
            .map((d) => dayjs(d, "DD-MM-YYYY"))
            .filter((d) => d.isValid());

        if (parsedDates.length === 0) {
            const today = dayjs();
            return { start: today, end: today };
        }

        const start = parsedDates.reduce((min, d) => (d.isBefore(min) ? d : min), parsedDates[0]);
        const end   = parsedDates.reduce((max, d) => (d.isAfter(max) ? d : max), parsedDates[0]);

        return { start, end };
    }, []);

    // initialize the picker state to that full range
    const [kpiRange, setKpiRange] = useState(() => kpiFullRange);

    // slice out only the points within [start, end] inclusive
    const chartData = useMemo(() => {
        const out = {};
        metrics.forEach(({ key }) => {
            out[key] = Object.entries(statsData[key].by_dates)
                .map(([d, v]) => ({ date: dayjs(d, "DD-MM-YYYY"), value: v }))
                .filter(({ date }) => !date.isBefore(kpiRange.start) && !date.isAfter(kpiRange.end))
                .sort((a, b) => a.date.valueOf() - b.date.valueOf());
        });
        return out;
    }, [kpiRange]);

    // 3) Client filters initial state
    const fullClientDateRange = useMemo(() => {
        const validDates = clientsData
            .map((c) => (c.crm_data.last_purchase_date ? dayjs(c.crm_data.last_purchase_date, "DD-MM-YYYY") : null))
            .filter((d) => d && d.isValid());

        if (!validDates.length) {
            const today = dayjs();
            return { start: today, end: today };
        }

        const start = validDates.reduce((min, d) => (d.isBefore(min) ? d : min), validDates[0]);
        const end   = validDates.reduce((max, d) => (d.isAfter(max) ? d : max), validDates[0]);
        return { start, end };
    }, [clientsData]);

    const [clientFilters, setClientFilters] = useState({
        marks: {
            like_to_engage: [0, 10],
            like_to_purchase: [0, 10],
            like_to_churn: [0, 10],
            ltv: [0, maxLtv],
        },
        date: fullClientDateRange,
    });

    const filteredClients = useMemo(() => {
        return clientsData.filter((c) => {
            let inDate = true;
            if (c.crm_data.last_purchase_date) {
                const p = dayjs(c.crm_data.last_purchase_date, "DD-MM-YYYY");
                inDate = !p.isBefore(clientFilters.date.start) && !p.isAfter(clientFilters.date.end);
            }

            const m = c.marks;
            const f = clientFilters.marks;
            const inMarks =
                m.like_to_engage   >= f.like_to_engage[0]   && m.like_to_engage   <= f.like_to_engage[1] &&
                m.like_to_purchase >= f.like_to_purchase[0] && m.like_to_purchase <= f.like_to_purchase[1] &&
                m.like_to_churn    >= f.like_to_churn[0]    && m.like_to_churn    <= f.like_to_churn[1] &&
                m.ltv              >= f.ltv[0]              && m.ltv              <= f.ltv[1];

            return inDate && inMarks;
        });
    }, [clientsData, clientFilters]);

    // 4) Render
    return (
        <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
            <AppBar position="static" elevation={2}>
                <Toolbar>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        Client IQ - APL Travel
                    </Typography>
                </Toolbar>
            </AppBar>

            <Container maxWidth="lg" sx={{ py: 4, flexGrow: 1 }}>
                <Grid container spacing={3} mb={4}>
                    {metrics.map(({ key, label, medianField, color }) => {
                        const raw    = statsData[key];
                        const median = raw.median ?? raw[medianField ?? "median"];
                        return (
                            <Grid item xs={12} sm={6} md={2.4} key={key}>
                                <MedianCard label={label} value={median} color={color} />
                            </Grid>
                        );
                    })}
                </Grid>

                <Paper sx={{ p: 3, mb: 4, display: "flex", justifyContent: "center", alignItems: "center" }}>
                    <DateRangeSelector start={kpiRange.start} end={kpiRange.end} onChange={setKpiRange} />
                </Paper>

                <Grid container spacing={3}>
                    {metrics.map(({ key, label, color }, idx) => (
                        <Grid key={key} item xs={12} md={idx === 0 ? 12 : 6}>
                            <Paper sx={{ p: 3, height: "100%" }} elevation={3}>
                                <Typography variant="subtitle1" mb={2} sx={{ fontWeight: 600 }}>
                                    {label}
                                </Typography>
                                <MetricsChart
                                    data={chartData[key]}
                                    strokeColor={theme.palette[color.split(".")[0]].main}
                                    height={idx === 0 ? 300 : 220}
                                />
                            </Paper>
                        </Grid>
                    ))}

                    <Grid item xs={12}>
                        <ClientFilters markMeta={markMeta} filters={clientFilters} onChange={setClientFilters} />
                        <ClientsTable clients={filteredClients} />
                    </Grid>
                </Grid>
            </Container>
        </Box>
    );
}