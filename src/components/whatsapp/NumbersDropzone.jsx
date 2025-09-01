// src/components/whatsapp/NumbersDropzone.jsx
import React, { useCallback, useState } from "react";
import { Box, Stack, Typography, Button, Alert } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";

function parseCsvSingleColumn(text) {
    const lines = text
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean);

    const delimCandidates = [",", ";", "\t"];
    const parsed = [];

    for (const line of lines) {
        // If any delimiter produces >1 non-empty token -> multi-column -> error
        for (const d of delimCandidates) {
            const parts = line.split(d).map(s => s.trim()).filter(p => p.length > 0);
            if (parts.length > 1) {
                throw new Error("CSV must contain exactly one column (one phone per row).");
            }
        }
        parsed.push(line);
    }
    return parsed;
}

export default function NumbersDropzone({ onNumbers }) {
    const [error, setError] = useState(null);

    const onFileChange = useCallback((e) => {
        setError(null);
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const text = String(reader.result || "");
                const numbers = parseCsvSingleColumn(text);
                onNumbers(numbers);
            } catch (err) {
                setError(err.message || "Invalid CSV");
            }
        };
        reader.onerror = () => setError("Failed to read the file.");
        reader.readAsText(file);
    }, [onNumbers]);

    return (
        <Stack spacing={1.25}>
            <Box
                sx={{
                    p: 3,
                    border: theme => `1px dashed ${theme.palette.divider}`,
                    borderRadius: 2,
                    textAlign: "center",
                    bgcolor: theme => theme.palette.background.paper,
                }}
            >
                <CloudUploadIcon sx={{ fontSize: 40, opacity: 0.7 }} />
                <Typography variant="subtitle1" sx={{ mt: 1, mb: 0.5, fontWeight: 600 }}>
                    Upload CSV (one column)
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.7, mb: 1.5 }}>
                    One phone number per row (no header)
                </Typography>
                <Button variant="outlined" component="label">
                    Select CSV
                    <input type="file" accept=".csv,text/csv,text/plain" hidden onChange={onFileChange} />
                </Button>
            </Box>
            {error && <Alert severity="error">{error}</Alert>}
        </Stack>
    );
}
