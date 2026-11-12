const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
// Production API requests use the same Vercel origin so the httpOnly session cookie is retained.
const developmentApiUrl = configuredApiUrl || "http://localhost:5000/api";
const normalizedDevelopmentApiUrl = developmentApiUrl.endsWith("/")
  ? developmentApiUrl.slice(0, -1)
  : developmentApiUrl;
const API = import.meta.env.DEV ? normalizedDevelopmentApiUrl : "/api";

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
