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
    useMediaQuery,
} from "@mui/material";

import marksStats           from "./data/marks_stats_data.json";
import rawClientsData       from "./data/clients_data.json";
import retentionRateData    from "./data/retention_rate_data.json";

import dayjs              from "dayjs";
import customParseFormat  from "dayjs/plugin/customParseFormat";

import MedianCard           from "./components/MedianCards.jsx";
import ClientFilters        from "./components/ClientFilters.jsx";
import ClientsTable         from "./components/ClientsTable.jsx";
import MarksDiagram         from "./components/MarksDiagram.jsx";
import TotalClientsDiagram  from "./components/TotalClientsDiagram.jsx";
import RetentionRateDiagram from "./components/RetentionRateDiagram.jsx";

dayjs.extend(customParseFormat);

const metrics = [
    { key: "total_clients",    label: "Total Clients",          color: "primary.main"   },
    { key: "like_to_engage",   label: "Likelihood to Engage",   color: "info.main"      },
    { key: "like_to_purchase", label: "Likelihood to Purchase", color: "success.main"   },
    { key: "like_to_churn",    label: "Likelihood to Churn",    color: "warning.main"   },
    { key: "ltv",              label: "LTV",                    color: "secondary.main" },
];

export default function App() {
    const theme     = useTheme();
    const isMobile  = useMediaQuery(theme.breakpoints.down("sm"));

    /* ---------- 1) normalize clients ---------- */
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
                    like_to_engage:   c?.marks?.like_to_engage   ?? 0,
                    like_to_purchase: c?.marks?.like_to_purchase ?? 0,
                    like_to_churn:    c?.marks?.like_to_churn    ?? 0,
                    ltv:              c?.marks?.ltv              ?? 0,
                    ...(c.marks ?? {}),
                },
            })),
        []
    );

    /* ---------- 2) dynamic max LTV ---------- */
    const maxLtv = useMemo(
        () => Math.max(0, ...clientsData.map((c) => c.marks.ltv)),
        [clientsData]
    );

    const markMeta = useMemo(
        () => [
            { key: "like_to_engage",   label: "Engagement",      max: 10,     color: "info.main"      },
            { key: "like_to_purchase", label: "Purchase Intent", max: 10,     color: "success.main"   },
            { key: "like_to_churn",    label: "Churn Risk",      max: 10,     color: "warning.main"   },
            { key: "ltv",              label: "Lifetime Value",  max: maxLtv, color: "secondary.main" },
        ],
        [maxLtv]
    );

    /* ---------- 3) date range ---------- */
    const fullClientDateRange = useMemo(() => {
        const valid = clientsData
            .map((c) => (c.crm_data.last_purchase_date ? dayjs(c.crm_data.last_purchase_date, "DD-MM-YYYY") : null))
            .filter((d) => d && d.isValid());

        if (!valid.length) {
            const today = dayjs();
            return { start: today, end: today };
        }
        const start = valid.reduce((min, d) => (d.isBefore(min) ? d : min), valid[0]);
        const end   = valid.reduce((max, d) => (d.isAfter(max) ? d : max), valid[0]);
        return { start, end };
    }, [clientsData]);

    const [clientFilters, setClientFilters] = useState({
        marks: {
            like_to_engage:   [0, 10],
            like_to_purchase: [0, 10],
            like_to_churn:    [0, 10],
            ltv:              [0, maxLtv],
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
            return (
                inDate &&
                m.like_to_engage   >= f.like_to_engage[0]   && m.like_to_engage   <= f.like_to_engage[1] &&
                m.like_to_purchase >= f.like_to_purchase[0] && m.like_to_purchase <= f.like_to_purchase[1] &&
                m.like_to_churn    >= f.like_to_churn[0]    && m.like_to_churn    <= f.like_to_churn[1] &&
                m.ltv              >= f.ltv[0]              && m.ltv              <= f.ltv[1]
            );
        });
    }, [clientsData, clientFilters]);

    /* ---------- 4) total clients ---------- */
    const totalClientsChartData = useMemo(() => {
        const cats = marksStats.total_clients.by_categories;
        return [
            { name: "Not identified", value: cats.not_identified },
            { name: "Identified",     value: cats.identified     },
            { name: "Purchased",      value: cats.purchased      },
        ];
    }, []);

    const totalClientsColors = [
        theme.palette.grey[400],
        theme.palette.info.main,
        theme.palette.success.main,
    ];

    /* ---------- 5) cohort retention ---------- */
    const retentionChartData = useMemo(
        () => retentionRateData.cohort_yearly_retention.map(({ year, rate }) => ({ year: `${year}`, rate })),
        []
    );

    /* ---------- 6) render ---------- */
    return (
        <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
            <AppBar position="static" elevation={2}>
                <Toolbar>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        Client IQ – APL Travel
                    </Typography>
                </Toolbar>
            </AppBar>

            <Container maxWidth="lg" sx={{ py: isMobile ? 2 : 4, flexGrow: 1 }}>
                {/* KPI cards */}
                <Grid container spacing={isMobile ? 2 : 3} mb={isMobile ? 3 : 4}>
                    {metrics.map(({ key, label, color }) => {
                        // ---------- details for pop-up ----------
                        const details =
                            key === "total_clients"
                                ? [
                                    { label: "Not identified", value: marksStats.total_clients.by_categories.not_identified },
                                    { label: "Identified",     value: marksStats.total_clients.by_categories.identified     },
                                    { label: "Purchased",      value: marksStats.total_clients.by_categories.purchased      },
                                ]
                                : marksStats[key].by_marks.map(({ mark, clients }) => ({
                                    label: mark,
                                    value: clients,
                                }));
                        return (
                            <Grid item xs={6} sm={4} md={2.4} key={key}>
                                <MedianCard
                                    label={label}
                                    value={marksStats[key]?.total ?? "—"}
                                    color={color}
                                    details={details}
                                />
                            </Grid>
                        );
                    })}
                </Grid>

                {/* ► TWO CHARTS IN ONE ROW EVEN ON MOBILE ◄ */}
                <Grid container spacing={isMobile ? 2 : 3} mb={isMobile ? 3 : 4}>
                    <Grid item xs={6} md={6}>
                        <Paper sx={{ p: isMobile ? 2 : 3, height: "100%" }} elevation={3}>
                            <Typography variant="subtitle1" mb={2} sx={{ fontWeight: 600 }}>
                                Total Clients – Distribution
                            </Typography>
                            <TotalClientsDiagram
                                data={totalClientsChartData}
                                colors={totalClientsColors}
                                height={isMobile ? 200 : 300}
                            />
                        </Paper>
                    </Grid>

                    <Grid item xs={6} md={6}>
                        <Paper sx={{ p: isMobile ? 2 : 3, height: "100%" }} elevation={3}>
                            <Typography variant="subtitle1" mb={2} sx={{ fontWeight: 600 }}>
                                Cohort Retention (2019 → 2025)
                            </Typography>
                            <RetentionRateDiagram
                                data={retentionChartData}
                                strokeColor={theme.palette.primary.main}
                                height={isMobile ? 200 : 300}
                            />
                        </Paper>
                    </Grid>
                </Grid>

                {/* other diagrams */}
                <Grid container spacing={isMobile ? 2 : 3} mb={isMobile ? 3 : 4}>
                    {metrics.filter(({ key }) => key !== "total_clients").map(({ key, label, color }) => (
                        <Grid item xs={12} md={6} key={key}>
                            <Paper sx={{ p: isMobile ? 2 : 3, height: "100%" }} elevation={3}>
                                <Typography variant="subtitle1" mb={2} sx={{ fontWeight: 600 }}>
                                    {label}
                                </Typography>
                                <MarksDiagram
                                    data={marksStats[key].by_marks}
                                    fillColor={theme.palette[color.split(".")[0]].main}
                                    height={isMobile ? 180 : 220}
                                />
                            </Paper>
                        </Grid>
                    ))}
                </Grid>

                {/* filters + table */}
                <Grid container spacing={isMobile ? 2 : 3}>
                    <Grid item xs={12}>
                        <ClientFilters
                            markMeta={markMeta}
                            filters={clientFilters}
                            onChange={setClientFilters}
                            mobile={isMobile}
                        />
                        <ClientsTable clients={filteredClients} mobile={isMobile} />
                    </Grid>
                </Grid>
            </Container>
        </Box>
    );
}
