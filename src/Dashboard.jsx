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
    Stack,
    Avatar,
    Divider,
    Chip,
    Button,
    Tooltip,
    Popover,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

// Free MIT pickers
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";

import MedianCard from "./components/MedianCards.jsx";
import ClientFilters from "./components/ClientFilters.jsx";
import ClientsTable from "./components/ClientsTable.jsx";
import TotalClientsDiagram from "./components/TotalClientsDiagram.jsx";

import EngagementDrilldownModal from "./components/EngagementDrilldownModal.jsx";
import PurchaseDrilldownModal from "./components/PurchaseDrilldownModal.jsx";
import ChurnDrilldownModal from "./components/ChurnDrilldownModal.jsx";
import LtvDrilldownModal from "./components/LtvDrilldownModal.jsx";

import { fetchAllClients } from "./api/clients.js";
import { fetchDistribution } from "./api/distribution.js";
import { fetchDashboardSummary } from "./api/summary.js";

import marksStats from "./data/marks_stats_data.json";

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

    const formatNumber = (n) =>
        (typeof n === "number" ? n : Number(n || 0)).toLocaleString();

    /* --- DERIVED --- */
    const maxLtv = useMemo(
        () => Math.max(0, ...clients.map((c) => c.marks.ltv)),
        [clients]
    );

    /* KPI cards */
    const metrics = [
        { key: "retention_placeholder", label: "Retention", color: "primary.main" },
        { key: "like_to_engage", label: "Likelihood to Engage", color: "info.main" },
        { key: "like_to_purchase", label: "Likelihood to Purchase", color: "success.main" },
        { key: "like_to_churn", label: "Likelihood to Churn", color: "warning.main" },
        { key: "ltv", label: "LTV", color: "secondary.main" },
    ];

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

    /* ------------------ COMBINED OVERVIEW (random data) ------------------ */
    const [overview, setOverview] = useState({
        total: 0,
        identified: 0,
        purchased: 0,
        pie: [],
    });

    const regenerateOverview = () => {
        const total = 8000 + Math.floor(Math.random() * 14000);
        const purchased = Math.floor(total * (0.10 + Math.random() * 0.25)); // 10–35%
        const remaining = total - purchased;
        const identified = Math.floor(remaining * (0.40 + Math.random() * 0.40)); // 40–80% of remaining
        const unidentified = total - purchased - identified;

        setOverview({
            total,
            identified,
            purchased,
            pie: [
                { name: "Unidentified", value: unidentified },
                { name: "Identified", value: identified },
                { name: "Purchased", value: purchased },
            ],
        });
    };

    useEffect(() => {
        regenerateOverview();
    }, [dateRange.start.valueOf(), dateRange.end.valueOf()]);

    const unidentifiedAbs = overview.total - overview.purchased - overview.identified;

    const rangeLabel = `${dateRange.start.format("DD MMM YYYY")} – ${dateRange.end.format(
        "DD MMM YYYY"
    )}`;

    /* ------------------ Free single-range calendar (two calendars) ------------------ */
    const [dateAnchor, setDateAnchor] = useState(null);
    const [tmpRange, setTmpRange] = useState([dateRange.start, dateRange.end]);
    const [selecting, setSelecting] = useState("start"); // "start" | "end"

    const openDatePopover = (e) => {
        setTmpRange([dateRange.start, dateRange.end]);
        setSelecting("start");
        setDateAnchor(e.currentTarget);
    };
    const closeDatePopover = () => setDateAnchor(null);

    const handlePick = (newDay) => {
        if (!newDay) return;
        const day = newDay.startOf("day");
        if (selecting === "start") {
            setTmpRange([day, null]);
            setSelecting("end");
        } else {
            let s = tmpRange[0] || day;
            let e = day;
            if (e.isBefore(s)) [s, e] = [e, s];
            setTmpRange([s.startOf("day"), e.startOf("day")]);
            setSelecting("start");
        }
    };

    const applyTmpDates = () => {
        const [s, e] = tmpRange || [];
        if (s && e) {
            let start = s.startOf("day");
            let end = e.startOf("day");
            if (end.isBefore(start)) [start, end] = [end, start];
            setDateRange({ start, end });
        }
        closeDatePopover();
    };

    const quickSet = (days) => {
        const end = dayjs().startOf("day");
        const start = end.subtract(days, "day");
        setTmpRange([start, end]);
        setSelecting("start");
    };

    const pieColors = [
        alpha(theme.palette.primary.main, 0.18), // Unidentified
        alpha(theme.palette.primary.main, 0.40), // Identified
        theme.palette.primary.main,              // Purchased
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

                                // compute value per card
                                let value = "—";
                                if (key === "retention_placeholder") {
                                    value = "—";
                                } else if (key === "like_to_engage") {
                                    value =
                                        summary?.like_to_engage ??
                                        marksStats.like_to_engage?.total ??
                                        "—";
                                } else if (key === "like_to_purchase") {
                                    value =
                                        summary?.like_to_purchase ??
                                        marksStats.like_to_purchase?.total ??
                                        "—";
                                } else if (key === "like_to_churn") {
                                    value =
                                        summary?.like_to_churn ??
                                        marksStats.like_to_churn?.total ??
                                        "—";
                                } else if (key === "ltv") {
                                    value = summary?.ltv ?? marksStats.ltv?.total ?? "—";
                                }

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
                                                value={value}
                                                color={color}
                                                details={[]}
                                            />
                                        </Box>
                                    </Grid>
                                );
                            })}
                        </Grid>

                        {/* ---------------- Combined Overview tile (merged left+right) ---------------- */}
                        <Grid container spacing={isMobile ? 2 : 3} mb={isMobile ? 3 : 4}>
                            <Grid item xs={12}>
                                <Paper
                                    elevation={0}
                                    sx={{
                                        p: isMobile ? 2 : 3,
                                        borderRadius: 3,
                                        position: "relative",
                                        overflow: "hidden",
                                        border: `1px solid ${alpha(
                                            theme.palette.primary.main,
                                            0.18
                                        )}`,
                                        background: `linear-gradient(135deg,
                                            ${alpha(theme.palette.primary.main, 0.10)} 0%,
                                            ${alpha(theme.palette.primary.main, 0.03)} 100%)`,
                                        boxShadow: `0 10px 30px ${alpha(
                                            theme.palette.primary.main,
                                            0.08
                                        )}`,
                                    }}
                                >
                                    {/* Decorative glows */}
                                    <Box
                                        sx={{
                                            position: "absolute",
                                            right: -40,
                                            top: -40,
                                            width: 180,
                                            height: 180,
                                            borderRadius: "50%",
                                            background: alpha(theme.palette.primary.main, 0.12),
                                            filter: "blur(30px)",
                                        }}
                                    />
                                    <Box
                                        sx={{
                                            position: "absolute",
                                            left: -60,
                                            bottom: -60,
                                            width: 200,
                                            height: 200,
                                            borderRadius: "50%",
                                            background: alpha(theme.palette.primary.light, 0.14),
                                            filter: "blur(35px)",
                                        }}
                                    />

                                    <Stack spacing={isMobile ? 1.5 : 2} sx={{ position: "relative" }}>
                                        {/* Header */}
                                        <Stack
                                            direction="row"
                                            alignItems="center"
                                            justifyContent="space-between"
                                            spacing={1.5}
                                            sx={{ mb: 1 }}
                                        >
                                            <Stack direction="row" spacing={1.5} alignItems="center">
                                                <Avatar
                                                    variant="rounded"
                                                    sx={{
                                                        width: 44,
                                                        height: 44,
                                                        borderRadius: 2,
                                                        bgcolor: alpha(
                                                            theme.palette.primary.main,
                                                            0.18
                                                        ),
                                                        color: theme.palette.primary.main,
                                                        boxShadow: `inset 0 0 0 1px ${alpha(
                                                            theme.palette.primary.main,
                                                            0.22
                                                        )}`,
                                                    }}
                                                >
                                                    <GroupsRoundedIcon />
                                                </Avatar>
                                                <Box>
                                                    <Typography
                                                        variant="overline"
                                                        sx={{
                                                            letterSpacing: 1.2,
                                                            opacity: 0.85,
                                                            textTransform: "uppercase",
                                                        }}
                                                    >
                                                        Customer Overview
                                                    </Typography>
                                                    <Typography
                                                        variant="body2"
                                                        sx={{ opacity: 0.7, mt: -0.3 }}
                                                    >
                                                        Summary and distribution
                                                    </Typography>
                                                </Box>
                                            </Stack>

                                            <Tooltip title="Change date range">
                                                <Chip
                                                    onClick={openDatePopover}
                                                    icon={<CalendarMonthRoundedIcon />}
                                                    size="small"
                                                    label={rangeLabel}
                                                    variant="outlined"
                                                    sx={{
                                                        borderColor: alpha(
                                                            theme.palette.primary.main,
                                                            0.35
                                                        ),
                                                        bgcolor: alpha(
                                                            theme.palette.primary.main,
                                                            0.06
                                                        ),
                                                        fontWeight: 600,
                                                        cursor: "pointer",
                                                    }}
                                                />
                                            </Tooltip>
                                        </Stack>

                                        <Divider sx={{ opacity: 0.2 }} />

                                        {/* Content: left summary, right donut — inside ONE tile */}
                                        <Grid container spacing={isMobile ? 2 : 3} alignItems="center">
                                            {/* Left summary */}
                                            <Grid item xs={12} md={5.5}>
                                                <Stack spacing={1.25}>
                                                    <Typography
                                                        variant={isMobile ? "h4" : "h2"} // a bit bigger
                                                        sx={{ fontWeight: 900, lineHeight: 1.08, letterSpacing: -0.2 }}
                                                    >
                                                        {formatNumber(overview.total)}
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ opacity: 0.75 }}>
                                                        Total clients
                                                    </Typography>

                                                    <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
                                                        <MiniStat
                                                            label="Identified"
                                                            value={formatNumber(overview.identified)}
                                                            dotColor={alpha(theme.palette.primary.main, 0.40)}
                                                        />
                                                        <MiniStat
                                                            label="Unidentified"
                                                            value={formatNumber(unidentifiedAbs)}
                                                            dotColor={alpha(theme.palette.primary.main, 0.18)}
                                                        />
                                                        <MiniStat
                                                            label="Purchased"
                                                            value={formatNumber(overview.purchased)}
                                                            dotColor={theme.palette.primary.main}
                                                        />
                                                    </Stack>
                                                </Stack>
                                            </Grid>

                                            {/* Right donut (smaller) — labels INSIDE as %; no bottom legend */}
                                            <Grid item xs={12} md={6.5}>
                                                <TotalClientsDiagram
                                                    data={overview.pie}
                                                    colors={pieColors}
                                                    height={isMobile ? 190 : 240}
                                                    showLabels
                                                    labelMode="percent"      // show percents (not absolute)
                                                    labelPlacement="inside" // no leader lines
                                                />
                                            </Grid>
                                        </Grid>
                                    </Stack>

                                    {/* Range picker popover (two free calendars) */}
                                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                                        <Popover
                                            open={Boolean(dateAnchor)}
                                            anchorEl={dateAnchor}
                                            onClose={closeDatePopover}
                                            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                                            transformOrigin={{ vertical: "top", horizontal: "right" }}
                                            PaperProps={{
                                                sx: {
                                                    p: 2,
                                                    borderRadius: 2,
                                                    border: `1px solid ${alpha(
                                                        theme.palette.primary.main,
                                                        0.2
                                                    )}`,
                                                },
                                            }}
                                        >
                                            <Stack spacing={1.5}>
                                                <Stack
                                                    direction={{ xs: "column", sm: "row" }}
                                                    spacing={2}
                                                    alignItems="flex-start"
                                                >
                                                    <DateCalendar
                                                        value={tmpRange?.[0] || null}
                                                        onChange={handlePick}
                                                        disableFuture
                                                        sx={{ "& .MuiPickersCalendarHeader-root": { mb: 1 } }}
                                                    />
                                                    <DateCalendar
                                                        value={tmpRange?.[1] || null}
                                                        onChange={handlePick}
                                                        disableFuture
                                                        sx={{ "& .MuiPickersCalendarHeader-root": { mb: 1 } }}
                                                    />
                                                </Stack>

                                                {/* Quick presets */}
                                                <Stack direction="row" spacing={1} flexWrap="wrap">
                                                    <Chip size="small" label="7d" onClick={() => quickSet(6)} />
                                                    <Chip size="small" label="30d" onClick={() => quickSet(29)} />
                                                    <Chip size="small" label="3 mo" onClick={() => {
                                                        const end = dayjs().startOf("day");
                                                        const start = end.subtract(3, "month");
                                                        setTmpRange([start, end]);
                                                        setSelecting("start");
                                                    }} />
                                                    <Chip size="small" label="YTD" onClick={() => {
                                                        const end = dayjs().startOf("day");
                                                        const start = dayjs().startOf("year");
                                                        setTmpRange([start, end]);
                                                        setSelecting("start");
                                                    }} />
                                                    <Chip size="small" label="Today" onClick={() => {
                                                        const d = dayjs().startOf("day");
                                                        setTmpRange([d, d]);
                                                        setSelecting("start");
                                                    }} />
                                                </Stack>

                                                <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                    <Button onClick={closeDatePopover}>Cancel</Button>
                                                    <Button
                                                        variant="contained"
                                                        onClick={applyTmpDates}
                                                        disabled={!tmpRange?.[0] || !tmpRange?.[1]}
                                                    >
                                                        Apply
                                                    </Button>
                                                </Stack>
                                            </Stack>
                                        </Popover>
                                    </LocalizationProvider>
                                </Paper>
                            </Grid>
                        </Grid>

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

/* -------- Small helper component for mini-stats -------- */
function MiniStat({ label, value, dotColor }) {
    return (
        <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{
                px: 1.25,
                py: 0.75,
                borderRadius: 2,
                border: (theme) => `1px solid ${alpha(theme.palette.common.black, 0.08)}`,
                bgcolor: (theme) => alpha(theme.palette.common.white, 0.6),
                backdropFilter: "blur(6px)",
            }}
        >
            <Box
                sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    bgcolor: dotColor,
                    boxShadow: (theme) => `0 0 0 2px ${alpha(dotColor, 0.15)}`,
                }}
            />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {label}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.75 }}>
                {value}
            </Typography>
        </Stack>
    );
}
