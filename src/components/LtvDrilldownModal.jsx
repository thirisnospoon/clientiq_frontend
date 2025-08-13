import React, { useMemo, useState } from "react";
import {
    AppBar, Toolbar, IconButton, Typography, Dialog, Slide, Box, Grid, Paper,
    Chip, Stack, Divider, Tooltip, useTheme, useMediaQuery
} from "@mui/material";
import { alpha, lighten, darken } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import TodayIcon from "@mui/icons-material/Today";

import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";

import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
    Tooltip as RTooltip, Legend, CartesianGrid
} from "recharts";

/* ---------- Transition ---------- */
const Transition = React.forwardRef(function Transition(props, ref) {
    return <Slide direction="up" ref={ref} {...props} />;
});

/* ---------- RNG helpers (seeded per date & metric) ---------- */
function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
}
function mulberry32(a) {
    return function () {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/* ---------- Euro formatting ---------- */
const euro = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/* ---------- LTV bins (EUR) ---------- */
const BIN_EDGES = [0, 100, 200, 300, 400, 600, 800, 1000, 1250, 1500, 2000, 3000, Infinity];
const BIN_LABELS = [
    "€0–€100", "€100–€200", "€200–€300", "€300–€400", "€400–€600",
    "€600–€800", "€800–€1,000", "€1,000–€1,250", "€1,250–€1,500",
    "€1,500–€2,000", "€2,000–€3,000", "€3,000+"
];
function binMid(i) {
    const lo = BIN_EDGES[i], hi = BIN_EDGES[i + 1];
    if (hi === Infinity) return 3500; // a reasonable midpoint for the open-ended bin
    return (lo + hi) / 2;
}

/* ---------- Fake snapshot for LTV (stable per date) ---------- */
function makeLtvSnapshot(date) {
    const key = `${dayjs(date).format("YYYY-MM-DD")}|ltv`;
    const rng = mulberry32(hashString(key));

    // Log-normal-like shape via random mu/sigma in log space
    const mu = Math.log(600 + rng() * 900);     // ~ €600–€1500 median-ish region
    const sigma = 0.55 + rng() * 0.35;          // spread

    // Build smooth weights across bins using log-normal pdf ~ exp(-((ln(x)-mu)^2)/(2*sigma^2))/x
    const weights = BIN_LABELS.map((_, i) => {
        const x = binMid(i);
        const val = Math.exp(-Math.pow(Math.log(x + 1) - mu, 2) / (2 * sigma * sigma)) / (x + 1);
        // add slight randomness to avoid perfectly smooth curves
        return Math.max(1e-6, val * (0.9 + rng() * 0.2));
    });

    const wsum = weights.reduce((a, b) => a + b, 0);
    const shares = weights.map(w => w / wsum); // proportions per bin (sum ~ 1)

    // Compute median from cumulative shares with linear interpolation inside the bin
    const cum = [];
    shares.reduce((acc, s, i) => (cum[i] = acc + s, cum[i]), 0);
    let med;
    for (let i = 0; i < shares.length; i++) {
        if (cum[i] >= 0.5) {
            const lo = BIN_EDGES[i];
            const hi = BIN_EDGES[i + 1];
            const prevCum = i === 0 ? 0 : cum[i - 1];
            const within = (0.5 - prevCum) / Math.max(1e-9, shares[i]);
            if (hi === Infinity) {
                med = Math.max(lo, binMid(i)); // fallback to midpoint for open bin
            } else {
                med = lo + within * (hi - lo);
            }
            break;
        }
    }
    if (!isFinite(med)) med = 0;

    return {
        date: key.split("|")[0],
        median: med,
        bins: BIN_LABELS.map((label, i) => ({
            bucket: label,
            share: shares[i] * 100 // percentage
        }))
    };
}

function formatDelta(a, b) {
    const diff = b - a;
    const pct = a === 0 ? 0 : (diff / a) * 100;
    return { diff, pct };
}

/* ---------- Custom tooltip for histogram ---------- */
function CustomTooltip({ active, payload, label, theme, snapA, snapB, colorA, colorB }) {
    if (!active || !payload?.length) return null;
    const a = payload.find(p => p.dataKey === "A")?.value ?? null;
    const b = payload.find(p => p.dataKey === "B")?.value ?? null;
    const delta = (a != null && b != null) ? (b - a) : null; // percentage points

    return (
        <Paper elevation={4} sx={{
            px: 1.5, py: 1, borderRadius: 2, border: '1px solid', borderColor: 'divider',
            bgcolor: alpha(theme.palette.background.paper, 0.98), backdropFilter: 'blur(4px)',
        }}>
            <Stack spacing={0.75}>
                <Typography variant="caption" sx={{ opacity: 0.7 }}>Bucket: <b>{label}</b></Typography>

                <Stack direction="row" spacing={1.25} alignItems="center">
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: colorA }} />
                    <Typography variant="body2">
                        A <span style={{ opacity: 0.6 }}>({snapA.date})</span>: <b>{a?.toFixed?.(1) ?? '—'}%</b>
                    </Typography>
                </Stack>

                {snapB && (
                    <Stack direction="row" spacing={1.25} alignItems="center">
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: colorB }} />
                        <Typography variant="body2">
                            B <span style={{ opacity: 0.6 }}>({snapB.date})</span>: <b>{b?.toFixed?.(1) ?? '—'}%</b>
                        </Typography>
                    </Stack>
                )}

                {delta != null && (
                    <>
                        <Divider sx={{ my: 0.5 }} />
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            Δ {(delta >= 0 ? "+" : "")}{delta.toFixed(1)} pp
                        </Typography>
                    </>
                )}
            </Stack>
        </Paper>
    );
}

