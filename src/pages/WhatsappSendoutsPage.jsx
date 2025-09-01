// src/pages/WhatsappSendoutsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
    AppBar, Toolbar, Container, Box, Paper, Stack, Typography, Chip, Divider, Grid,
    TextField, Button, IconButton, Tooltip, Alert, LinearProgress, Avatar
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { motion } from "framer-motion";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";
import AnalyticsOutlinedIcon from "@mui/icons-material/AnalyticsOutlined";
import ListAltOutlinedIcon from "@mui/icons-material/ListAltOutlined";

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
    // Keep digits and +, then remove leading plus and any spaces/dashes/()
    s = s.replace(/[^\d+]/g, "");
    s = s.replace(/^\+/, "");
    s = s.replace(/[\s\-\(\)]/g, "");
    return s;
}
const unique = (arr) => Array.from(new Set(arr.filter(Boolean)));

/* Simple concurrency helper */
async function runBatches(items, fn, size = 5) {
    for (let i = 0; i < items.length; i += size) {
        const slice = items.slice(i, i + size);
        await Promise.allSettled(slice.map(fn));
    }
}

export default function WhatsappSendoutsPage() {
    /* Health */
    const [health, setHealth] = useState(null);
    const healthOk = health?.api_key_valid && String(health?.status || "").toLowerCase() !== "unhealthy";

    /* Templates (no params support – we only select the template name) */
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
    const [results, setResults] = useState({}); // phone -> { status, message_id, external_message_id, error }

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

    const handleUploadNumbers = (arr) => {
        setCsvNumbers(arr || []);
    };

    const copyResult = (text) => {
        try {
            navigator.clipboard.writeText(text || "");
        } catch {/* noop */}
    };

    const canSend = selectedTemplate && recipientList.length > 0 && !sending;

    const doSend = async () => {
        if (!canSend) return;
        setSending(true);
        setProgress(0);
        setResults({});

        let completed = 0;
        const total = recipientList.length;

        const sendOne = async (phone) => {
            try {
                const resp = await sendWhatsappTemplate({
                    phone_number: phone,
                    template_name: selectedTemplate,
                    // No template_params at all
                });
                setResults(prev => ({
                    ...prev,
                    [phone]: {
                        status: resp?.status || "sent",
                        message_id: resp?.message_id,
                        external_message_id: resp?.external_message_id,
                        success: resp?.success === true
                    }
                }));
            } catch (err) {
                const msg = err?.response?.data?.error || err?.message || "Send failed";
                setResults(prev => ({
                    ...prev,
                    [phone]: { status: "failed", error: String(msg) }
                }));
            } finally {
                completed += 1;
                setProgress(Math.round((completed / total) * 100));
            }
        };

        await runBatches(recipientList, sendOne, 6); // concurrency = 6
        setSending(false);
    };

    /* UI */
    return (
        <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
            <AppBar position="static" elevation={2}>
                <Toolbar>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        WhatsApp Sendouts
                    </Typography>
                    {healthChip}
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
                                        Choose a template, paste/upload recipients, and send. (Templates currently require no parameters.)
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
                                            This page sends templates without parameters.
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
                                        {progress}% completed
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
                                                                    {ok ? (r?.status || "sent") : (r?.error || "failed")}
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
                                All numbers are normalized (leading <code>+</code> removed).
                            </Typography>
                        </Stack>
                    </Paper>
                </motion.div>
            </Container>

            {/* Stats popup */}
            <StatsDialog open={openStats} onClose={() => setOpenStats(false)} />
        </Box>
    );
}
