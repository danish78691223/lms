const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
// Production traffic is routed through Vercel rewrites to keep auth cookies same-origin.
const API = import.meta.env.DEV
  ? (configuredApiUrl || "http://localhost:5000/api").replace(/\\/+$/, "")
  : "/api";

export async function api(path, options = {}) {
  const res = await fetch(API + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}
