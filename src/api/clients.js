// ------------------- api/clients.js -------------------
import { requireAuth } from "../utils/auth.js";

const BASE = "http://176.36.152.27:8085/api/admin/clients";

/**
 * Завантажити ВСІ сторінки клієнтів із фільтрацією за датою.
 *
 * @param {string} [start] YYYY-MM-DD
 * @param {string} [end]   YYYY-MM-DD
 */
export async function fetchAllClients(start, end, perPage = 100) {
    const token   = requireAuth();
    const headers = { Authorization: `Bearer ${token}` };

    const qsBase = new URLSearchParams();
    if (start) qsBase.append("start_date", start);
    if (end)   qsBase.append("end_date",   end);
    qsBase.append("per_page", perPage);

    let page   = 1;
    let pages  = 1;
    const list = [];

    while (page <= pages) {
        const qs = new URLSearchParams(qsBase);
        qs.append("page", page);

        const res = await fetch(`${BASE}?${qs}`, { headers });

        if (res.status === 401) {         // токен прострочений
            localStorage.clear();
            window.location.href = "/login";
            return;
        }
        if (!res.ok) throw new Error("Clients API " + res.status);

        const { pages: totalPages, clients } = await res.json();
        pages = totalPages;
        list.push(...clients);
        page += 1;
    }
    return list;
}
