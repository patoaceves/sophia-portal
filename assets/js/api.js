// SOPHIA Portal — API wrapper for Edge Function calls
// Automatically attaches JWT, parses JSON, throws on errors.

import { supabase, SUPABASE_URL } from "./supabase-client.js";

/**
 * Calls a Supabase Edge Function.
 *
 * @param {string} fnName
 * @param {object} opts
 * @param {"GET"|"POST"|"PATCH"|"DELETE"} [opts.method]
 * @param {object} [opts.body]
 * @param {Record<string,string>} [opts.query]
 * @param {Record<string,string>} [opts.headers]
 * @returns {Promise<{data: any, status: number}>}
 */
export async function callEdge(fnName, opts = {}) {
  const method = opts.method ?? "GET";
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) {
    throw new ApiError("Not authenticated", 401);
  }

  const url = new URL(`/functions/v1/${fnName}`, SUPABASE_URL);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    ...opts.headers,
  };
  let body;
  if (opts.body !== undefined && method !== "GET") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(url, { method, headers, body });
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!res.ok) {
    const msg = data?.error ?? `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, data);
  }

  return { data, status: res.status };
}

export class ApiError extends Error {
  constructor(message, status = 500, payload = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}
