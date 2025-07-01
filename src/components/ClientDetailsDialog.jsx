import React from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    IconButton,
    Box,
    Grid,
    Typography,
    Paper,
    Divider,
    CircularProgress,
    Avatar,
    useMediaQuery
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PhoneIcon from "@mui/icons-material/Phone";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import PublicIcon from "@mui/icons-material/Public";
import ChatIcon from "@mui/icons-material/Chat";
import { motion } from "framer-motion";
import { useTheme } from "@mui/material/styles";

// Configuration for KPI visualization
const MARK_CONFIG = {
    like_to_engage: { label: "Engage", color: "#0288d1", max: 10 },
    like_to_purchase: { label: "Purchase", color: "#43a047", max: 10 },
    like_to_churn: { label: "Churn", color: "#a5b127", max: 10 },
    ltv: { label: "LTV (€)", color: "#ff5722", max: 20000 }
};

// Animated fade-in with slight upward motion
const FadeIn = ({ children, delay = 0 }) => (
    <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay }}
    >
        {children}
    </motion.div>
);

// KPI gauge card
function MarkCard({ name, value }) {
    const { label, color, max } = MARK_CONFIG[name] || {};
    const pct = max ? Math.min(100, (value / max) * 100) : 0;

    return (
        <Paper
            elevation={3}
            sx={{
                p: 2,
                bgcolor: "background.paper",
                borderRadius: 2,
                textAlign: "center",
                width: 140,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1
            }}
        >
            <Box sx={{ position: "relative", display: "inline-flex" }}>
                <CircularProgress
                    variant="determinate"
                    value={pct}
                    thickness={5}
                    size={64}
                    sx={{ color }}
                />
                <Box
                    sx={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                    }}
                >
                    <Typography variant="h6" fontWeight={600}>
                        {value}
                    </Typography>
                </Box>
            </Box>
            <Typography
                variant="subtitle2"
                sx={{ fontWeight: 500, textTransform: "uppercase", color: "text.secondary" }}
            >
                {label}
            </Typography>
        </Paper>
    );
}

// Utility to get initials from name
const getInitials = (name) =>
    name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase();

// Main client details dialog
export default function ClientDetailsDialog({ open, onClose, client }) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

    if (!client) return null;
    const { client_name, client_phone_number, crm_data = {}, conversations_data = {}, website_data = {}, marks = {} } = client;

    // Header gradient
    const headerBg = `linear-gradient(135deg, ${MARK_CONFIG.like_to_engage.color} 0%, ${MARK_CONFIG.like_to_purchase.color} 100%)`;
    const initials = getInitials(client_name || "");

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="lg"
            fullScreen={fullScreen}
            PaperProps={{ sx: { width: { xs: "95vw", sm: "90vw", md: "80vw", lg: "70vw" }, maxWidth: 1100, borderRadius: 2, overflow: "hidden" } }}
        >
            {/* HEADER */}
            <DialogTitle sx={{ bgcolor: headerBg, color: "#101010", position: "relative", px: 4, py: 3 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Avatar sx={{ bgcolor: "secondary.main", width: 56, height: 56, fontSize: "1.25rem" }}>
                        {initials}
                    </Avatar>
                    <Box>
                        <Typography variant="h3" fontWeight={700} sx={{ letterSpacing: 0.5, color: "#232323" }}>
                            {client_name}
                        </Typography>
                        <Typography
                            variant="body1"
                            sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5, opacity: 0.85, color: "#292929" }}
                        >
                            <PhoneIcon fontSize="small" sx={{ color: "#191919" }} /> {client_phone_number}
                        </Typography>
                    </Box>
                </Box>

                <IconButton onClick={onClose} sx={{ position: "absolute", right: 12, top: 12, color: "#fff" }}>
                    <CloseIcon fontSize="small" />
                </IconButton>

                {/* KPI ROW */}
                <FadeIn delay={0.2}>
                    <Box sx={{ mt: 3, display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
                        {Object.entries(marks).map(([k, v]) => (
                            <MarkCard key={k} name={k} value={v} />
                        ))}
                    </Box>
                </FadeIn>
            </DialogTitle>

            {/* CONTENT */}
            <DialogContent dividers sx={{ bgcolor: theme.palette.background.default, p: { xs: 3, md: 4 } }}>
                <Grid container spacing={4}>
                    {/* LEFT COLUMN */}
                    <Grid item xs={12} md={6}>
                        <FadeIn delay={0.3}>
                            <Paper elevation={2} sx={{ p: 3, borderRadius: 2, height: "100%" }}>
                                <Typography variant="h6" sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, fontWeight: 600 }}>
                                    <ShoppingCartIcon fontSize="small" /> Last Purchase
                                </Typography>
                                <Divider sx={{ mb: 2 }} />
                                <Typography variant="body1" gutterBottom>
                                    <strong>Date:</strong> {crm_data.last_purchase_date || "-"}
                                </Typography>
                                <Typography variant="body1" gutterBottom>
                                    <strong>Cost:</strong> €{crm_data.last_purchase_cost || "-"}
                                </Typography>
                                <Typography variant="body1">
                                    <strong>Type:</strong> {crm_data.last_purchase_type || "-"}
                                </Typography>
                            </Paper>
                        </FadeIn>
                    </Grid>

                    {/* RIGHT COLUMN */}
                    <Grid item xs={12} md={6}>
                        <FadeIn delay={0.35}>
                            <Paper elevation={2} sx={{ p: 3, borderRadius: 2, height: "100%" }}>
                                <Typography variant="h6" sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, fontWeight: 600 }}>
                                    <PublicIcon fontSize="small" /> Website Activity
                                </Typography>
                                <Divider sx={{ mb: 2 }} />
                                <Typography variant="body1" gutterBottom>
                                    <strong>Tours Viewed:</strong> {website_data.tours_viewed || "-"}
                                </Typography>
                                <Typography variant="body1">
                                    <strong>Count:</strong> {website_data.tours_viewed_number || "-"}
                                </Typography>
                            </Paper>
                        </FadeIn>
                    </Grid>

                    {/* FULL WIDTH SECTION */}
                    <Grid item xs={12}>
                        <FadeIn delay={0.4}>
                            <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
                                <Typography variant="h6" sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, fontWeight: 600 }}>
                                    <ChatIcon fontSize="small" /> Conversations ({conversations_data.conversations_amount || 0})
                                </Typography>
                                <Divider sx={{ mb: 2 }} />
                                <Typography variant="body1" gutterBottom>
                                    <strong>Manager Mark:</strong> {conversations_data.manager_mark || "-"} / 10
                                </Typography>
                                <Typography variant="body1" sx={{ whiteSpace: "pre-wrap", fontStyle: "italic" }}>
                                    {conversations_data.conversations_summary || "-"}
                                </Typography>
                            </Paper>
                        </FadeIn>
                    </Grid>
                </Grid>
            </DialogContent>
        </Dialog>
    );
}
