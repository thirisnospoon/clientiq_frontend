// ------------------- api/summary.js -------------------
import { requireAuth } from "../utils/auth.js";

const BASE = "https://clientiq.apltravel.ua/api/admin/dashboard-summary";

export async function fetchDashboardSummary(start, end) {
    const token   = requireAuth();
    const headers = { Authorization: `Bearer ${token}` };

    const qs = new URLSearchParams();
    if (start) qs.append("start_date", start);
    if (end)   qs.append("end_date",   end);

    const res = await fetch(`${BASE}?${qs}`, { headers });

    if (res.status === 401) { localStorage.clear(); window.location.href = "/login"; }
    if (!res.ok) throw new Error("Summary API " + res.status);

    return await res.json();          // { total_clients, like_to_engage, … }
}
