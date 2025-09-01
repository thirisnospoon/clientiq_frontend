// src/api/whatsapp.js
import { requireAuth } from "../utils/auth.js";

/**
 * Base path for WhatsApp messaging API.
 * Uses relative URLs so it works across environments.
 */
const API_BASE = "https://clientiq.apltravel.ua/api/messaging/whatsapp";

/**
 * Internal helper: authenticated fetch that returns parsed JSON.
 * - Attaches Bearer token
 * - Handles 401 (clears storage and redirects to /login)
 * - Throws Error on non-OK responses with best-effort message
 */
async function apiFetchJson(path, { method = "GET", headers = {}, body, params } = {}) {
    const token = requireAuth();
    const finalHeaders = {
        Authorization: `Bearer ${token}`,
        ...headers,
    };

    // Build URL with query params (if any)
    let url = `${API_BASE}${path}`;
    if (params && Object.keys(params).length > 0) {
        const qs = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== null) qs.append(k, v);
        }
        url += `?${qs.toString()}`;
    }

    const res = await fetch(url, { method, headers: finalHeaders, body });

    if (res.status === 401) {
        localStorage.clear();
        window.location.href = "/login";
        return; // stop further processing
    }

    // Try to parse JSON; fall back to text if needed
    const contentType = res.headers.get("content-type") || "";
    let data;
    if (contentType.includes("application/json")) {
        data = await res.json();
    } else {
        const text = await res.text();
        try { data = JSON.parse(text); } catch { data = { raw: text }; }
    }

    if (!res.ok) {
        const msg =
            data?.error?.message ||
            data?.message ||
            `HTTP ${res.status} on ${path}`;
        throw new Error(msg);
    }

    return data;
}

/** Check WhatsApp API health */
export async function checkWhatsappHealth() {
    return apiFetchJson("/health");
}

/**
 * Send WhatsApp template message
 * @param {{ phone_number: string, template_name: string, template_params: string[] }} payload
 * @returns {Promise<{external_message_id?: string, message_id?: string, status?: string, success?: boolean}>}
 */
export async function sendWhatsappTemplate({ phone_number, template_name, template_params }) {
    return apiFetchJson("/send-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number, template_name, template_params }),
    });
}

/**
 * Get messaging statistics
 * @param {Object} params Optional query params (e.g. { limit, offset })
 */
export async function fetchWhatsappStatistics(params = {}) {
    return apiFetchJson("/statistics", { params });
}

/** Get list of available WhatsApp templates */
export async function fetchWhatsappTemplates() {
    return apiFetchJson("/templates");
}

/** Get details for a specific WhatsApp template */
export async function fetchWhatsappTemplateDetails(templateName) {
    const safe = encodeURIComponent(templateName);
    return apiFetchJson(`/templates/${safe}`);
}

/** Get phone-level webhook config (360dialog) */
export async function fetchWhatsappWebhookConfig() {
    return apiFetchJson("/webhook-config");
}

/** Get WABA-level webhook config (360dialog) */
export async function fetchWhatsappWabaWebhookConfig() {
    return apiFetchJson("/waba-webhook-config");
}
