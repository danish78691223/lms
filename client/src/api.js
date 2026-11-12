const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const API = (configuredApiUrl || (import.meta.env.DEV ? "http://localhost:5000/api" : ""))
  .replace(/\/+$/, "");

export async function api(path, options = {}) {
  if (!API) {
    throw new Error("Backend API URL is not configured. Set VITE_API_URL in Vercel to your Render backend URL ending in /api, then redeploy.");
  }

  const res = await fetch(API + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}
