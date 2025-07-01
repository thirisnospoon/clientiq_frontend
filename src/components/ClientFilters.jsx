import React from "react";
import { Grid, Paper, Slider, Typography, Box } from "@mui/material";
import DateRangeSelector from "./DateRangeSelector";

export default function ClientFilters({ markMeta, filters, onChange }) {
    const handleMark = (key) => (_, range) =>
        onChange({
            ...filters,
            marks: { ...filters.marks, [key]: range },
        });

    const handleDate = (range) =>
        onChange({
            ...filters,
            date: { start: range.start, end: range.end },
        });

    return (
        <Paper sx={{ p: 3, mb: 4 }}>
            <Typography variant="h6" gutterBottom align="center">
                Client filters
            </Typography>

            <Grid container spacing={7}>
                <Grid item xs={12}>
                    <Box display="flex" justifyContent="center">
                        <DateRangeSelector start={filters.date.start} end={filters.date.end} onChange={handleDate} />
                    </Box>
                </Grid>

                {markMeta.map(({ key, label, max, color }) => (
                    <Grid item xs={12} md={3} key={key}>
                        <Typography variant="subtitle2" align="center" gutterBottom>
                            {label}
                        </Typography>
                        <Slider
                            value={filters.marks[key]}
                            min={0}
                            max={max}
                            step={1}
                            valueLabelDisplay="auto"
                            onChange={handleMark(key)}
                            sx={{
                                color,
                                "& .MuiSlider-track": { border: "none" },
                                "& .MuiSlider-thumb": { boxShadow: 0 },
                            }}
                        />
                    </Grid>
                ))}
            </Grid>
        </Paper>
    );
}