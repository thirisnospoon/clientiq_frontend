import React, { useEffect, useState } from "react";
import {
    Dialog, DialogTitle, DialogContent, IconButton, Box, Grid, Typography,
    Paper, Divider, CircularProgress, Avatar, Tooltip, Chip,
    Accordion, AccordionSummary, AccordionDetails, useMediaQuery
} from "@mui/material";
import CloseIcon         from "@mui/icons-material/Close";
import PhoneIcon         from "@mui/icons-material/Phone";
import ShoppingCartIcon  from "@mui/icons-material/Euro";
import PublicIcon        from "@mui/icons-material/Public";
import ChatIcon          from "@mui/icons-material/Chat";
import HistoryIcon       from "@mui/icons-material/History";
import ExpandMoreIcon    from "@mui/icons-material/ExpandMore";
import { motion }        from "framer-motion";
import { useTheme }      from "@mui/material/styles";
import dayjs             from "dayjs";

import { fetchClient }   from "../api/client.js";

/* ---------- KPI CONFIG ---------- */
const MARK_CONFIG = {
    like_to_engage:   { label:"Engage",   color:"#0288d1", max:10 },
    like_to_purchase: { label:"Purchase", color:"#43a047", max:10 },
    like_to_churn:    { label:"Churn",    color:"#c0a020", max:10 },
    ltv:              { label:"LTV (€)",  color:"#ff5722", max:20_000 },
};

/* ---------- Small helpers ---------- */
const FadeIn = ({ children, delay=0 }) => (
    <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.35, delay }}>
        {children}
    </motion.div>
);

const getInitials = (name="") => name.split(" ").map((n)=>n[0]||"").join("").toUpperCase();

/* ---------- KPI Card (tooltip = history chain) ---------- */
function MarkCard({ name, value, history=[] }) {
    const { label, color, max } = MARK_CONFIG[name] ?? {};
    const pct = max ? Math.min(100, (value/max)*100) : 0;

    return (
        <Tooltip
            arrow
            placement="top"
            title={
                history.length
                    ? (
                        <>
                            <strong>{label} history</strong><br/>
                            {history
                                .sort((a,b)=>dayjs(a.created_at).diff(dayjs(b.created_at)))
                                .map((h,i)=>(
                                    <span key={i}>
                      {dayjs(h.created_at).format("DD MMM")}: {h.new_value}<br/>
                    </span>
                                ))}
                        </>
                    )
                    : "No history"
            }
        >
            <Paper
                elevation={3}
                sx={{
                    px:2, py:1.5, borderRadius:2, textAlign:"center",
                    width:140, display:"flex", flexDirection:"column", alignItems:"center", gap:1
                }}
            >
                <CircularProgress
                    variant="determinate"
                    value={pct}
                    size={62}
                    thickness={5}
                    sx={{ color }}
                />
                <Typography variant="h6" fontWeight={600} lineHeight={1.2}>{value ?? "—"}</Typography>
                <Typography variant="caption" textTransform="uppercase" sx={{ color:"text.secondary" }}>
                    {label}
                </Typography>
            </Paper>
        </Tooltip>
    );
}

