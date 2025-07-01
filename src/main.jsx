import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import App from './App';

const theme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#673ab7' },      // Deep Purple
        secondary: { main: '#ff5722' },    // Deep Orange
        info: { main: '#0288d1' },         // Cyan
        success: { main: '#43a047' },      // Green
        warning: { main: '#a5b127' },      // Yellow
        error: { main: '#e53935' },        // Red
        background: { default: '#fafafa' },
    },
    shape: { borderRadius: 14 },
    typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    },
});

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <App />
        </ThemeProvider>
    </React.StrictMode>,
);