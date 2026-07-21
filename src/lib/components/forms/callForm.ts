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
import type { CallTask } from '$lib/types/zigflow';

/**
 * The call-wrapper logic for `CallForm.svelte` (DESIGN.md §6). `CallForm` picks a
 * sub-form by call type — HTTP has a dedicated form (`CallHttpForm`), gRPC and
 * Activity fall back to the read-only JSON view for now (§8). This module owns
 * the type list and the type-switch transform; the HTTP form ↔ task mapping
 * lives in `callHttpForm.ts`.
 */

/** The three `call` sub-types (the schema's `call` discriminant values). */
export const CALL_TYPES = ['http', 'grpc', 'activity'] as const;
export type CallType = (typeof CALL_TYPES)[number];

/**
 * Switch a call task to a different call type, changing **only** `call` + `with`
 * — every TaskBase field (`if`/`then`/`input`/`output`/`export`/`metadata`)
 * rides through the spread untouched. `cachedWith` is the caller's
 * previously-stashed `with` for `next` (so a type round-trip restores prior
 * data); with none, a minimal default for that type is used.
 */
export function switchCallType(
  task: CallTask,
  next: CallType,
  cachedWith: unknown,
): CallTask {
  // The resulting `with` matches `next`'s shape by construction (a cached prior,
  // or the per-type default); the union can't express that, hence the assertion.
  return {
    ...task,
    call: next,
    with: cachedWith ?? defaultWith(next),
  } as CallTask;
}

/** Minimal `with` for a freshly-switched call type with no cached prior. */
function defaultWith(type: CallType): unknown {
  switch (type) {
    case 'http':
      // Matches the palette's new-call default (`createDefaultTask`, §6).
      return { method: 'GET', endpoint: { uri: 'https://example.com' } };
    case 'grpc':
    case 'activity':
      // No dedicated form yet (shown read-only via JsonFallbackForm); start
      // empty and let the Save validator prompt for the required fields (§8).
      return {};
    default: {
      const unreachable: never = type;
      throw new Error(`Unhandled call type: ${String(unreachable)}`);
    }
  }
}
