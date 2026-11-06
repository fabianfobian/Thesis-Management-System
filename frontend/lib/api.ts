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

export type ChapterVersion = {
  id: number;
  version_number: number;
  document: string;
  document_url: string;
  uploaded_at: string;
};

export type Chapter = {
  id: number;
  thesis: number;
  number: number;
  title: string;
  content: string;
  versions: ChapterVersion[];
  document: string | null;
  document_url: string | null;
  status: ChapterStatus;
  status_display: string;
  comments: Comment[];
  submitted_at: string;
  updated_at: string;
  plagiarism_score: number | null;
  plagiarism_status: "pending" | "checking" | "checked" | "failed";
  plagiarism_report: any | null;
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
  co_supervisor: User | null;
  third_reader: User | null;
  chapters: Chapter[];
  submitted_at: string;
  updated_at: string;
};

export type Notification = {
  id: number;
  message: string;
  link: string;
  is_read: boolean;
  created_at: string;
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

/**
 * Ensures a valid CSRF token is available by fetching it directly from Django.
 * 
 * We do NOT cache this in memory, because the browser's underlying `csrftoken` 
 * cookie can rotate (e.g., after login/logout). Fetching it fresh ensures the 
 * header always matches the cookie Django expects.
 */


export async function ensureCsrf(): Promise<string> {
  const res = await fetch(`${API_URL}/auth/csrf/`, {
    credentials: "include",
    cache: "no-store",
  });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch CSRF token (HTTP ${res.status}).`);
  }

  const data: { csrfToken?: string } = await res.json();
  if (!data.csrfToken) {
    throw new Error("Backend did not return a CSRF token.");
  }

  return data.csrfToken;
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
  retrieve: (id: number, headers?: Record<string, string>) => 
    request<Thesis>(`/theses/${id}/`,{headers}),
  
  setStatus: (id: number, status: ThesisStatus) =>
    request<Thesis>(`/theses/${id}/set-status/`, {
      method: "POST",
      body: { status },
      csrf: true,
    }),

    
  uploadVersion: async (chapterId: number, file: File) => {
    const formData = new FormData();
    formData.append("document", file);

    const token = await ensureCsrf();
    const res = await fetch(`${API_URL}/chapters/${chapterId}/upload-version/`, {
      method: "POST",
      headers: {
        "X-CSRFToken": token,
        // Note: Do NOT set Content-Type here. The browser sets it automatically
        // to multipart/form-data with the correct boundary.
      },
      credentials: "include",
      body: formData,
    });

    if (!res.ok) {
      // Safely try to parse JSON, fall back to text if it's HTML
      let errorMessage = "Upload failed";
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        errorMessage = data.detail || errorMessage;
      } catch {
        // If it's a 404/500, it usually means the URL is wrong or the server crashed
        console.error("Server returned HTML error:", text.substring(0, 200));
        errorMessage = `Server error (${res.status}). Check Django console.`;
      }
      throw new ApiError(res.status, errorMessage);
    }
    return res.json() as Promise<ChapterVersion>;
  },

  checkPlagiarism: (chapterId: number, text: string) =>
    request<Chapter>(`/chapters/${chapterId}/check-plagiarism/`, {
      method: "POST",
      body: { text },
      csrf: true,
    }),

  createProposal: (data: { title: string; abstract: string; department: string }) =>
    request<Thesis>("/theses/", {
      method: "POST",
      body: data,
      csrf: true,
    }),

  assignCommittee: (id: number, data: { supervisor_id?: number, co_supervisor_id?: number, third_reader_id?: number }) =>
    request<Thesis>(`/theses/${id}/assign-committee/`, {
      method: "POST",
      body: data,
      csrf: true,
    }),
};

// Create a new API object
export const usersApi = {
  listSupervisors: (headers?: Record<string, string>) =>
    request<{ results: User[] }>("/users/", { headers }),
};

export const commentsApi = {
  create: async (chapterId: number, body: string) => {
    return request<Comment>("/comments/", {
      method: "POST",
      body: { chapter: chapterId, body },
      csrf: true, // Handles the CSRF token
    });
  },
};

export const notificationsApi = {
  list: (headers?: Record<string, string>) => 
    request<{ results: Notification[]; count: number }>("/notifications/", { headers }),
    
  markAllRead: () =>
    request<{ status: string }>("/notifications/mark-all-read/", {
      method: "PATCH",
      csrf: true,
    }),
};
