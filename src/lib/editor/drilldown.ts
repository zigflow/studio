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
 *
 * This is the single source of truth for "which kinds are openable" (see
 * {@link isContainerKind}) and "which field they open" — the inspector's Open
 * button(s) and the canvas double-click both drill through it. The switch is
 * **exhaustive over every {@link TaskKind}** on purpose: a kind added to
 * `TASK_KINDS` fails to compile here (the `never` guard) until it is classified
 * as a container with its field or as explicitly non-nesting, so a new kind
 * cannot silently miss drill-in/Open/double-click support.
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
    case 'call':
    case 'listen':
    case 'raise':
    case 'run':
    case 'set':
    case 'switch':
    case 'wait':
      return null;
    default: {
      const unreachable: never = kind;
      throw new Error(`Unhandled task kind: ${String(unreachable)}`);
    }
  }
}

/** Whether a node of this kind can be drilled into for a sub-canvas. */
export function isContainerKind(kind: TaskKind): boolean {
  return containerField(kind) !== null;
}
