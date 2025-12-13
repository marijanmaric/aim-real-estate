const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

const defaultHeaders = {
  "Content-Type": "application/json",
};

const createError = (message, allowFallback = false) => ({
  ok: false,
  error: message,
  allowFallback,
});

const request = async (path, options = {}) => {
  if (!API_BASE_URL) {
    throw new Error("API base URL nicht gesetzt");
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: defaultHeaders,
    credentials: "include",
    ...options,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.message || `Request fehlgeschlagen (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
};

export const hasRemoteBackend = Boolean(API_BASE_URL);

export async function registerUser(payload) {
  if (!hasRemoteBackend) {
    return createError("Kein Remote-Backend konfiguriert", true);
  }
  try {
    const data = await request("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return {
      ok: true,
      profile: data?.profile || null,
      requiresVerification: data?.requiresVerification ?? false,
    };
  } catch (error) {
    const allowFallback = !error.status;
    return createError(error.message || "Registrierung fehlgeschlagen", allowFallback);
  }
}

export async function loginUser(payload) {
  if (!hasRemoteBackend) {
    return createError("Kein Remote-Backend konfiguriert", true);
  }
  try {
    const data = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return { ok: true, profile: data?.profile || null };
  } catch (error) {
    const allowFallback = !error.status;
    return createError(error.message || "Anmeldung fehlgeschlagen", allowFallback);
  }
}

export async function requestPasswordReset(email) {
  if (!hasRemoteBackend) {
    return createError("Kein Remote-Backend konfiguriert", true);
  }
  try {
    await request("/auth/password/request", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    return { ok: true };
  } catch (error) {
    const allowFallback = !error.status;
    return createError(error.message || "Zurücksetzen fehlgeschlagen", allowFallback);
  }
}

export async function confirmPasswordReset(payload) {
  if (!hasRemoteBackend) {
    return createError("Kein Remote-Backend konfiguriert", true);
  }
  try {
    await request("/auth/password/confirm", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return { ok: true };
  } catch (error) {
    const allowFallback = !error.status;
    return createError(error.message || "Code ungültig", allowFallback);
  }
}

export async function submitRenovationRequest(requestPayload) {
  if (!hasRemoteBackend) {
    return createError("Kein Remote-Backend konfiguriert", true);
  }
  try {
    const data = await request("/renovations", {
      method: "POST",
      body: JSON.stringify(requestPayload),
    });
    return { ok: true, data };
  } catch (error) {
    const allowFallback = !error.status;
    return createError(error.message || "Speichern fehlgeschlagen", allowFallback);
  }
}

export async function updateRenovationRequest(id, updates) {
  if (!hasRemoteBackend) {
    return createError("Kein Remote-Backend konfiguriert", true);
  }
  try {
    const data = await request(`/renovations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    return { ok: true, data };
  } catch (error) {
    const allowFallback = !error.status;
    return createError(error.message || "Aktualisierung fehlgeschlagen", allowFallback);
  }
}
