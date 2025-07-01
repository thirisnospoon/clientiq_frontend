import React, { useMemo, useState } from "react";
import { Paper, Typography, Box, LinearProgress, useTheme } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import ClientDetailsDialog from "./ClientDetailsDialog";

// Custom cell for marks: shows a progress bar normally, and the raw value on hover
const MarkCell = ({ value, max, color }) => {
    const [hovered, setHovered] = useState(false);
    const percentage = max > 0 ? (value / max) * 100 : 0;

    return (
        <Box
            width="100%"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {hovered ? (
                <Typography variant="body2" align="center">
                    {value}
                </Typography>
            ) : (
                <LinearProgress
                    variant="determinate"
                    value={percentage}
                    sx={{
                        height: 8,
                        borderRadius: 5,
                        "& .MuiLinearProgress-bar": {
                            backgroundColor: color.main,
                        },
                    }}
                />
            )}
        </Box>
    );
};

export default function ClientsTable({ clients }) {
    const theme = useTheme();
    const [selected, setSelected] = useState(null);

    // dynamic max for LTV bars
    const maxLtv = useMemo(
        () => Math.max(0, ...clients.map((c) => c.marks?.ltv ?? c.ltv ?? 0)),
        [clients]
    );

    // palette lookup for mark keys
    const paletteFor = {
        like_to_engage: theme.palette.info,
        like_to_purchase: theme.palette.success,
        like_to_churn: theme.palette.warning,
        ltv: theme.palette.secondary,
    };

    // transform raw objects into DataGrid rows
    const rows = clients.map((c, id) => ({
        id,
        client_name: c.client_name,
        client_phone_number: c.client_phone_number,
        last_purchase_date: c.crm_data.last_purchase_date,
        last_purchase_cost: c.crm_data.last_purchase_cost,
        last_purchase_type: c.crm_data.last_purchase_type,
        ...c.marks, // like_to_*, ltv
        _raw: c, // keep full ref for the dialog
    }));

    // click → open dialog
    const handleRowClick = ({ row }) => setSelected(row._raw);

    // helper to generate mark columns
    const markColumn = (field, label, max = 10) => ({
        field,
        headerName: label,
        flex: 0.6,
        sortable: false,
        renderCell: ({ value }) => (
            <MarkCell value={value} max={max} color={paletteFor[field]} />
        ),
    });

    const columns = [
        { field: "client_name", headerName: "Client", flex: 1 },
        { field: "client_phone_number", headerName: "Phone", flex: 1 },
        { field: "last_purchase_date", headerName: "Last Purchase", flex: 0.8 },
        { field: "last_purchase_cost", headerName: "Cost (€)", flex: 0.6 },
        { field: "last_purchase_type", headerName: "Type", flex: 0.8 },
        markColumn("like_to_engage", "Engage"),
        markColumn("like_to_purchase", "Purchase"),
        markColumn("like_to_churn", "Churn"),
        markColumn("ltv", "LTV", maxLtv || 1),
    ];

    return (
        <Paper sx={{ p: 3, mb: 4 }}>
            <Typography variant="h6" gutterBottom>
                Clients
            </Typography>

            <Box sx={{ height: 520 }}>
                <DataGrid
                    rows={rows}
                    columns={columns}
                    pageSize={10}
                    disableSelectionOnClick
                    onRowClick={handleRowClick}
                    sx={{
                        border: 0,
                        "& .MuiDataGrid-columnHeaders": {
                            background: theme.palette.grey[100],
                            fontWeight: 600,
                            position: "sticky",
                            top: 0,
                            zIndex: 1,
                        },
                        "& .MuiDataGrid-cell": { py: 1 },
                        "& .MuiDataGrid-row:hover": {
                            background: theme.palette.action.hover,
                            cursor: "pointer",
                        },
                    }}
                />
            </Box>

            <ClientDetailsDialog
                open={Boolean(selected)}
                client={selected}
                onClose={() => setSelected(null)}
            />
        </Paper>
    );
}
