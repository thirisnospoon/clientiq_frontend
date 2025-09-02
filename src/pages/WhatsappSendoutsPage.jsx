import React, { useEffect, useMemo, useState } from "react";
import {
    AppBar, Toolbar, Container, Box, Paper, Stack, Typography, Chip, Divider, Grid,
    TextField, Button, IconButton, Tooltip, Alert, LinearProgress, Avatar
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { motion, AnimatePresence } from "framer-motion";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";
import AnalyticsOutlinedIcon from "@mui/icons-material/AnalyticsOutlined";
import ListAltOutlinedIcon from "@mui/icons-material/ListAltOutlined";
import TimelapseRoundedIcon from "@mui/icons-material/TimelapseRounded";

import NumbersDropzone from "../components/whatsapp/NumbersDropzone.jsx";
import StatsDialog from "../components/whatsapp/StatsDialog.jsx";

import {
    checkWhatsappHealth,
    sendWhatsappTemplate,
    fetchWhatsappTemplates,
} from "../api/whatsapp";

/* Helpers */
function normalizePhone(raw) {
    if (!raw) return null;
    let s = String(raw).trim();
    s = s.replace(/[^\d+]/g, "");
    s = s.replace(/^\+/, "");
    s = s.replace(/[\s\-\(\)]/g, "");
    return s;
}
const unique = (arr) => Array.from(new Set(arr.filter(Boolean)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Smart queue knobs (tuned for safety) */
const MAX_CONCURRENCY = 3;          // how many workers in parallel
const BASE_SPACING_MS = 500;        // min spacing between sends per worker
const MAX_ATTEMPTS = 3;             // per-phone attempts
const JITTER_MS = 200;              // random jitter to avoid bursts

export default function WhatsappSendoutsPage() {
    /* Health */
    const [health, setHealth] = useState(null);
    const healthOk = health?.api_key_valid && String(health?.status || "").toLowerCase() !== "unhealthy";

    /* Templates */
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState("");

    /* Recipients */
    const [manualNumbers, setManualNumbers] = useState("");
    const [csvNumbers, setCsvNumbers] = useState([]);
    const recipientList = useMemo(() => {
        const manual = manualNumbers
            .split(/\r?\n|,|;/)
            .map(s => normalizePhone(s))
            .filter(Boolean);
        return unique([...manual, ...csvNumbers.map(normalizePhone)]);
    }, [manualNumbers, csvNumbers]);

    /* Sending state */
    const [sending, setSending] = useState(false);
    const [progress, setProgress] = useState(0);
    const [results, setResults] = useState({}); // phone -> { status, message_id, external_message_id, attempts, error, success }

    /* Global throttling */
    const [pauseUntil, setPauseUntil] = useState(0); // timestamp ms
    const paused = pauseUntil > Date.now();
    const [pauseRemain, setPauseRemain] = useState(0);

    /* Activity toasts */
    const [events, setEvents] = useState([]); // {id, level, text}
    const pushEvent = (level, text) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setEvents((prev) => [...prev, { id, level, text }]);
        // Auto-remove after a while
        setTimeout(() => {
            setEvents((prev) => prev.filter((e) => e.id !== id));
        }, 6500);
    };

    /* Stats dialog */
    const [openStats, setOpenStats] = useState(false);

    // Load health + templates on mount
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const [h, t] = await Promise.all([checkWhatsappHealth(), fetchWhatsappTemplates()]);
                if (!mounted) return;
                setHealth(h || null);
                const list = t?.templates || [];
                setTemplates(list);
                if (list?.length && !selectedTemplate) setSelectedTemplate(list[0].name);
            } catch {
                // ignore
            }
        })();
        return () => { mounted = false; };
    }, []); // once

    // Update pause countdown
    useEffect(() => {
        if (!paused) {
            setPauseRemain(0);
            return;
        }
        let raf = 0;
        const tick = () => {
            const remain = Math.max(0, pauseUntil - Date.now());
            setPauseRemain(remain);
            if (remain > 0) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [paused, pauseUntil]);

    const handleUploadNumbers = (arr) => {
        setCsvNumbers(arr || []);
    };

    const copyResult = (text) => {
        try {
            navigator.clipboard.writeText(text || "");
        } catch {/* noop */}
    };

    const canSend = selectedTemplate && recipientList.length > 0 && !sending;

    /* --- Smart queue + retry/backoff --- */
    const setGlobalPause = (ms, reason = "Rate limit") => {
        const until = Date.now() + ms;
        setPauseUntil(until);
        const sec = Math.ceil(ms / 1000);
        pushEvent("warning", `${reason}: pausing for ${sec}s`);
    };

    const waitIfPaused = async () => {
        while (true) {
            const now = Date.now();
            if (pauseUntil > now) {
                await sleep(Math.min(500, pauseUntil - now));
            } else {
                break;
            }
        }
    };

    const sendWithRetry = async (phone) => {
        let attempt = 0;
        while (attempt < MAX_ATTEMPTS) {
            attempt += 1;
            try {
                // Before each attempt respect global pause
                await waitIfPaused();

                const resp = await sendWhatsappTemplate({
                    phone_number: phone,
                    template_name: selectedTemplate,
                    // No template_params
                });

                setResults(prev => ({
                    ...prev,
                    [phone]: {
                        ...(prev[phone] || {}),
                        status: resp?.status || "sent",
                        message_id: resp?.message_id,
                        external_message_id: resp?.external_message_id,
                        attempts: attempt,
                        success: resp?.success === true || true,
                    }
                }));
                return true;
            } catch (err) {
                const status = err?.status;
                const retryAfter = err?.retryAfter; // seconds
                const isRateLimit = status === 429;
                const isServer = status >= 500;

                setResults(prev => ({
                    ...prev,
                    [phone]: {
                        ...(prev[phone] || {}),
                        status: "retrying",
                        error: err?.message || "Send failed",
                        attempts: attempt,
                        success: false
                    }
                }));

                // Decide backoff
                let backoffMs = 0;
                if (isRateLimit || isServer) {
                    backoffMs = retryAfter ? retryAfter * 1000 : Math.min(30000, 1000 * Math.pow(2, attempt)); // 1s,2s,4s...
                    setGlobalPause(backoffMs, isRateLimit ? "Rate limit" : "Server issue");
                } else {
                    backoffMs = 500 * attempt + Math.floor(Math.random() * 300); // light backoff for client errors
                }

                await sleep(backoffMs);

                if (attempt >= MAX_ATTEMPTS) {
                    setResults(prev => ({
                        ...prev,
                        [phone]: {
                            ...(prev[phone] || {}),
                            status: "failed",
                            success: false
                        }
                    }));
                    pushEvent("error", `Failed ${phone} after ${MAX_ATTEMPTS} attempts`);
                    return false;
                }
            }
        }
        return false;
    };

    const doSend = async () => {
        if (!canSend) return;
        setSending(true);
        setProgress(0);
        setResults({});

        pushEvent("info", `Starting sendout to ${recipientList.length} recipients with "${selectedTemplate}"`);
        let completed = 0;
        const total = recipientList.length;

        // Shared index for workers
        let idx = 0;

        const worker = async (workerId) => {
            while (true) {
                const myIndex = idx++;
                if (myIndex >= total) break;

                const phone = recipientList[myIndex];

                // spacing between sends per worker + jitter
                const jitter = Math.floor(Math.random() * JITTER_MS);
                await sleep(BASE_SPACING_MS + jitter);

                await sendWithRetry(phone);

                completed += 1;
                setProgress(Math.round((completed / total) * 100));
            }
        };

        // Spin up limited workers
        const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, total) }, (_, i) => worker(i));
        await Promise.all(workers);

        setSending(false);
        pushEvent("success", `Sendout complete: ${completed}/${total} processed`);
    };

    /* Derived: health chip */
    const healthChip = useMemo(() => {
        if (!health) return <Chip label="Checking health..." size="small" />;
        return healthOk ? (
            <Chip
                size="small"
                color="success"
                icon={<CheckCircleIcon />}
                label="API healthy"
            />
        ) : (
            <Chip
                size="small"
                color="error"
                icon={<ErrorOutlineIcon />}
                label="API unhealthy"
            />
        );
    }, [health, healthOk]);

    /* UI */
    return (
        <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
            <AppBar position="static" elevation={2}>
                <Toolbar>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        WhatsApp Sendouts
                    </Typography>
                    {healthChip}
                    {paused && (
                        <Chip
                            sx={{ ml: 1 }}
                            size="small"
                            color="warning"
                            icon={<TimelapseRoundedIcon />}
                            label={`Throttling ${Math.ceil(pauseRemain / 1000)}s`}
                        />
                    )}
                    <Tooltip title="Refresh health">
                        <IconButton color="inherit" onClick={async () => setHealth(await checkWhatsappHealth())}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="View stats">
                        <IconButton color="inherit" onClick={() => setOpenStats(true)}>
                            <AnalyticsOutlinedIcon />
                        </IconButton>
                    </Tooltip>
                </Toolbar>
            </AppBar>

            <Container maxWidth="lg" sx={{ py: 3, flexGrow: 1 }}>
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                >
                    <Paper
                        elevation={0}
                        sx={{
                            p: 3,
                            borderRadius: 3,
                            position: "relative",
                            overflow: "hidden",
                            border: theme => `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
                            background: theme => `linear-gradient(145deg,
                                ${alpha(theme.palette.primary.light, 0.10)} 0%,
                                ${alpha(theme.palette.primary.main, 0.03)} 100%)`,
                        }}
                    >
                        {/* decorative glow */}
                        <Box sx={{
                            position: "absolute", right: -80, top: -80,
                            width: 220, height: 220, borderRadius: "50%",
                            background: theme => alpha(theme.palette.primary.main, 0.12),
                            filter: "blur(40px)"
                        }} />

                        <Stack spacing={2}>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                                <Avatar variant="rounded" sx={{
                                    bgcolor: theme => alpha(theme.palette.primary.main, 0.18),
                                    color: "primary.main", width: 44, height: 44
                                }}>
                                    <ListAltOutlinedIcon />
                                </Avatar>
                                <Box>
                                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                        Create Sendout
                                    </Typography>
                                    <Typography variant="body2" sx={{ opacity: 0.7 }}>
                                        Choose a template, paste/upload recipients, and send. The system auto-throttles on limits and retries up to 3× per number.
                                    </Typography>
                                </Box>
                            </Stack>

                            <Divider />

                            {/* Controls */}
                            <Grid container spacing={3}>
                                {/* Template */}
                                <Grid item xs={12} md={6}>
                                    <Stack spacing={2}>
                                        <TextField
                                            select
                                            SelectProps={{ native: true }}
                                            label="Template"
                                            value={selectedTemplate}
                                            onChange={(e) => setSelectedTemplate(e.target.value)}
                                            fullWidth
                                        >
                                            <option value="" disabled>Select a template</option>
                                            {templates.map(t => (
                                                <option key={`${t.name}-${t.language}`} value={t.name}>
                                                    {t.name} ({t.language}) {t.status ? `– ${t.status}` : ""}
                                                </option>
                                            ))}
                                        </TextField>
                                        <Alert severity="info" sx={{ m: 0 }}>
                                            Bulk send uses a smart queue (concurrency {MAX_CONCURRENCY}, spacing {(BASE_SPACING_MS/1000).toFixed(2)}s + jitter).
                                        </Alert>
                                    </Stack>
                                </Grid>

                                {/* Recipients */}
                                <Grid item xs={12} md={6}>
                                    <Stack spacing={2}>
                                        <TextField
                                            label="Recipients (one per line; commas/semicolon accepted)"
                                            multiline minRows={6} fullWidth
                                            placeholder="380733927425&#10;380XXXXXXXXX"
                                            value={manualNumbers}
                                            onChange={(e) => setManualNumbers(e.target.value)}
                                        />
                                        <NumbersDropzone onNumbers={handleUploadNumbers} />
                                        {!!csvNumbers.length && (
                                            <Chip
                                                color="info"
                                                label={`Loaded from CSV: ${csvNumbers.length}`}
                                            />
                                        )}
                                    </Stack>
                                </Grid>
                            </Grid>

                            {/* Actions */}
                            <Stack direction="row" spacing={1.5} alignItems="center">
                                <Button
                                    variant="contained"
                                    startIcon={<SendRoundedIcon />}
                                    disabled={!canSend}
                                    onClick={doSend}
                                >
                                    Send to {recipientList.length} recipient{recipientList.length !== 1 ? "s" : ""}
                                </Button>
                                {!healthOk && (
                                    <Alert severity="warning" sx={{ m: 0 }}>
                                        API health is not OK — send may fail.
                                    </Alert>
                                )}
                            </Stack>

                            {sending && (
                                <Box sx={{ mt: 1 }}>
                                    <LinearProgress variant="determinate" value={progress} />
                                    <Typography variant="caption" sx={{ opacity: 0.75 }}>
                                        {progress}% completed {paused ? "• throttling…" : ""}
                                    </Typography>
                                </Box>
                            )}

                            {/* Results */}
                            {!!Object.keys(results).length && (
                                <Box sx={{ mt: 2 }}>
                                    <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700 }}>
                                        Results
                                    </Typography>
                                    <Grid container spacing={1.5}>
                                        {recipientList.map((phone) => {
                                            const r = results[phone];
                                            const ok = r?.status && r.status !== "failed";
                                            const subtitle = r?.status === "retrying"
                                                ? `Retrying (${r?.attempts}/${MAX_ATTEMPTS})…`
                                                : (ok ? (r?.status || "sent") : (r?.error || "failed"));
                                            return (
                                                <Grid item xs={12} md={6} key={phone}>
                                                    <Paper
                                                        variant="outlined"
                                                        sx={{
                                                            p: 1.25, borderRadius: 2,
                                                            borderColor: theme => ok
                                                                ? alpha(theme.palette.success.main, 0.4)
                                                                : alpha(theme.palette.error.main, 0.4),
                                                        }}
                                                    >
                                                        <Stack direction="row" spacing={1} alignItems="center">
                                                            {ok ? <CheckCircleIcon color="success" /> : <ErrorOutlineIcon color="error" />}
                                                            <Stack spacing={0}>
                                                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                                    {phone}
                                                                </Typography>
                                                                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                                                                    {subtitle}
                                                                </Typography>
                                                            </Stack>
                                                            <Box sx={{ flexGrow: 1 }} />
                                                            {r?.message_id && (
                                                                <Tooltip title="Copy message_id">
                                                                    <IconButton size="small" onClick={() => copyResult(r.message_id)}>
                                                                        <ContentCopyIcon fontSize="inherit" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            )}
                                                            {r?.external_message_id && (
                                                                <Tooltip title="Copy external_message_id">
                                                                    <IconButton size="small" onClick={() => copyResult(r.external_message_id)}>
                                                                        <ContentCopyIcon fontSize="inherit" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            )}
                                                        </Stack>
                                                    </Paper>
                                                </Grid>
                                            );
                                        })}
                                    </Grid>
                                </Box>
                            )}

                            {/* Small note */}
                            <Typography variant="caption" sx={{ opacity: 0.65 }}>
                                All numbers are normalized (leading <code>+</code> removed). The queue auto-throttles on 429/5xx and retries up to {MAX_ATTEMPTS} times.
                            </Typography>
                        </Stack>
                    </Paper>
                </motion.div>
            </Container>

            {/* Activity toasts (animated, stacked) */}
            <Box sx={{ position: "fixed", right: 16, bottom: 16, zIndex: 1400, width: 360, pointerEvents: "none" }}>
                <AnimatePresence>
                    {events.slice(-5).map((e) => (
                        <motion.div
                            key={e.id}
                            initial={{ opacity: 0, y: 20, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.98 }}
                            transition={{ type: "spring", stiffness: 260, damping: 20 }}
                            style={{ marginTop: 8 }}
                        >
                            <Paper
                                elevation={3}
                                sx={{
                                    p: 1.25,
                                    borderRadius: 2,
                                    bgcolor: (theme) => {
                                        if (e.level === "success") return alpha(theme.palette.success.main, 0.1);
                                        if (e.level === "warning") return alpha(theme.palette.warning.main, 0.12);
                                        if (e.level === "error") return alpha(theme.palette.error.main, 0.1);
                                        return theme.palette.background.paper;
                                    },
                                    border: (theme) => {
                                        if (e.level === "success") return `1px solid ${alpha(theme.palette.success.main, 0.35)}`;
                                        if (e.level === "warning") return `1px solid ${alpha(theme.palette.warning.main, 0.35)}`;
                                        if (e.level === "error") return `1px solid ${alpha(theme.palette.error.main, 0.35)}`;
                                        return `1px solid ${theme.palette.divider}`;
                                    },
                                    pointerEvents: "auto"
                                }}
                            >
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {e.text}
                                </Typography>
                            </Paper>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </Box>

            {/* Stats popup */}
            <StatsDialog open={openStats} onClose={() => setOpenStats(false)} />
        </Box>
    );
}
