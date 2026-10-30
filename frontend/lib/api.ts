/**
 * Typed API client for the Django backend.
 *
 * Session + CSRF flow:
 *   1. Before any state-changing request, call `ensureCsrf()` — this
 *      fetches /api/auth/csrf/ which sets the `csrftoken` cookie.
 *   2. Every POST/PATCH/DELETE must include the `X-CSRFToken` header
 *      whose value equals the `csrftoken` cookie. Django rejects the
 *      request otherwise with 403.
 *   3. All requests send `credentials: "include"` so the browser
 *      attaches `sessionid` and `csrftoken` cookies.
 *
 * Because this client is imported by both Server and Client Components,
 * we keep everything browser-safe: no direct `document.cookie` access
 * outside functions that only run in the browser.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

// ---------------------------------------------------------------------------
// Domain types — mirror the DRF serializers
// ---------------------------------------------------------------------------

export type Role = "student" | "supervisor" | "admin";

export type User = {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: Role;
  department: string;
};

export type ThesisStatus =
  | "proposal" | "in_progress" | "under_review"
  | "revisions" | "approved" | "defended" | "archived";

export type ChapterStatus =
  | "draft" | "submitted" | "under_review" | "revisions" | "approved";

export type Comment = {
  id: number;
  chapter: number;
  author: User;
  body: string;
  created_at: string;
};

export type Chapter = {
  id: number;
  thesis: number;
  number: number;
  title: string;
  content: string;
  document: string | null;
  status: ChapterStatus;
  status_display: string;
  comments: Comment[];
  submitted_at: string;
  updated_at: string;
};

export type Thesis = {
  id: number;
  title: string;
  abstract: string;
  department: string;
  status: ThesisStatus;
  status_display: string;
  student: User;
  supervisor: User | null;
  chapters: Chapter[];
  submitted_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// CSRF helper — browser only
// ---------------------------------------------------------------------------

/** Read a cookie value by name. Safe no-op on the server. */
function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Ensures a valid CSRF token is available.
 *
 * Strategy:
 *   1. If a token is already cached in memory, return it.
 *   2. Otherwise, fetch /api/auth/csrf/ and read the token from the
 *      response body — NOT from document.cookie.
 *
 * Reading from the response body is more robust than reading the cookie:
 * it works even if the browser restricts cookie exposure (HttpOnly,
 * SameSite, cross-site), which is exactly the situation with the
 * Next.js (:3000) ↔ Django (:8000) dev split.
 */
let cachedCsrfToken: string | null = null;

export async function ensureCsrf(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;

  const res = await fetch(`${API_URL}/auth/csrf/`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch CSRF token (HTTP ${res.status}).`);
  }

  const data: { csrfToken?: string } = await res.json();
  if (!data.csrfToken) {
    throw new Error("Backend did not return a CSRF token.");
  }

  cachedCsrfToken = data.csrfToken;
  return cachedCsrfToken;
}

// ---------------------------------------------------------------------------
// Low-level request helper
// ---------------------------------------------------------------------------

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** Set true for state-changing verbs so we include the CSRF header. */
  csrf?: boolean;
  headers?: Record<string, string>; // Updates the type to explicitly allow a Cookie header
};

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  if (opts.body !== undefined) headers.set("Content-Type", "application/json");
  if (opts.csrf) headers.set("X-CSRFToken", await ensureCsrf());

  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers,
    credentials: "include",
    cache:"no-store",
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    // Try to surface DRF's structured errors; fall back to raw text.
    let detail = `API ${res.status}`;
    try {
      const data = await res.json();
      detail = data.detail ?? JSON.stringify(data);
    } catch {
      /* ignore — non-JSON error body */
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Structured error so callers can branch on status code. */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

// ---------------------------------------------------------------------------
// Auth endpoints
// ---------------------------------------------------------------------------

export const auth = {
  login: (username: string, password: string) =>
    request<User>("/auth/login/", {
      method: "POST",
      body: { username, password },
      csrf: true,
    }),

  logout: () =>
    request<{ detail: string }>("/auth/logout/", {
      method: "POST",
      csrf: true,
    }),
 // Allow passing headers (like cookies) from Server Components
  me: (headers?: Record<string, string>) => request<User>("/me/", {headers}),
};

// ---------------------------------------------------------------------------
// Domain endpoints
// ---------------------------------------------------------------------------

export const thesesApi = {
  list: (headers?: Record<string, string>) => 
    request<{ results: Thesis[]; count: number }>("/theses/", { headers }),
  retrieve: (id: number) => request<Thesis>(`/theses/${id}/`),
  setStatus: (id: number, status: ThesisStatus) =>
    request<Thesis>(`/theses/${id}/set-status/`, {
      method: "POST",
      body: { status },
      csrf: true,
    }),
};

export const commentsApi = {
  create: (chapterId: number, body: string) =>
    request<Comment>("/comments/", {
      method: "POST",
      body: { chapter: chapterId, body },
      csrf: true,
    }),
};