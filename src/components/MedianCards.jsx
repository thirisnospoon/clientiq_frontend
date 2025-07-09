import React, { useState } from "react";
import {
    Card,
    CardContent,
    Typography,
    useTheme,
    useMediaQuery,
    Popover,
    Fade,
    Box,
    Divider,
} from "@mui/material";

/**
 * props:
 *  label    – заголовок
 *  value    – число (или "—")
 *  color    – строка palette'ы, например "info.main"
 *  unit     – префикс, например "$"
 *  details  – массив { label, value } для pop-up
 */
export default function MedianCard({ label, value, color, unit, details = [] }) {
    const theme    = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const display  = typeof value === "number" ? value.toLocaleString() : "—";

    const base = color.split(".")[0];

    /* ---------- Popover state ---------- */
    const [anchorPos, setAnchorPos] = useState(null);
    const open = Boolean(anchorPos);

    const handleEnter = (e) => {
        const { clientX, clientY } = e;
        setAnchorPos({ top: clientY + 10, left: clientX + 10 });
    };
    const handleMove  = (e) => open && setAnchorPos({ top: e.clientY + 10, left: e.clientX + 10 });
    const handleLeave = () => setAnchorPos(null);

    // Стиль только для заголовков карточки
    const textStyles = {
        color: "#fff",
        textShadow: "0 1px 3px rgba(0, 0, 0, 0.5)",
    };

    return (
        <>
            <Card
                elevation={4}
                onMouseEnter={handleEnter}
                onMouseMove={handleMove}
                onMouseLeave={handleLeave}
                sx={{
                    cursor: details.length ? "pointer" : "default",
                    transition: "box-shadow 0.15s, filter 0.15s",
                    "&:hover": { boxShadow: 6, filter: details.length ? "brightness(1.02)" : "none" },
                    background: `linear-gradient(135deg, ${theme.palette[base].light} 0%, ${theme.palette[base].main} 100%)`,
                }}
            >
                <CardContent sx={{ p: isMobile ? 1.5 : 2 }}>
                    <Typography
                        variant={isMobile ? "caption" : "subtitle2"}
                        sx={{ opacity: 0.8, ...textStyles }}
                    >
                        {label}
                    </Typography>
                    <Typography
                        variant={isMobile ? "h6" : "h4"}
                        sx={{ fontWeight: "bold", ...textStyles }}
                    >
                        {unit ? `${unit}${display}` : display}
                    </Typography>
                </CardContent>
            </Card>

            <Popover
                open={open}
                anchorReference="anchorPosition"
                anchorPosition={anchorPos ?? { top: 0, left: 0 }}
                onClose={handleLeave}
                TransitionComponent={Fade}
                transitionDuration={120}
                disableRestoreFocus
                sx={{
                    pointerEvents: "none",
                    zIndex: theme.zIndex.tooltip + 2,
                }}
                PaperProps={{
                    sx: {
                        pointerEvents: "auto",
                        px: 1.5,
                        py: 1,
                        borderRadius: 2,
                        minWidth: 160,
                    },
                    onMouseLeave: handleLeave,
                }}
            >
                <Box>
                    {details.map(({ label: dLabel, value: dValue }, idx) => (
                        <Box key={idx}>
                            {idx > 0 && <Divider sx={{ my: 0.5 }} />}
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    fontSize: isMobile ? "0.7rem" : "0.8rem",
                                    py: 0.3,
                                }}
                            >
                                <span>{dLabel}</span>
                                <span style={{ fontWeight: 600 }}>{dValue.toLocaleString()}</span>
                            </Box>
                        </Box>
                    ))}
                </Box>
            </Popover>
        </>
    );
}