/* ---------- MAIN COMPONENT ---------- */
export default function ClientDetailsDialog({ open, onClose, client }) {
    const theme      = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

    /* preview (from table) & fresh data  */
    const [details, setDetails]   = useState(null);
    const [loading, setLoading]   = useState(false);
    const [err,     setErr]       = useState(null);

    /* fetch on id change */
    useEffect(() => {
        if (!open || !client?.id) return;

        let mounted = true;
        (async () => {
            setLoading(true);
            try {
                const data = await fetchClient(client.id);
                if (mounted) setDetails(data), setErr(null);
            } catch (e) {
                if (mounted) setErr(e.message);
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        return () => { mounted = false; };
    }, [open, client?.id]);

    const d = details || {};                 // alias

    /* ---------- derived ---------- */
    const marks = {
        like_to_engage:   d.like_to_engage,
        like_to_purchase: d.like_to_purchase,
        like_to_churn:    d.like_to_churn,
        ltv:              d.ltv,
    };
    const markHistory = (type) => (d.marks_history || []).filter(h => h.mark_type === type);

    const headerGradient = `linear-gradient(135deg, ${MARK_CONFIG.like_to_engage.color} 0%, ${MARK_CONFIG.like_to_purchase.color} 100%)`;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="lg"
            fullScreen={fullScreen}
            PaperProps={{ sx:{ width:{ xs:"95vw", sm:"90vw", md:"80vw", lg:"70vw" }, borderRadius:2, overflow:"hidden" } }}
        >
            {/* ---------- HEADER ---------- */}
            <DialogTitle sx={{ bgcolor:headerGradient, position:"relative", px:4, py:3 }}>
                <Box sx={{ display:"flex", alignItems:"center", gap:2 }}>
                    <Avatar sx={{ bgcolor:"secondary.main", width:56, height:56 }}>{getInitials(d.client_name)}</Avatar>
                    <Box>
                        <Typography variant="h4" fontWeight={700}>{d.client_name ?? "—"}</Typography>
                        <Typography variant="body2" sx={{ display:"flex", alignItems:"center", gap:1 }}>
                            <PhoneIcon fontSize="small"/> {d.phone ?? client?.phone ?? "—"}
                        </Typography>
                    </Box>
                </Box>
                <IconButton onClick={onClose} sx={{ position:"absolute", right:12, top:12, color:"#fff" }}>
                    <CloseIcon />
                </IconButton>

                <FadeIn delay={0.15}>
                    <Box sx={{ mt:3, display:"flex", gap:2, flexWrap:"wrap", justifyContent:"center" }}>
                        {Object.entries(marks).map(([k,v]) => (
                            <MarkCard key={k} name={k} value={v} history={markHistory(k)} />
                        ))}
                    </Box>
                </FadeIn>
            </DialogTitle>

            {/* ---------- CONTENT ---------- */}
            <DialogContent dividers sx={{ p:{ xs:3, md:4 }, bgcolor:theme.palette.background.default }}>
                {loading && (
                    <Box sx={{ display:"flex", justifyContent:"center", my:4 }}><CircularProgress /></Box>
                )}
                {err && (
                    <Typography color="error" sx={{ mb:2 }}>{err}</Typography>
                )}

                {!loading && (
                    <Grid container spacing={4}>
                        {/* --- BUDGET & DIRECTIONS --- */}
                        <Grid item xs={12} md={6}>
                            <FadeIn delay={0.25}>
                                <Paper elevation={2} sx={{ p:3, borderRadius:2, height:"100%" }}>
                                    <Typography variant="h6" sx={{ display:"flex", alignItems:"center", gap:1, mb:2, fontWeight:600 }}>
                                        <ShoppingCartIcon fontSize="small"/> Budget
                                    </Typography>
                                    <Divider sx={{ mb:2 }}/>
                                    <Typography variant="body1" gutterBottom>
                                        <strong>Amount:</strong> {d.budget_amount ?? "-"} {d.budget_currency?.toUpperCase() ?? ""}
                                    </Typography>
                                    <Typography variant="body1">
                                        <strong>Directions:</strong> {d.directions ?? "-"}
                                    </Typography>
                                </Paper>
                            </FadeIn>
                        </Grid>

                        {/* --- Website activity --- */}
                        <Grid item xs={12} md={6}>
                            <FadeIn delay={0.3}>
                                <Paper elevation={2} sx={{ p:3, borderRadius:2, height:"100%" }}>
                                    <Typography variant="h6" sx={{ display:"flex", alignItems:"center", gap:1, mb:2, fontWeight:600 }}>
                                        <PublicIcon fontSize="small"/> Website Activity
                                    </Typography>
                                    <Divider sx={{ mb:2 }}/>
                                    <Typography variant="body1" gutterBottom>
                                        <strong>Tours Viewed:</strong> {d.website_activity?.tours_viewed ?? "-"}
                                    </Typography>
                                    <Typography variant="body1">
                                        <strong>Count:</strong> {d.website_activity?.count ?? "-"}
                                    </Typography>
                                </Paper>
                            </FadeIn>
                        </Grid>

                        {/* --- Conversations summary & history --- */}
                        <Grid item xs={12}>
                            <FadeIn delay={0.35}>
                                <Paper elevation={2} sx={{ p:3, borderRadius:2 }}>
                                    <Typography variant="h6" sx={{ display:"flex", alignItems:"center", gap:1, mb:2, fontWeight:600 }}>
                                        <ChatIcon fontSize="small"/> Conversations ({d.conversations?.count ?? 0})
                                    </Typography>
                                    <Divider sx={{ mb:2 }}/>

                                    {/* last summary */}
                                    <Typography variant="body1" gutterBottom>
                                        <strong>Manager Mark:</strong> {d.conversations?.manager_mark ?? "-"} /
                                        {d.conversations?.manager_mark_max ?? 10}
                                    </Typography>
                                    <Typography variant="body1" sx={{ whiteSpace:"pre-wrap", mb:2, fontStyle:"italic" }}>
                                        {d.conversations?.last_conversation_summary ?? "-"}
                                    </Typography>

                                    {/* history accordion */}
                                    {Array.isArray(d.conversation_history) && d.conversation_history.length > 0 && (
                                        <Accordion>
                                            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor:theme.palette.action.hover }}>
                                                <HistoryIcon fontSize="small" sx={{ mr:1 }}/> Full Summary History
                                            </AccordionSummary>
                                            <AccordionDetails sx={{ maxHeight:260, overflowY:"auto" }}>
                                                {d.conversation_history.map((h,i)=>(
                                                    <Box key={i} sx={{ mb:2 }}>
                                                        <Typography variant="caption" sx={{ color:"text.secondary" }}>
                                                            {dayjs(h.created_at).format("DD-MM-YYYY HH:mm")}
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ whiteSpace:"pre-wrap" }}>{h.summary}</Typography>
                                                        {i !== d.conversation_history.length-1 && <Divider sx={{ my:1 }}/>}
                                                    </Box>
                                                ))}
                                            </AccordionDetails>
                                        </Accordion>
                                    )}
                                </Paper>
                            </FadeIn>
                        </Grid>

                        {/* --- Triggers --- */}
                        {Array.isArray(d.triggers) && d.triggers.length > 0 && (
                            <Grid item xs={12}>
                                <FadeIn delay={0.4}>
                                    <Paper elevation={2} sx={{ p:3, borderRadius:2 }}>
                                        <Typography variant="h6" sx={{ fontWeight:600, mb:2 }}>
                                            Triggers
                                        </Typography>
                                        <Divider sx={{ mb:2 }}/>
                                        <Box sx={{ display:"flex", gap:1, flexWrap:"wrap" }}>
                                            {d.triggers.map((t,i)=>(
                                                <Chip key={i} label={t} color="warning" variant="outlined"/>
                                            ))}
                                        </Box>
                                    </Paper>
                                </FadeIn>
                            </Grid>
                        )}
                    </Grid>
                )}
            </DialogContent>
        </Dialog>
    );
}
