/*
 * Copyright 2025 - 2026 Zigflow authors <https://github.com/zigflow/studio/graphs/contributors>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import type { ValidationError } from '../schema/validate';
import type { ZigflowWorkflow } from '../types/zigflow';

/**
 * Save round-trip logic (DESIGN.md §4/§5). Pure and framework-free so the
 * component stays a thin wrapper: it PUTs the in-memory workflow to the single
 * validation gate (`PUT /api/workflows/[name]`) and turns the response into a
 * structured {@link SaveResult}. The three outcomes are kept distinct on purpose
 * — a rejected-because-invalid save must never read as a failed request, and
 * vice versa. All user-facing strings live in the component, mapped from these
 * structural results.
 */

/** The outcome of a save attempt. */
export type SaveResult =
  /** 200: the server accepted and returned the saved (id-filled, type-synced) workflow. */
  | { kind: 'saved'; workflow: ZigflowWorkflow }
  /** 422: schema validation rejected it; `errors` are the exact schema failures. */
  | { kind: 'invalid'; errors: ValidationError[] }
  /** The request itself failed (couldn't reach server, unexpected status/body). */
  | {
      kind: 'error';
      reason: 'network' | 'server' | 'malformed';
      status?: number;
    };

/** A validation error prepared for display: its schema message plus a task hint. */
export interface SaveErrorDisplay {
  /** JSON Pointer into the document, e.g. `/document/dsl`. */
  path: string;
  /** The schema failure message from the server (already includes the path). */
  message: string;
  /** Nearest enclosing task/case name derived from the path, or null if none. */
  taskHint: string | null;
}

/** Canonical serialization used to compare in-memory state against last-saved. */
export function serializeWorkflow(workflow: ZigflowWorkflow): string {
  return JSON.stringify(workflow);
}

function unescapePointer(segment: string): string {
  // JSON Pointer escaping: ~1 => "/", ~0 => "~" (order matters).
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

/**
 * Derive the nearest task (or Switch case) name a JSON-Pointer error path points
 * inside. Task lists serialize as `[{ <name>: {...} }]`, so the segment right
 * after a numeric array index is always a task/case name; the *last* such segment
 * is the most specific task the error sits within. Returns null for
 * document-level or root errors (no task context).
 *
 * This is a deliberately cheap, string-only heuristic — no tree walk, no
 * navigation. Full click-to-locate is left for a later polish pass (see summary).
 */
export function taskHintFromPath(path: string): string | null {
  if (path === '' || path === '/') {
    return null;
  }
  const segments = path.split('/').slice(1).map(unescapePointer);
  let hint: string | null = null;
  for (let i = 0; i + 1 < segments.length; i += 1) {
    if (/^\d+$/.test(segments[i])) {
      hint = segments[i + 1];
    }
  }
  return hint;
}

/** Prepare 422 validation errors for display (adds a per-error task hint). */
export function toSaveErrorDisplays(
  errors: ValidationError[],
): SaveErrorDisplay[] {
  return errors.map((error) => ({
    path: error.path,
    message: error.message,
    taskHint: taskHintFromPath(error.path),
  }));
}

/** The minimal response shape this module needs (the real `Response` satisfies it). */
interface JsonResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

/**
 * Interpret a PUT response into a {@link SaveResult}. Separated from the fetch
 * call so it can be unit-tested with a stub response.
 */
export async function interpretSaveResponse(
  res: JsonResponse,
): Promise<SaveResult> {
  if (res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return { kind: 'error', reason: 'malformed', status: res.status };
    }
    if (body !== null && typeof body === 'object') {
      return { kind: 'saved', workflow: body as ZigflowWorkflow };
    }
    return { kind: 'error', reason: 'malformed', status: res.status };
  }

  if (res.status === 422) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return { kind: 'error', reason: 'malformed', status: 422 };
    }
    const errors = (body as { errors?: unknown }).errors;
    if (Array.isArray(errors)) {
      return { kind: 'invalid', errors: errors as ValidationError[] };
    }
    // 422 without a structured error list — treat as a server-side problem.
    return { kind: 'error', reason: 'server', status: 422 };
  }

  return { kind: 'error', reason: 'server', status: res.status };
}

/**
 * PUT the workflow to its save endpoint and interpret the result. A rejected
 * *promise* (offline, DNS, CORS, aborted) is the `network` error; a non-OK HTTP
 * response is a `server`/`invalid` result — the two never conflate.
 */
export async function saveWorkflow(
  name: string,
  workflow: ZigflowWorkflow,
  fetchFn: typeof fetch,
): Promise<SaveResult> {
  let res: Response;
  try {
    res = await fetchFn(`/api/workflows/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(workflow),
    });
  } catch {
    return { kind: 'error', reason: 'network' };
  }
  return interpretSaveResponse(res);
}
