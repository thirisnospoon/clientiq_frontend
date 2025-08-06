import dayjs from "dayjs";

export function getAccessToken() {
    const token    = localStorage.getItem("access_token");
    const expires  = localStorage.getItem("token_expires");
    if (!token || !expires) return null;
    if (dayjs().isAfter(dayjs(expires))) {
        // Token expired – clean up and force re‑login
        localStorage.removeItem("access_token");
        localStorage.removeItem("token_expires");
        localStorage.removeItem("current_user");
        return null;
    }
    return token;
}

export function requireAuth() {
    const token = getAccessToken();
    if (!token) {
        window.location.href = "/login";   // adjust route if needed
        throw new Error("Unauthenticated – redirecting to login");
    }
    return token;
}
