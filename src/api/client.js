import { requireAuth } from "../utils/auth.js";

const BASE = "https://clientiq.apltravel.ua/api/admin/clients";

/**
 * Завантажити повну інформацію про клієнта.
 * @param {string} id  UUID
 * @returns {Promise<object>}
 */
export async function fetchClient(id) {
    const token   = requireAuth();
    const headers = { Authorization: `Bearer ${token}` };

    const res = await fetch(`${BASE}/${id}`, { headers });

    if (res.status === 401) {           // токен прострочився
        localStorage.clear();
        window.location.href = "/login";
    }
    if (!res.ok) throw new Error("Client API " + res.status);

    return res.json();
}