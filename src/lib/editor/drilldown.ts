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
import type { ScopeField, TaskKind } from '../graph/model';

/**
 * Which nested `TaskList` clicking a node drills into (DESIGN.md §3). Only the
 * four container kinds have a sub-canvas; every other kind (including `switch`,
 * which branches by goto rather than nesting) returns `null`.
 *
 * `try` maps to its `try` body only. Its `catch.do` is a second child list that
 * needs its own drill-in affordance (a toggle or a second crumb) — deferred until
 * editing lands, since this read-only step has nowhere to surface the choice.
 */
export function containerField(kind: TaskKind): ScopeField | null {
  switch (kind) {
    case 'do':
    case 'for':
      return 'do';
    case 'fork':
      return 'branches';
    case 'try':
      return 'try';
    default:
      return null;
  }
}

/** Whether a node of this kind can be drilled into for a sub-canvas. */
export function isContainerKind(kind: TaskKind): boolean {
  return containerField(kind) !== null;
}
