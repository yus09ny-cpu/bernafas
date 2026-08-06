// Single source of truth for the backend this front-end talks to. Bernafas
// has NO backend of its own — it calls the existing Audit Jiwa API/DB, just
// pointed at via env var instead of hardcoded, so this repo never needs to
// know (or leak) the madrasahiam.com/auditjiwa domain in source.
//
// Set VITE_API_BASE_URL in .env.local during development, and as a Vercel
// project env var in production — see .env.example.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export function apiUrl(path: string): string {
  if (!API_BASE_URL) {
    console.warn('[env] VITE_API_BASE_URL is not set — API calls will hit relative paths only.')
  }
  return `${API_BASE_URL}${path}`
}
