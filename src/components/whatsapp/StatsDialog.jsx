// src/components/whatsapp/StatsDialog.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Stack,
    Typography,
    Chip,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    LinearProgress,
    Box,
    TableContainer,
    Paper,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Tooltip,
    Grid,
    TablePagination,
    IconButton,
    Switch,
    FormControlLabel,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import DateRangeIcon from "@mui/icons-material/DateRange";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { alpha } from "@mui/material/styles";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import * as XLSX from "xlsx";

import { fetchWhatsappStatistics } from "../../api/whatsapp";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip as RTooltip,
    CartesianGrid,
    Cell,
} from "recharts";

dayjs.extend(utc);

/* ---------- helpers ---------- */
function toCSV(rows, columns) {
    const header = columns.map((c) => `"${c.header}"`).join(",");
    const esc = (v) => {
        if (v === undefined || v === null) return "";
        const s = String(v).replace(/"/g, '""');
        return `"${s}"`;
    };
    const body = rows
        .map((row) => columns.map((c) => esc(c.accessor(row))).join(","))
        .join("\n");
    return `${header}\n${body}`;
}
function downloadBlob(filename, mime, content) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

const STATUS_COLORS = {
    sent: (theme) => theme.palette.info.main,
    delivered: (theme) => theme.palette.success.main,
    read: (theme) => theme.palette.primary.main,
    pending: (theme) => theme.palette.warning.main,
    failed: (theme) => theme.palette.error.main,
};
function statusColor(theme, status) {
    const key = String(status || "").toLowerCase();
    return STATUS_COLORS[key]?.(theme) || theme.palette.grey[600];
}

/** Format "2025-09-01T15:20:09.764007+00:00" -> "01-09-2025 15:20:09" (local time) */
function formatDateTime(iso) {
    const d = dayjs(iso);
    if (!d.isValid()) return "—";
    return d.utc().local().format("DD-MM-YYYY HH:mm:ss");
}

function groupColor(theme, idx) {
    const palette = [
        theme.palette.primary.main,
        theme.palette.success.main,
        theme.palette.info.main,
        theme.palette.warning.main,
        theme.palette.secondary?.main || theme.palette.error.light,
        theme.palette.error.main,
    ];
    return palette[idx % palette.length];
}

/* ---------- component ---------- */
export default function StatsDialog({ open, onClose }) {
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState(null);
    const [messages, setMessages] = useState([]);

    // filters
    const [statusFilter, setStatusFilter] = useState("all");
    const [templateFilter, setTemplateFilter] = useState("all");
    const [fromDate, setFromDate] = useState(null);
    const [toDate, setToDate] = useState(null);

    // grouping
    const [groupingEnabled, setGroupingEnabled] = useState(true);
    const [thresholdSec, setThresholdSec] = useState(60); // "sendout window" in seconds
    const [collapsedGroups, setCollapsedGroups] = useState({}); // idx -> bool

    // pagination
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    useEffect(() => {
        if (!open) return;
        let mounted = true;
        (async () => {
            setLoading(true);
            try {
                const data = await fetchWhatsappStatistics();
                if (!mounted) return;
                setStats(data?.statistics || null);
                setMessages(data?.messages || []);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [open]);

    // options
    const templateOptions = useMemo(() => {
        const set = new Set();
        (messages || []).forEach((m) => {
            if (m.template_name) set.add(m.template_name);
        });
        return Array.from(set);
    }, [messages]);
    const statusOptions = useMemo(() => {
        const set = new Set();
        (messages || []).forEach((m) => {
            if (m.status) set.add(String(m.status).toLowerCase());
        });
        return Array.from(set);
    }, [messages]);

    // filtered rows
    const filteredMessages = useMemo(() => {
        return (messages || []).filter((m) => {
            if (statusFilter !== "all" && String(m.status).toLowerCase() !== statusFilter) return false;
            if (templateFilter !== "all" && m.template_name !== templateFilter) return false;
            if (fromDate) {
                const created = dayjs(m.created_at);
                if (!created.isValid() || created.isBefore(fromDate.startOf("day"))) return false;
            }
            if (toDate) {
                const created = dayjs(m.created_at);
                if (!created.isValid() || created.isAfter(toDate.endOf("day"))) return false;
            }
            return true;
        });
    }, [messages, statusFilter, templateFilter, fromDate, toDate]);

    // sort newest first
    const sortedMessages = useMemo(
        () =>
            [...filteredMessages].sort(
                (a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf()
            ),
        [filteredMessages]
    );

    // chart from filtered messages
    const chartData = useMemo(() => {
        const buckets = { sent: 0, delivered: 0, read: 0, pending: 0, failed: 0 };
        filteredMessages.forEach((m) => {
            const s = String(m.status || "").toLowerCase();
            if (s in buckets) buckets[s] += 1;
        });
        return Object.entries(buckets).map(([name, value]) => ({ name, value }));
    }, [filteredMessages]);

    // gradients + per-bar fill
    const fillFor = (name) => {
        switch (name) {
            case "sent":
                return "url(#barSent)";
            case "delivered":
                return "url(#barDelivered)";
            case "read":
                return "url(#barRead)";
            case "pending":
                return "url(#barPending)";
            case "failed":
                return "url(#barFailed)";
            default:
                return "#8884d8";
        }
    };

    // downloads
    const columns = [
        { header: "Created", accessor: (r) => r.created_at || "" },
        { header: "Phone", accessor: (r) => r.phone_number || "" },
        { header: "Status", accessor: (r) => r.status || "" },
        { header: "Type", accessor: (r) => r.message_type || "" },
        { header: "Template", accessor: (r) => r.template_name || "" },
        { header: "External ID", accessor: (r) => r.external_message_id || "" },
    ];
    const handleDownloadJSON = () => {
        const payload = { statistics: stats, messages: filteredMessages };
        downloadBlob(
            "whatsapp_statistics.json",
            "application/json",
            JSON.stringify(payload, null, 2)
        );
    };
    const handleDownloadCSV = () => {
        const csv = toCSV(filteredMessages, columns);
        downloadBlob("whatsapp_statistics.csv", "text/csv;charset=utf-8", csv);
    };
    const handleDownloadExcel = () => {
        const sheetRows = filteredMessages.map((r) => ({
            Created: r.created_at || "",
            Phone: r.phone_number || "",
            Status: r.status || "",
            Type: r.message_type || "",
            Template: r.template_name || "",
            "External ID": r.external_message_id || "",
        }));
        const ws = XLSX.utils.json_to_sheet(sheetRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Stats");
        const wbout = XLSX.write(wb, { type: "array", bookType: "xlsx" });
        const blob = new Blob([wbout], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "whatsapp_statistics.xlsx";
        a.click();
        URL.revokeObjectURL(url);
    };
    const resetFilters = () => {
        setStatusFilter("all");
        setTemplateFilter("all");
        setFromDate(null);
        setToDate(null);
        setPage(0);
    };

    // Build time-based "sendouts" from sorted messages
    const groups = useMemo(() => {
        if (!groupingEnabled) return [];
        const list = [];
        let current = [];
        const pushCurrent = () => {
            if (!current.length) return;
            const start = dayjs(current[current.length - 1].created_at); // oldest in group
            const end = dayjs(current[0].created_at); // newest in group
            const uniqueTemplates = Array.from(
                new Set(current.map((m) => m.template_name).filter(Boolean))
            );
            list.push({ items: current, start, end, uniqueTemplates });
            current = [];
        };

        for (let i = 0; i < sortedMessages.length; i++) {
            const m = sortedMessages[i];
            if (!current.length) {
                current.push(m);
            } else {
                const prev = current[current.length - 1];
                const diffSec = Math.abs(dayjs(prev.created_at).diff(dayjs(m.created_at), "second"));
                if (diffSec <= thresholdSec) current.push(m);
                else {
                    pushCurrent();
                    current.push(m);
                }
            }
        }
        pushCurrent();
        return list;
    }, [sortedMessages, thresholdSec, groupingEnabled]);

    // Reset paging when key controls change
    useEffect(() => {
        setPage(0);
    }, [statusFilter, templateFilter, fromDate, toDate, groupingEnabled, thresholdSec]);

    // pagination slice (groups vs rows)
    const pagedGroups = useMemo(() => {
        if (!groupingEnabled) return [];
        const start = page * rowsPerPage;
        return groups.slice(start, start + rowsPerPage);
    }, [groups, page, rowsPerPage, groupingEnabled]);

    const pagedRowsNoGrouping = useMemo(() => {
        if (groupingEnabled) return [];
        const start = page * rowsPerPage;
        return sortedMessages.slice(start, start + rowsPerPage);
    }, [sortedMessages, page, rowsPerPage, groupingEnabled]);

    const toggleGroup = (absIdx) =>
        setCollapsedGroups((prev) => ({ ...prev, [absIdx]: !prev[absIdx] }));

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
            <DialogTitle sx={{ pb: 1.5 }}>WhatsApp Messaging Statistics</DialogTitle>

            <DialogContent dividers>
                {loading && <LinearProgress sx={{ mb: 2 }} />}

                {!loading && (
                    <Stack spacing={2.5}>
                        {/* Summary chips */}
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                            {chartData.map(({ name, value }) => (
                                <Chip
                                    key={name}
                                    label={`${name}: ${value}`}
                                    sx={{
                                        color: "#fff",
                                        bgcolor: (theme) => {
                                            switch (name) {
                                                case "sent":
                                                    return alpha(theme.palette.info.main, 0.9);
                                                case "delivered":
                                                    return alpha(theme.palette.success.main, 0.95);
                                                case "read":
                                                    return alpha(theme.palette.primary.main, 0.95);
                                                case "pending":
                                                    return alpha(theme.palette.warning.main, 0.95);
                                                case "failed":
                                                    return alpha(theme.palette.error.main, 0.95);
                                                default:
                                                    return theme.palette.grey[700];
                                            }
                                        },
                                    }}
                                />
                            ))}
                            <Chip label={`Total messages: ${filteredMessages.length}`} />
                        </Stack>

                        {/* Chart */}
                        <Paper
                            variant="outlined"
                            sx={{
                                p: 2,
                                borderRadius: 2,
                                background: (theme) =>
                                    `linear-gradient(120deg, ${alpha(theme.palette.primary.light, 0.1)} 0%, ${alpha(
                                        theme.palette.primary.main,
                                        0.03
                                    )} 100%)`,
                            }}
                        >
                            <Box sx={{ height: 280 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} barSize={36}>
                                        <defs>
                                            <linearGradient id="barSent" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#6FB3FF" />
                                                <stop offset="100%" stopColor="#4C9AFF" />
                                            </linearGradient>
                                            <linearGradient id="barDelivered" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#4CD97B" />
                                                <stop offset="100%" stopColor="#2ECC71" />
                                            </linearGradient>
                                            <linearGradient id="barRead" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#6E85FF" />
                                                <stop offset="100%" stopColor="#4C6FFF" />
                                            </linearGradient>
                                            <linearGradient id="barPending" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#FFD66B" />
                                                <stop offset="100%" stopColor="#F4BF4F" />
                                            </linearGradient>
                                            <linearGradient id="barFailed" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#FF7A7A" />
                                                <stop offset="100%" stopColor="#E55353" />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis allowDecimals={false} />
                                        <RTooltip />
                                        <Bar dataKey="value">
                                            {chartData.map((entry) => (
                                                <Cell key={entry.name} fill={fillFor(entry.name)} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>
                        </Paper>

                        {/* Filters + Downloads + Grouping */}
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                            <Grid container spacing={2} alignItems="center">
                                {/* Left: status + template */}
                                <Grid item xs={12} md={5}>
                                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                                        <FormControl size="small" sx={{ minWidth: 160 }}>
                                            <InputLabel id="status-filter-label">
                                                <FilterAltIcon sx={{ mr: 0.5 }} /> Status
                                            </InputLabel>
                                            <Select
                                                labelId="status-filter-label"
                                                label="Status"
                                                value={statusFilter}
                                                onChange={(e) => {
                                                    setStatusFilter(e.target.value);
                                                    setPage(0);
                                                }}
                                            >
                                                <MenuItem value="all">All</MenuItem>
                                                {statusOptions.map((s) => (
                                                    <MenuItem key={s} value={s}>
                                                        {s}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>

                                        <FormControl size="small" sx={{ minWidth: 200 }}>
                                            <InputLabel id="template-filter-label">
                                                <FilterAltIcon sx={{ mr: 0.5 }} /> Template
                                            </InputLabel>
                                            <Select
                                                labelId="template-filter-label"
                                                label="Template"
                                                value={templateFilter}
                                                onChange={(e) => {
                                                    setTemplateFilter(e.target.value);
                                                    setPage(0);
                                                }}
                                            >
                                                <MenuItem value="all">All</MenuItem>
                                                {templateOptions.map((t) => (
                                                    <MenuItem key={t} value={t}>
                                                        {t}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Stack>
                                </Grid>

                                {/* Middle: date range + quick chips */}
                                <Grid item xs={12} md={5}>
                                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                                        <Stack
                                            direction={{ xs: "column", sm: "row" }}
                                            spacing={1.5}
                                            alignItems="center"
                                        >
                                            <DatePicker
                                                label="From"
                                                value={fromDate}
                                                onChange={(v) => {
                                                    setFromDate(v);
                                                    setPage(0);
                                                }}
                                                slotProps={{ textField: { size: "small", fullWidth: true } }}
                                                sx={{ minWidth: 160, flex: 1 }}
                                            />
                                            <DatePicker
                                                label="To"
                                                value={toDate}
                                                onChange={(v) => {
                                                    setToDate(v);
                                                    setPage(0);
                                                }}
                                                slotProps={{ textField: { size: "small", fullWidth: true } }}
                                                sx={{ minWidth: 160, flex: 1 }}
                                            />
                                            <Stack direction="row" spacing={1}>
                                                <Chip
                                                    icon={<DateRangeIcon />}
                                                    size="small"
                                                    label="7d"
                                                    onClick={() => {
                                                        const end = dayjs();
                                                        const start = end.subtract(6, "day");
                                                        setFromDate(start);
                                                        setToDate(end);
                                                        setPage(0);
                                                    }}
                                                />
                                                <Chip
                                                    icon={<DateRangeIcon />}
                                                    size="small"
                                                    label="30d"
                                                    onClick={() => {
                                                        const end = dayjs();
                                                        const start = end.subtract(29, "day");
                                                        setFromDate(start);
                                                        setToDate(end);
                                                        setPage(0);
                                                    }}
                                                />
                                                <Chip icon={<RestartAltIcon />} size="small" label="Reset" onClick={resetFilters} />
                                            </Stack>
                                        </Stack>
                                    </LocalizationProvider>
                                </Grid>

                                {/* Right: downloads + grouping controls */}
                                <Grid item xs={12} md={2}>
                                    <Stack
                                        direction="row"
                                        spacing={1}
                                        justifyContent={{ xs: "flex-start", md: "flex-end" }}
                                        flexWrap="wrap"
                                    >
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<FileDownloadOutlinedIcon />}
                                            onClick={handleDownloadJSON}
                                        >
                                            JSON
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<DownloadIcon />}
                                            onClick={handleDownloadCSV}
                                        >
                                            CSV
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<DownloadIcon />}
                                            onClick={handleDownloadExcel}
                                        >
                                            XLSX
                                        </Button>
                                    </Stack>
                                </Grid>

                                {/* Grouping row */}
                                <Grid item xs={12}>
                                    <Stack
                                        direction={{ xs: "column", md: "row" }}
                                        spacing={1.5}
                                        alignItems={{ xs: "flex-start", md: "center" }}
                                        justifyContent="space-between"
                                    >
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={groupingEnabled}
                                                    onChange={(e) => setGroupingEnabled(e.target.checked)}
                                                />
                                            }
                                            label="Group by time window (sendout detection)"
                                        />
                                        <Stack direction="row" spacing={1.5} alignItems="center">
                                            <FormControl size="small" sx={{ minWidth: 160 }}>
                                                <InputLabel id="threshold-label">Sendout window</InputLabel>
                                                <Select
                                                    labelId="threshold-label"
                                                    label="Sendout window"
                                                    value={thresholdSec}
                                                    onChange={(e) => setThresholdSec(Number(e.target.value))}
                                                >
                                                    <MenuItem value={10}>10 seconds</MenuItem>
                                                    <MenuItem value={30}>30 seconds</MenuItem>
                                                    <MenuItem value={60}>1 minute</MenuItem>
                                                    <MenuItem value={120}>2 minutes</MenuItem>
                                                    <MenuItem value={300}>5 minutes</MenuItem>
                                                </Select>
                                            </FormControl>
                                            <Tooltip title="Quick set to 1 minute">
                                                <Chip size="small" label="1m" onClick={() => setThresholdSec(60)} />
                                            </Tooltip>
                                            <Tooltip title="Quick set to 5 minutes">
                                                <Chip size="small" label="5m" onClick={() => setThresholdSec(300)} />
                                            </Tooltip>
                                        </Stack>
                                    </Stack>
                                </Grid>
                            </Grid>
                        </Paper>

                        {/* Table */}
                        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
                            <TableContainer>
                                <Table size="small" stickyHeader>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                                                Created (local)
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>Template</TableCell>
                                            <TableCell sx={{ fontWeight: 700, width: 220 }}>External ID</TableCell>
                                        </TableRow>
                                    </TableHead>

                                    <TableBody>
                                        {/* GROUPED RENDER (no nested tables to avoid column drift) */}
                                        {groupingEnabled &&
                                            pagedGroups.map((group, gi) => {
                                                const absIdx = page * rowsPerPage + gi;
                                                const gColor = (theme) => groupColor(theme, gi);
                                                const isCollapsed = !!collapsedGroups[absIdx];

                                                return (
                                                    <React.Fragment key={`g-${absIdx}`}>
                                                        {/* Group header row */}
                                                        <TableRow
                                                            sx={{
                                                                backgroundColor: (theme) => alpha(gColor(theme), 0.08),
                                                            }}
                                                        >
                                                            <TableCell colSpan={6} sx={{ py: 1 }}>
                                                                <Stack
                                                                    direction="row"
                                                                    alignItems="center"
                                                                    justifyContent="space-between"
                                                                    spacing={2}
                                                                >
                                                                    <Stack direction="row" alignItems="center" spacing={1.5}>
                                                                        <Box
                                                                            sx={{
                                                                                width: 10,
                                                                                height: 10,
                                                                                borderRadius: "50%",
                                                                                bgcolor: (theme) => gColor(theme),
                                                                            }}
                                                                        />
                                                                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                                            Sendout {absIdx + 1}
                                                                        </Typography>
                                                                        <Chip
                                                                            size="small"
                                                                            label={`${group.items.length} messages`}
                                                                            sx={{ textTransform: "none" }}
                                                                        />
                                                                        <Chip
                                                                            size="small"
                                                                            label={`${formatDateTime(group.start)} — ${formatDateTime(
                                                                                group.end
                                                                            )}`}
                                                                            sx={{ textTransform: "none" }}
                                                                        />
                                                                        {!!group.uniqueTemplates.length && (
                                                                            <Tooltip title={group.uniqueTemplates.join(", ")} placement="top">
                                                                                <Chip
                                                                                    size="small"
                                                                                    label={`${group.uniqueTemplates.length} template${
                                                                                        group.uniqueTemplates.length > 1 ? "s" : ""
                                                                                    }`}
                                                                                    sx={{ textTransform: "none" }}
                                                                                />
                                                                            </Tooltip>
                                                                        )}
                                                                    </Stack>
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => toggleGroup(absIdx)}
                                                                        sx={{
                                                                            transform: isCollapsed ? "rotate(180deg)" : "rotate(0deg)",
                                                                            transition: "transform 0.2s",
                                                                        }}
                                                                    >
                                                                        <ExpandMoreRoundedIcon fontSize="small" />
                                                                    </IconButton>
                                                                </Stack>
                                                            </TableCell>
                                                        </TableRow>

                                                        {/* Group rows (render directly inside same TableBody to keep alignment) */}
                                                        {!isCollapsed &&
                                                            group.items.map((m) => {
                                                                const shortExt = m.external_message_id
                                                                    ? String(m.external_message_id).slice(0, 5)
                                                                    : "—";
                                                                return (
                                                                    <TableRow
                                                                        key={m.id}
                                                                        hover
                                                                        sx={{
                                                                            borderLeft: (theme) => `4px solid ${alpha(gColor(theme), 0.9)}`,
                                                                            "&:nth-of-type(odd)": {
                                                                                backgroundColor: (theme) => alpha(gColor(theme), 0.04),
                                                                            },
                                                                        }}
                                                                    >
                                                                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                                                                            {formatDateTime(m.created_at)}
                                                                        </TableCell>
                                                                        <TableCell
                                                                            sx={{
                                                                                fontFamily:
                                                                                    "ui-monospace, SFMono-Regular, Menlo, monospace",
                                                                            }}
                                                                        >
                                                                            {m.phone_number || "—"}
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <Chip
                                                                                size="small"
                                                                                label={m.status || "—"}
                                                                                sx={{
                                                                                    color: "#fff",
                                                                                    bgcolor: (theme) => statusColor(theme, m.status),
                                                                                    textTransform: "none",
                                                                                    fontWeight: 600,
                                                                                }}
                                                                            />
                                                                        </TableCell>
                                                                        <TableCell>{m.message_type || "—"}</TableCell>
                                                                        <TableCell>{m.template_name || "—"}</TableCell>
                                                                        <TableCell>
                                                                            {m.external_message_id ? (
                                                                                <Tooltip title={m.external_message_id}>
                                                                                    <Box
                                                                                        component="span"
                                                                                        sx={{
                                                                                            fontFamily:
                                                                                                "ui-monospace, SFMono-Regular, Menlo, monospace",
                                                                                            px: 1,
                                                                                            py: 0.25,
                                                                                            borderRadius: 1,
                                                                                            bgcolor: (theme) =>
                                                                                                alpha(theme.palette.grey[500], 0.12),
                                                                                        }}
                                                                                    >
                                                                                        {shortExt}…
                                                                                    </Box>
                                                                                </Tooltip>
                                                                            ) : (
                                                                                "—"
                                                                            )}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                );
                                                            })}
                                                    </React.Fragment>
                                                );
                                            })}

                                        {/* UNGROUPED RENDER */}
                                        {!groupingEnabled &&
                                            pagedRowsNoGrouping.map((m) => {
                                                const shortExt = m.external_message_id
                                                    ? String(m.external_message_id).slice(0, 5)
                                                    : "—";
                                                return (
                                                    <TableRow
                                                        key={m.id}
                                                        hover
                                                        sx={{
                                                            borderLeft: (theme) =>
                                                                `4px solid ${alpha(statusColor(theme, m.status), 0.9)}`,
                                                            "&:nth-of-type(odd)": {
                                                                backgroundColor: (theme) =>
                                                                    alpha(theme.palette.primary.main, 0.02),
                                                            },
                                                        }}
                                                    >
                                                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                                                            {formatDateTime(m.created_at)}
                                                        </TableCell>
                                                        <TableCell
                                                            sx={{
                                                                fontFamily:
                                                                    "ui-monospace, SFMono-Regular, Menlo, monospace",
                                                            }}
                                                        >
                                                            {m.phone_number || "—"}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                size="small"
                                                                label={m.status || "—"}
                                                                sx={{
                                                                    color: "#fff",
                                                                    bgcolor: (theme) => statusColor(theme, m.status),
                                                                    textTransform: "none",
                                                                    fontWeight: 600,
                                                                }}
                                                            />
                                                        </TableCell>
                                                        <TableCell>{m.message_type || "—"}</TableCell>
                                                        <TableCell>{m.template_name || "—"}</TableCell>
                                                        <TableCell>
                                                            {m.external_message_id ? (
                                                                <Tooltip title={m.external_message_id}>
                                                                    <Box
                                                                        component="span"
                                                                        sx={{
                                                                            fontFamily:
                                                                                "ui-monospace, SFMono-Regular, Menlo, monospace",
                                                                            px: 1,
                                                                            py: 0.25,
                                                                            borderRadius: 1,
                                                                            bgcolor: (theme) =>
                                                                                alpha(theme.palette.grey[500], 0.12),
                                                                        }}
                                                                    >
                                                                        {shortExt}…
                                                                    </Box>
                                                                </Tooltip>
                                                            ) : (
                                                                "—"
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}

                                        {/* Empty state */}
                                        {((groupingEnabled && !pagedGroups.length) ||
                                            (!groupingEnabled && !pagedRowsNoGrouping.length)) && (
                                            <TableRow>
                                                <TableCell colSpan={6} sx={{ py: 4, textAlign: "center", opacity: 0.7 }}>
                                                    No messages match the current filters.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            <TablePagination
                                component="div"
                                count={groupingEnabled ? groups.length : sortedMessages.length}
                                page={page}
                                onPageChange={(_, p) => setPage(p)}
                                rowsPerPage={rowsPerPage}
                                onRowsPerPageChange={(e) => {
                                    setRowsPerPage(parseInt(e.target.value, 10));
                                    setPage(0);
                                }}
                                rowsPerPageOptions={[5, 10, 25, 50, 100]}
                                labelRowsPerPage={
                                    groupingEnabled ? "Sendouts per page:" : "Rows per page:"
                                }
                            />
                        </Paper>
                    </Stack>
                )}
            </DialogContent>

            <DialogActions>
                <Button variant="contained" onClick={onClose}>
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
}
