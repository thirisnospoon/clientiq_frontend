import { createTheme } from "@mui/material/styles";

const theme = createTheme({
    palette: {
        mode: "light",
        primary: { main: "#1976d2" },
        success: { main: "#2e7d32" },
        warning: { main: "#ed6c02" },
        error: { main: "#d32f2f" }
    },
    typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif'
    }
});

export default theme;