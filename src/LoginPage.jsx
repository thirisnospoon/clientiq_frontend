// ------------------- LoginPage.jsx -------------------
import React, { useState } from "react";
import {
    Container,
    Box,
    Paper,
    TextField,
    Button,
    Typography,
    Alert,
    CircularProgress,
    useTheme,
    useMediaQuery
} from "@mui/material";
import dayjs from "dayjs";

// 🔑 adjust if your FastAPI route differs
const AUTH_URL = "http://176.36.152.27:8085/api/auth/login";

export default function LoginPage() {
    const theme    = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const [form, setForm]       = useState({ username: "", password: "" });
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState(null);

    const handleChange = (e) =>
        setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const res = await fetch(AUTH_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form)
            });

            if (!res.ok) {
                const msg = res.status === 401 ? "Неправильний логін або пароль" : "Помилка під час авторизації";
                throw new Error(msg);
            }

            const data = await res.json();               // { access_token, expires_in, token_type, user }
            localStorage.setItem("access_token",  data.access_token);
            localStorage.setItem("token_expires", dayjs().add(data.expires_in, "second").toISOString());
            localStorage.setItem("current_user",  JSON.stringify(data.user));

            // 👉 redirect or lift state to a context / router
            window.location.href = "/";                  // change if using React Router
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container maxWidth="sm" sx={{ py: isMobile ? 3 : 6 }}>
            <Paper elevation={3} sx={{ p: isMobile ? 3 : 4 }}>
                <Typography variant="h5" mb={3} align="center" fontWeight={600}>
                    Client&nbsp;IQ – Login
                </Typography>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <Box component="form" onSubmit={handleSubmit}>
                    <TextField
                        label="Username"
                        name="username"
                        value={form.username}
                        onChange={handleChange}
                        fullWidth
                        required
                        margin="normal"
                    />

                    <TextField
                        label="Password"
                        name="password"
                        type="password"
                        value={form.password}
                        onChange={handleChange}
                        fullWidth
                        required
                        margin="normal"
                    />

                    <Button
                        type="submit"
                        variant="contained"
                        fullWidth
                        disabled={loading}
                        sx={{ mt: 2, py: 1.2 }}
                    >
                        {loading ? <CircularProgress size={24} /> : "Log in"}
                    </Button>
                </Box>
            </Paper>
        </Container>
    );
}
