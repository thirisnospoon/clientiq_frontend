import React from 'react';
import { Stack } from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

export default function DateRangeSelector({ start, end, onChange }) {
    const setStart = (v) => v && !v.isAfter(end) && onChange({ start: v, end });
    const setEnd = (v) => v && !v.isBefore(start) && onChange({ start, end: v });
    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <DatePicker label="Start" value={start} format="DD-MM-YYYY" onChange={setStart} disableFuture />
                <DatePicker label="End" value={end} format="DD-MM-YYYY" onChange={setEnd} disableFuture />
            </Stack>
        </LocalizationProvider>
    );
}