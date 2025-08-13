// ------------------- Dashboard.jsx -------------------
import React, { useEffect, useMemo, useState } from "react";
import {
    AppBar,
    Toolbar,
    Typography,
    Container,
    Grid,
    Paper,
    Box,
    CircularProgress,
    useTheme,
    useMediaQuery,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

import MedianCard from "./components/MedianCards.jsx";
import ClientFilters from "./components/ClientFilters.jsx";
import ClientsTable from "./components/ClientsTable.jsx";
import TotalClientsDiagram from "./components/TotalClientsDiagram.jsx";
import RetentionRateDiagram from "./components/RetentionRateDiagram.jsx";

import EngagementDrilldownModal from "./components/EngagementDrilldownModal.jsx";
import PurchaseDrilldownModal from "./components/PurchaseDrilldownModal.jsx";
import ChurnDrilldownModal from "./components/ChurnDrilldownModal.jsx";
import LtvDrilldownModal from "./components/LtvDrilldownModal.jsx";

import { fetchAllClients } from "./api/clients.js";
import { fetchDistribution } from "./api/distribution.js";
import { fetchDashboardSummary } from "./api/summary.js";

import marksStats from "./data/marks_stats_data.json";
import retentionRateData from "./data/retention_rate_data.json";

dayjs.extend(customParseFormat);

/* відповідність ключів marks → distributions */
const distKeyForMetric = {
    like_to_engage: "engage",
    like_to_purchase: "purchase",
    like_to_churn: "churn",
    ltv: "ltv",
};

export default function Dashboard() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    /* --- STATE --- */
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [clients, setClients] = useState([]);
    const [dist, setDist] = useState(null);
    const [summary, setSummary] = useState(null);

    /* діапазон дат (dayjs) — спільний для всіх запитів */
    const today = dayjs();
    const [dateRange, setDateRange] = useState({
        start: today.subtract(6, "month").startOf("day"),
        end: today.startOf("day"),
    });

    /* drilldown modals */
    const [openEngageModal, setOpenEngageModal] = useState(false);
    const [openPurchaseModal, setOpenPurchaseModal] = useState(false);
    const [openChurnModal, setOpenChurnModal] = useState(false);
    const [openLtvModal, setOpenLtvModal] = useState(false);

    /* --- LOAD on mount & when dateRange змінюється --- */
    useEffect(() => {
        let mounted = true;
        (async () => {
            setLoading(true);
            try {
                /* yyyy-mm-dd для бекенду */
                const s = dateRange.start.format("YYYY-MM-DD");
                const e = dateRange.end.format("YYYY-MM-DD");

                const [rawClients, rawDist, rawSummary] = await Promise.all([
                    fetchAllClients(s, e),
                    fetchDistribution(s, e),
                    fetchDashboardSummary(s, e),
                ]);

                if (!mounted) return;
                setClients(rawClients.map(normaliseClient));
                setDist(rawDist?.distributions || null);
                setSummary(rawSummary || null);
                setError(null);
            } catch (err) {
                if (mounted) setError(err.message);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [dateRange]);

    /* --- HELPERS --- */
    function normaliseClient(c) {
        return {
            id: c.id,
            client_name: c.client_name,
            client_phone_number: c.phone,
            crm_data: {
                last_purchase_date: c.last_purchase,
                last_purchase_cost: c.cost,
                last_purchase_type: c.type,
            },
            marks: {
                like_to_engage: c.engage ?? 0,
                like_to_purchase: c.purchase ?? 0,
                like_to_churn: c.churn ?? 0,
                ltv: c.ltv ?? 0,
            },
            website_data: {},
            conversations_data: {},
        };
    }

    /* --- DERIVED --- */
    const maxLtv = useMemo(
        () => Math.max(0, ...clients.map((c) => c.marks.ltv)),
        [clients]
    );

    const markMeta = useMemo(
        () => [
            { key: "like_to_engage", label: "Engagement", max: 10, color: "info.main" },
            { key: "like_to_purchase", label: "Purchase Intent", max: 10, color: "success.main" },
            { key: "like_to_churn", label: "Churn Risk", max: 10, color: "warning.main" },
            { key: "ltv", label: "Lifetime Value", max: maxLtv, color: "secondary.main" },
        ],
        [maxLtv]
    );

    /* клієнти з локальною фільтрацією (за marks) */
    const [marksFilter, setMarksFilter] = useState({
        like_to_engage: [0, 10],
        like_to_purchase: [0, 10],
        like_to_churn: [0, 10],
        ltv: [0, maxLtv],
    });

    /* синхронізація maxLtv -> marksFilter */
    useEffect(() => {
        setMarksFilter((f) => ({ ...f, ltv: [0, maxLtv] }));
    }, [maxLtv]);

    const filteredClients = useMemo(() => {
        const f = marksFilter;
        return clients.filter((c) => {
            const m = c.marks;
            return (
                m.like_to_engage >= f.like_to_engage[0] &&
                m.like_to_engage <= f.like_to_engage[1] &&
                m.like_to_purchase >= f.like_to_purchase[0] &&
                m.like_to_purchase <= f.like_to_purchase[1] &&
                m.like_to_churn >= f.like_to_churn[0] &&
                m.like_to_churn <= f.like_to_churn[1] &&
                m.ltv >= f.ltv[0] &&
                m.ltv <= f.ltv[1]
            );
        });
    }, [clients, marksFilter]);

    /* --- STATIC diagrams --- */
    const totalClientsPie = useMemo(() => {
        const cats = marksStats.total_clients.by_categories;
        return [
            { name: "Not identified", value: cats.not_identified },
            { name: "Identified", value: cats.identified },
            { name: "Purchased", value: cats.purchased },
        ];
    }, []);

    const retentionChart = useMemo(
        () =>
            retentionRateData.cohort_yearly_retention.map(({ year, rate }) => ({
                year: `${year}`,
                rate,
            })),
        []
    );

    const metrics = [
        { key: "total_clients", label: "Total Clients", color: "primary.main" },
        { key: "like_to_engage", label: "Likelihood to Engage", color: "info.main" },
        { key: "like_to_purchase", label: "Likelihood to Purchase", color: "success.main" },
        { key: "like_to_churn", label: "Likelihood to Churn", color: "warning.main" },
        { key: "ltv", label: "LTV", color: "secondary.main" },
    ];

    /* ---------- UI ---------- */
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
                {loading && (
                    <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
                        <CircularProgress />
                    </Box>
                )}
                {error && <Paper sx={{ p: 3, bgcolor: theme.palette.error.light }}>{error}</Paper>}

                {!loading && !error && (
                    <>
                        {/* KPI cards */}
                        <Grid container spacing={isMobile ? 2 : 3} mb={isMobile ? 3 : 4}>
                            {metrics.map(({ key, label, color }) => {
                                const isEngageCard = key === "like_to_engage";
                                const isPurchaseCard = key === "like_to_purchase";
                                const isChurnCard = key === "like_to_churn";
                                const isLtvCard = key === "ltv";
                                const isClickable =
                                    isEngageCard || isPurchaseCard || isChurnCard || isLtvCard;

                                return (
                                    <Grid item xs={6} sm={4} md={2.4} key={key}>
                                        <Box
                                            onClick={
                                                isEngageCard
                                                    ? () => setOpenEngageModal(true)
                                                    : isPurchaseCard
                                                        ? () => setOpenPurchaseModal(true)
                                                        : isChurnCard
                                                            ? () => setOpenChurnModal(true)
                                                            : isLtvCard
                                                                ? () => setOpenLtvModal(true)
                                                                : undefined
                                            }
                                            sx={{
                                                borderRadius: 2,
                                                outline: "2px solid transparent",
                                                transition:
                                                    "transform .12s ease, box-shadow .2s ease, outline-color .2s ease",
                                                cursor: isClickable ? "pointer" : "default",
                                                "&:hover": isClickable
                                                    ? {
                                                        transform: "translateY(-2px)",
                                                        boxShadow: 6,
                                                        outlineColor: alpha(
                                                            theme.palette.primary.main,
                                                            0.35
                                                        ),
                                                    }
                                                    : undefined,
                                            }}
                                        >
                                            <MedianCard
                                                label={label}
                                                value={summary?.[key] ?? marksStats[key]?.total ?? "—"}
                                                color={color}
                                                /* no hover popover details */
                                                details={[]}
                                            />
                                        </Box>
                                    </Grid>
                                );
                            })}
                        </Grid>

                        {/* Pie + retention */}
                        <Grid container spacing={isMobile ? 2 : 3} mb={isMobile ? 3 : 4}>
                            <Grid item xs={6} md={6}>
                                <Paper sx={{ p: isMobile ? 2 : 3, height: "100%" }} elevation={3}>
                                    <Typography variant="subtitle1" mb={2} sx={{ fontWeight: 600 }}>
                                        Total Clients – Distribution
                                    </Typography>
                                    <TotalClientsDiagram
                                        data={totalClientsPie}
                                        colors={[
                                            theme.palette.grey[400],
                                            theme.palette.info.main,
                                            theme.palette.success.main,
                                        ]}
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
                                        data={retentionChart}
                                        strokeColor={theme.palette.primary.main}
                                        height={isMobile ? 200 : 300}
                                    />
                                </Paper>
                            </Grid>
                        </Grid>

                        {/* Removed: Marks diagrams (Engage, Purchase, Churn, LTV) */}
                        {/* Filters (дата + слайдери) + таблиця */}
                        <Grid container spacing={isMobile ? 2 : 3}>
                            <Grid item xs={12}>
                                <ClientFilters
                                    markMeta={markMeta}
                                    filters={{ marks: marksFilter, date: dateRange }}
                                    onChange={(f) => {
                                        if (f.date !== undefined) setDateRange(f.date);
                                        if (f.marks !== undefined) setMarksFilter(f.marks);
                                    }}
                                    mobile={isMobile}
                                />
                                <ClientsTable clients={filteredClients} mobile={isMobile} />
                            </Grid>
                        </Grid>
                    </>
                )}
            </Container>

            {/* FULLSCREEN DRILLDOWNS */}
            <EngagementDrilldownModal
                open={openEngageModal}
                onClose={() => setOpenEngageModal(false)}
            />
            <PurchaseDrilldownModal
                open={openPurchaseModal}
                onClose={() => setOpenPurchaseModal(false)}
            />
            <ChurnDrilldownModal
                open={openChurnModal}
                onClose={() => setOpenChurnModal(false)}
            />
            <LtvDrilldownModal
                open={openLtvModal}
                onClose={() => setOpenLtvModal(false)}
            />
        </Box>
    );
}
