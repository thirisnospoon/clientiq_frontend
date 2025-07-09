import React, { useMemo, useState } from "react";
import {
    Paper,
    Typography,
    Box,
    LinearProgress,
    useTheme,
    useMediaQuery,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import ClientDetailsDialog from "./ClientDetailsDialog";

/* progress–cell: fills entire cell, shows bar normally, fades to number on hover */
const MarkCell = ({ value, max, color }) => {
    const perc = max > 0 ? (value / max) * 100 : 0;

    return (
        <Box
            sx={{
                width: "100%",
                height: "100%",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",

                /* fade out bar, fade in label when hovering anywhere in the cell */
                "&:hover .progress": { opacity: 0 },
                "&:hover .label":    { opacity: 1 },
            }}
        >
            <LinearProgress
                className="progress"
                variant="determinate"
                value={perc}
                sx={{
                    position: "absolute",
                    top: "50%",
                    left: 0,
                    width: "100%",
                    height: 6,
                    transform: "translateY(-50%)",
                    borderRadius: 4,
                    transition: "opacity 0.2s",
                    "& .MuiLinearProgress-bar": { backgroundColor: color.main },
                }}
            />

            <Typography
                className="label"
                variant="body2"
                sx={{
                    zIndex: 1,
                    opacity: 0,
                    transition: "opacity 0.2s",
                }}
            >
                {value}
            </Typography>
        </Box>
    );
};

export default function ClientsTable({ clients, mobile }) {
    const theme     = useTheme();
    const isMobile  = mobile ?? useMediaQuery(theme.breakpoints.down("sm"));
    const [selected, setSelected] = useState(null);

    /* compute max LTV for 100% bar width */
    const maxLtv = useMemo(
        () => Math.max(0, ...clients.map((c) => c.marks?.ltv ?? 0)),
        [clients]
    );

    const paletteFor = {
        like_to_engage:   theme.palette.info,
        like_to_purchase: theme.palette.success,
        like_to_churn:    theme.palette.warning,
        ltv:              theme.palette.secondary,
    };

    const rows = clients.map((c, id) => ({
        id,
        client_name:          c.client_name,
        client_phone_number:  c.client_phone_number,
        last_purchase_date:   c.crm_data.last_purchase_date,
        last_purchase_cost:   c.crm_data.last_purchase_cost,
        last_purchase_type:   c.crm_data.last_purchase_type,
        ...c.marks,
        _raw: c,
    }));

    const handleRowClick = ({ row }) => setSelected(row._raw);

    const markCol = (field, label, max = 10) => ({
        field,
        headerName: label,
        width: 120,
        sortable: false,
        renderCell: (params) => (
            <MarkCell
                key={`${params.id}-${field}`}
                value={params.value}
                max={max}
                color={paletteFor[field]}
            />
        ),
    });

    const columns = [
        { field: "client_name",         headerName: "Client",        minWidth: 160, flex: 1 },
        { field: "client_phone_number", headerName: "Phone",         minWidth: 140 },
        { field: "last_purchase_date",  headerName: "Last Purchase", minWidth: 110 },
        { field: "last_purchase_cost",  headerName: "Cost (€)",      minWidth: 90  },
        { field: "last_purchase_type",  headerName: "Type",          minWidth: 110 },
        markCol("like_to_engage",   "Engage"),
        markCol("like_to_purchase", "Purchase"),
        markCol("like_to_churn",    "Churn"),
        markCol("ltv",              "LTV", maxLtv || 1),
    ];

    return (
        <Paper sx={{ p: isMobile ? 2 : 3, mb: 4 }}>
            <Typography variant="h6" gutterBottom>
                Clients
            </Typography>

            <Box sx={{ width: "100%", overflowX: "auto" }}>
                <Box sx={{ minWidth: 900 }}>
                    <DataGrid
                        autoHeight
                        rows={rows}
                        columns={columns}
                        pageSize={isMobile ? 5 : 10}
                        getRowHeight={() => (isMobile ? 44 : null)}
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
                            "& .MuiDataGrid-cell": {
                                py: isMobile ? 0.5 : 1,
                                whiteSpace: "nowrap",
                            },
                            "& .MuiDataGrid-row:hover": {
                                background: theme.palette.action.hover,
                                cursor: "pointer",
                            },
                        }}
                    />
                </Box>
            </Box>

            <ClientDetailsDialog
                open={Boolean(selected)}
                client={selected}
                onClose={() => setSelected(null)}
            />
        </Paper>
    );
}
