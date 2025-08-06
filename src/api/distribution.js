// ------------------- api/distribution.js -------------------
import { requireAuth } from "../utils/auth.js";

const BASE = "http://176.36.152.27:8085/api/admin/distribution";

export async function fetchDistribution(start, end) {
    const token   = requireAuth();
    const headers = { Authorization: `Bearer ${token}` };

    const qs = new URLSearchParams();
    if (start) qs.append("start_date", start);
    if (end)   qs.append("end_date",   end);

    const res = await fetch(`${BASE}?${qs}`, { headers });

    if (res.status === 401) { localStorage.clear(); window.location.href = "/login"; }
    if (!res.ok) throw new Error("Distribution API " + res.status);

    return await res.json();          // { distributions, ...counts }
}
