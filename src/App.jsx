// src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import dayjs from "dayjs";
import Dashboard from "./Dashboard.jsx";
import LoginPage from "./LoginPage.jsx";

// NEW
import WhatsappSendoutsPage from "./pages/WhatsappSendoutsPage.jsx";

/** Перевіряємо токен та строк придатності */
const isTokenValid = () => {
    const token = localStorage.getItem("access_token");
    const exp   = localStorage.getItem("token_expires");
    if (!token || !exp) return false;
    return dayjs().isBefore(dayjs(exp));
};

/** Обгортка для приватних сторінок */
function ProtectedRoute({ children }) {
    return isTokenValid() ? children : <Navigate to="/login" replace />;
}

export default function App() {
    return (
        <Routes>
            {/* Публічний маршрут логіну */}
            <Route path="/login" element={<LoginPage />} />

            {/* NEW: WhatsApp Sendouts (окрема сторінка) */}
            <Route
                path="/whatsapp"
                element={
                    <ProtectedRoute>
                        <WhatsappSendoutsPage />
                    </ProtectedRoute>
                }
            />

            {/* Усі інші шляхи захищені */}
            <Route
                path="/*"
                element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                }
            />
        </Routes>
    );
}
