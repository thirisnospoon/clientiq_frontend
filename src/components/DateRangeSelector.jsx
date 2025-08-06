// ---------------- DateRangeSelector.jsx ----------------
import React from "react";
import { Stack, useTheme, useMediaQuery } from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

export default function DateRangeSelector({ start, end, onChange, mobile }) {
    const theme    = useTheme();
    const isMobile = mobile ?? useMediaQuery(theme.breakpoints.down("sm"));

    /* Сetaємо лише, якщо дата валідна і не порушує порядок */
    const setStart = (v) => {
        if (v && !v.isAfter(end)) onChange({ start: v.startOf("day"), end });
    };
    const setEnd = (v) => {
        if (v && !v.isBefore(start)) onChange({ start, end: v.startOf("day") });
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={isMobile ? 1.5 : 2}>
                <DatePicker
                    label="Start"
                    value={start}
                    format="DD-MM-YYYY"
                    onChange={setStart}
                    disableFuture
                    slotProps={{ textField: { size: "small" } }}
                />
                <DatePicker
                    label="End"
                    value={end}
                    format="DD-MM-YYYY"
                    onChange={setEnd}
                    disableFuture
                    slotProps={{ textField: { size: "small" } }}
                />
            </Stack>
        </LocalizationProvider>
    );
}
