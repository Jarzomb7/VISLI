const API = process.env.NEXT_PUBLIC_API_URL || "https://api.visli.pl";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("visli_token");
}

async function apiFetch<T = unknown>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...opts, headers, credentials: "include" });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("visli_token");
      window.location.href = "/auth/login";
    }
    throw new Error("Unauthorized");
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

// ── Auth ────────────────────────────────────────

export async function login(email: string, password: string) {
  const data = await apiFetch<{ token: string; user: { id: string; email: string; role: string } }>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) }
  );
  localStorage.setItem("visli_token", data.token);
  return data;
}

export function logout() {
  localStorage.removeItem("visli_token");
  window.location.href = "/auth/login";
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

// ── Stats ───────────────────────────────────────

export async function getStats() {
  return apiFetch<{
    totalUsers: number;
    totalLicenses: number;
    activeLicenses: number;
    suspendedLicenses: number;
    totalSmsUsed: number;
    activeSubscriptions: number;
    apiRequestsLast24h: number;
  }>("/api/admin/stats");
}

// ── Users ───────────────────────────────────────

export async function getUsers(page = 1, search = "") {
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (search) params.set("search", search);
  return apiFetch<{ users: any[]; pagination: any }>(`/api/admin/users?${params}`);
}

// ── Licenses ────────────────────────────────────

export async function getLicenses(page = 1, search = "", status = "") {
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  return apiFetch<{ licenses: any[]; pagination: any }>(`/api/admin/licenses?${params}`);
}

export async function updateLicense(id: string, body: Record<string, unknown>) {
  return apiFetch(`/api/admin/licenses/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// ── SMS ─────────────────────────────────────────

export async function updateSms(userId: string, body: Record<string, unknown>) {
  return apiFetch(`/api/admin/sms/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