export default function LtvDrilldownModal({ open, onClose }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const [primaryDate, setPrimaryDate] = useState(dayjs());
    const [compareDate, setCompareDate] = useState(null); // optional B

    const snapA = useMemo(() => makeLtvSnapshot(primaryDate), [primaryDate]);
    const snapB = useMemo(() => compareDate ? makeLtvSnapshot(compareDate) : null, [compareDate]);

    const mergedChartData = useMemo(() => {
        const base = snapA.bins.map(({ bucket, share }) => ({ bucket, A: share }));
        if (!snapB) return base;
        return base.map((row, i) => ({ ...row, B: snapB.bins[i].share }));
    }, [snapA, snapB]);

    const medDelta = useMemo(() => {
        if (!snapB) return null;
        return formatDelta(snapA.median, snapB.median);
    }, [snapA, snapB]);

    const colorA = theme.palette.secondary.main; // LTV color
    const colorB = theme.palette.info.main;      // compare color

    const resetBoth = () => {
        setPrimaryDate(dayjs());
        setCompareDate(null); // hide B series
    };

    return (
        <Dialog
            fullScreen
            open={open}
            onClose={onClose}
            TransitionComponent={Transition}
            BackdropProps={{ sx: { backdropFilter: 'blur(3px)' } }}
        >
            <AppBar
                position="relative"
                elevation={0}
                sx={{
                    background: `linear-gradient(135deg, ${lighten(colorA, 0.05)} 0%, ${darken(colorA, 0.2)} 100%)`,
                    boxShadow: `inset 0 -1px 0 ${alpha('#000', 0.15)}`
                }}
            >
                <Toolbar>
                    <Typography sx={{ flex: 1, fontWeight: 700, letterSpacing: 0.2 }} variant="h6">
                        LTV Drilldown
                    </Typography>
                    <Chip
                        size="small"
                        icon={<InfoOutlinedIcon sx={{ fontSize: 16 }} />}
                        label="Demo data"
                        sx={{ mr: 1.5, bgcolor: alpha('#fff', 0.15), color: '#fff', borderColor: alpha('#fff', 0.3), border: '1px solid' }}
                    />
                    <IconButton edge="end" color="inherit" onClick={onClose}><CloseIcon /></IconButton>
                </Toolbar>
            </AppBar>

            <Box sx={{ p: isMobile ? 2 : 3, bgcolor: theme.palette.background.default, minHeight: "100%" }}>
                <Box sx={{ maxWidth: 1200, mx: "auto", display: "grid", gap: isMobile ? 2 : 3 }}>
                    {/* Date controls */}
                    <Paper elevation={0} sx={{
                        p: isMobile ? 2 : 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider",
                        background: `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 1)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`,
                    }}>
                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <Grid container spacing={2} alignItems="center">
                                <Grid item xs={12} md={4}>
                                    <Typography variant="subtitle2" sx={{ opacity: 0.75 }}>Primary date</Typography>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <DatePicker
                                            value={primaryDate}
                                            onChange={(v) => setPrimaryDate(v ?? dayjs())}
                                            disableFuture
                                            slotProps={{ textField: { size: "small", fullWidth: true } }}
                                        />
                                        <Tooltip title="Reset to today & clear comparison">
                                            <IconButton size="small" onClick={resetBoth}><TodayIcon fontSize="small" /></IconButton>
                                        </Tooltip>
                                    </Stack>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <Typography variant="subtitle2" sx={{ opacity: 0.75 }}>Compare with (optional)</Typography>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <DatePicker
                                            value={compareDate}
                                            onChange={(v) => setCompareDate(v)}
                                            disableFuture
                                            slotProps={{ textField: { size: "small", fullWidth: true, placeholder: "Select a date…" } }}
                                        />
                                        <Tooltip title="Reset to today & clear comparison">
                                            <IconButton size="small" onClick={resetBoth}><TodayIcon fontSize="small" /></IconButton>
                                        </Tooltip>
                                    </Stack>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: isMobile ? 1 : 4 }}>
                                        <Chip size="small" variant="filled" sx={{ bgcolor: colorA, color: "#fff" }} label={`A: ${snapA.date}`} />
                                        {snapB && <Chip size="small" variant="outlined" sx={{ borderColor: colorB, color: colorB }} label={`B: ${snapB.date}`} />}
                                    </Stack>
                                </Grid>
                            </Grid>
                        </LocalizationProvider>
                    </Paper>

                    {/* Median LTV headline(s) */}
                    <Grid container spacing={isMobile ? 2 : 3}>
                        <Grid item xs={12} md={snapB ? 6 : 12}>
                            <Paper elevation={0} sx={{
                                p: isMobile ? 2 : 3, borderRadius: 3,
                                background: `linear-gradient(135deg, ${lighten(colorA, 0.25)} 0%, ${colorA} 100%)`,
                                color: "#fff", border: "1px solid", borderColor: alpha("#000", 0.1),
                                boxShadow: `0 4px 20px ${alpha(colorA, 0.35)}`
                            }}>
                                <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>Median LTV (A)</Typography>
                                <Typography variant={isMobile ? "h4" : "h3"} sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                                    {euro.format(snapA.median)}
                                </Typography>
                                <Typography variant="caption" sx={{ opacity: 0.9 }}>{snapA.date}</Typography>
                            </Paper>
                        </Grid>

                        {snapB && (
                            <Grid item xs={12} md={6}>
                                <Paper elevation={0} sx={{
                                    p: isMobile ? 2 : 3, borderRadius: 3,
                                    bgcolor: alpha(theme.palette.background.paper, 0.9),
                                    border: "1px solid", borderColor: "divider"
                                }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                                        <Box>
                                            <Typography variant="subtitle2" sx={{ opacity: 0.75 }}>Median LTV (B)</Typography>
                                            <Typography variant={isMobile ? "h4" : "h3"} sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                                                {euro.format(snapB.median)}
                                            </Typography>
                                            <Typography variant="caption" sx={{ opacity: 0.75 }}>{snapB.date}</Typography>
                                        </Box>
                                        <Box sx={{ textAlign: "right", minWidth: 160 }}>
                                            <Typography variant="subtitle2" sx={{ opacity: 0.75, mb: 0.5 }}>Change vs A</Typography>
                                            {medDelta && (
                                                <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                                                    {medDelta.diff >= 0 ? <ArrowUpwardIcon fontSize="small" color="success" /> : <ArrowDownwardIcon fontSize="small" color="error" />}
                                                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                                                        {(medDelta.diff >= 0 ? "+" : "") + euro.format(Math.abs(medDelta.diff)).replace("€", "")}€
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ opacity: 0.75 }}>
                                                        ({medDelta.pct >= 0 ? "+" : ""}{medDelta.pct.toFixed(1)}%)
                                                    </Typography>
                                                </Stack>
                                            )}
                                        </Box>
                                    </Stack>
                                </Paper>
                            </Grid>
                        )}
                    </Grid>

                    {/* Distribution histogram (share per bucket) */}
                    <Paper elevation={0} sx={{
                        p: isMobile ? 2 : 3, borderRadius: 3, border: "1px solid", borderColor: "divider",
                        bgcolor: theme.palette.background.paper
                    }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                            <Stack direction="row" spacing={1.25} alignItems="center">
                                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>LTV Distribution (bucket share, %)</Typography>
                                <Tooltip title="Random but stable per date; pick a second date to compare">
                                    <InfoOutlinedIcon fontSize="small" sx={{ opacity: 0.6 }} />
                                </Tooltip>
                            </Stack>
                            <Stack direction="row" spacing={1}>
                                <Chip size="small" label={`A: ${snapA.date}`} sx={{ bgcolor: alpha(colorA, 0.12), color: colorA, borderColor: alpha(colorA, 0.3), border: "1px solid" }} />
                                {snapB && <Chip size="small" label={`B: ${snapB.date}`} sx={{ bgcolor: alpha(colorB, 0.12), color: colorB, borderColor: alpha(colorB, 0.3), border: "1px solid" }} />}
                            </Stack>
                        </Stack>

                        <Box sx={{ width: "100%", height: isMobile ? 300 : 380 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={mergedChartData}
                                    margin={{ top: 10, right: 20, bottom: 5, left: 0 }}
                                    barCategoryGap={snapB ? "20%" : "30%"}
                                    barGap={snapB ? 0 : 2}
                                >
                                    <defs>
                                        <linearGradient id="barA-ltv" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={lighten(colorA, 0.0)} stopOpacity={0.95} />
                                            <stop offset="100%" stopColor={lighten(colorA, 0.25)} stopOpacity={0.55} />
                                        </linearGradient>
                                        <linearGradient id="barB-ltv" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={lighten(colorB, 0.0)} stopOpacity={0.95} />
                                            <stop offset="100%" stopColor={lighten(colorB, 0.25)} stopOpacity={0.55} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.text.primary, 0.15)} />
                                    <XAxis dataKey="bucket" tick={{ fontSize: 12 }} interval={0} angle={isMobile ? -25 : 0} textAnchor={isMobile ? "end" : "middle"} height={isMobile ? 60 : 40} />
                                    <YAxis tick={{ fontSize: 12 }} unit="%" allowDecimals />
                                    <RTooltip content={(p) => <CustomTooltip {...p} theme={theme} snapA={snapA} snapB={snapB} colorA={colorA} colorB={colorB} />} />
                                    <Legend />
                                    <Bar dataKey="A" name={`A (${snapA.date})`} fill="url(#barA-ltv)" radius={[8, 8, 0, 0]} />
                                    {snapB && <Bar dataKey="B" name={`B (${snapB.date})`} fill="url(#barB-ltv)" radius={[8, 8, 0, 0]} />}
                                </BarChart>
                            </ResponsiveContainer>
                        </Box>
                    </Paper>
                </Box>
            </Box>
        </Dialog>
    );
}
