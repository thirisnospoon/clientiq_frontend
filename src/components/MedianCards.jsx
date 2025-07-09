import React from "react";
import { Card, CardContent, Typography, useTheme, useMediaQuery } from "@mui/material";

export default function MedianCard({ label, value, color, unit }) {
    const theme     = useTheme();
    const isMobile  = useMediaQuery(theme.breakpoints.down("sm"));
    const display   = typeof value === "number" ? value.toLocaleString() : "—";

    // Derive palette base (e.g. "info" from "info.main")
    const base = color.split(".")[0];

    return (
        <Card
            elevation={4}
            sx={{
                background: `linear-gradient(135deg, ${theme.palette[base].light} 0%, ${theme.palette[base].main} 100%)`,
                color: theme.palette.getContrastText(theme.palette[base].main),
            }}
        >
            <CardContent sx={{ p: isMobile ? 1.5 : 2 }}>
                <Typography variant={isMobile ? "caption" : "subtitle2"} sx={{ opacity: 0.8 }}>
                    {label}
                </Typography>
                <Typography variant={isMobile ? "h6" : "h4"} sx={{ fontWeight: "bold" }}>
                    {unit ? `${unit}${display}` : display}
                </Typography>
            </CardContent>
        </Card>
    );
}
