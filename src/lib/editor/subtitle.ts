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
import type { Endpoint, ExpressionDuration, Task } from '../types/zigflow';

/**
 * One-line node subtitles for the canvas (DESIGN.md §6). A *view model*: pure,
 * i18n-free, and unit-testable. It extracts the display *values* from a task and
 * names which message to render; the component wraps each in the i18n library so
 * the actual copy stays out of the domain layer.
 *
 * The `key` matches a `subtitle_<key>` message; a component maps it to the
 * corresponding Paraglide message function with these params.
 */
export type SubtitleDescriptor =
  | { key: 'call_http'; method: string; endpoint: string }
  | { key: 'call_activity'; name: string }
  | { key: 'call_grpc'; method: string }
  | { key: 'wait'; duration: string }
  | { key: 'wait_until'; time: string }
  | { key: 'for'; collection: string }
  | { key: 'fork'; count: number }
  | { key: 'switch'; count: number }
  | { key: 'do'; count: number }
  | { key: 'try' }
  | { key: 'none' };

const DURATION_UNITS: ReadonlyArray<[keyof ExpressionDuration, string]> = [
  ['days', 'd'],
  ['hours', 'h'],
  ['minutes', 'm'],
  ['seconds', 's'],
  ['milliseconds', 'ms'],
];

/** Compact a duration into e.g. `1h 30m`; a runtime expression is shown verbatim. */
function formatDuration(duration: ExpressionDuration): string {
  const parts: string[] = [];
  for (const [field, unit] of DURATION_UNITS) {
    const value = duration[field];
    if (value !== undefined) {
      parts.push(`${value}${unit}`);
    }
  }
  return parts.join(' ');
}

/** Reduce an endpoint (string, URI object, or expression) to a display string. */
export function endpointText(endpoint: Endpoint): string {
  if (typeof endpoint === 'string') {
    return endpoint;
  }
  return typeof endpoint.uri === 'string' ? endpoint.uri : '';
}

/**
 * Describe a task's subtitle. Kinds without a distinctive one-liner (`set`,
 * `raise`, `listen`, `run`) return `{ key: 'none' }`; the card then shows only
 * its name and kind. `for` is checked before `do` because a `for` task carries
 * both keys (DESIGN.md §3).
 */
export function taskSubtitle(task: Task): SubtitleDescriptor {
  if ('call' in task) {
    if (task.call === 'http') {
      return {
        key: 'call_http',
        method: task.with.method,
        endpoint: endpointText(task.with.endpoint),
      };
    }
    if (task.call === 'activity') {
      return { key: 'call_activity', name: task.with.name };
    }
    return { key: 'call_grpc', method: task.with.method };
  }
  if ('wait' in task) {
    if ('until' in task.wait) {
      return { key: 'wait_until', time: String(task.wait.until) };
    }
    return { key: 'wait', duration: formatDuration(task.wait) };
  }
  if ('for' in task) {
    return { key: 'for', collection: task.for.in };
  }
  if ('fork' in task) {
    return { key: 'fork', count: task.fork.branches.length };
  }
  if ('switch' in task) {
    return { key: 'switch', count: task.switch.length };
  }
  if ('try' in task) {
    return { key: 'try' };
  }
  if ('do' in task) {
    return { key: 'do', count: task.do.length };
  }
  return { key: 'none' };
}
