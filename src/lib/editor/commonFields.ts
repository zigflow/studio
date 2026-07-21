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
import type {
  Duration,
  Export,
  Input,
  Output,
  Schema,
  TaskBase,
  TaskMetadata,
} from '../types/zigflow';
import {
  durationField,
  formatJson,
  formatSetValue,
  isEmptyObject,
  parseDurationField,
  parseJsonField,
  parseSetValue,
} from './formValues';

/**
 * The common `TaskBase` fields shared by *every* task kind (DESIGN.md §6):
 * `if`/`input`/`output`/`export`/`then`/`metadata`. These read/write helpers
 * edit those shared fields in addition to a kind's own form, preserving anything
 * the editor doesn't surface (notably `metadata.__zigflow_id`, §2.3, and
 * non-string metadata entries). Correctly centralized — not "yet another kind."
 */

/** A plaintext key/value pair (used by the metadata list; see `writeMetadata`). */
export interface SetEntry {
  key: string;
  value: string;
}

export interface DurationForm {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  milliseconds: string;
}

export interface CommonFieldsForm {
  /** `task.if` — a runtime expression guard. */
  if: string;
  /** JSON text for `input.schema`. */
  inputSchema: string;
  /** `output.as` — a jq expression string or an object (string-vs-object, like `set`). */
  outputAs: string;
  /** JSON text for `output.schema`. */
  outputSchema: string;
  exportAs: string;
  exportSchema: string;
  /** `metadata.heartbeat` — a Duration (integers only, per the schema). */
  heartbeat: DurationForm;
  /** Other `metadata` entries as plaintext string key/values (excludes id/heartbeat). */
  metadata: SetEntry[];
}

/**
 * The `then` options for a task-level `then` or a switch case: the three flow
 * directives, then this scope's sibling task names. One central place for these
 * (DESIGN.md §7), used identically by any task's own `then` (below) and by
 * Switch cases (`switchForm.ts`'s component).
 */
export function thenOptions(siblingNames: string[]): string[] {
  return ['continue', 'exit', 'end', ...siblingNames];
}

const EMPTY_DURATION_FORM: DurationForm = {
  days: '',
  hours: '',
  minutes: '',
  seconds: '',
  milliseconds: '',
};

function readDurationForm(duration: Duration | undefined): DurationForm {
  if (!duration) {
    return { ...EMPTY_DURATION_FORM };
  }
  return {
    days: durationField(duration.days),
    hours: durationField(duration.hours),
    minutes: durationField(duration.minutes),
    seconds: durationField(duration.seconds),
    milliseconds: durationField(duration.milliseconds),
  };
}

/**
 * Build a `Duration` from the heartbeat form. Only integer values are kept — the
 * schema's duration fields are integer-only (unlike `wait`'s expression-capable
 * durations), so an expression typed here is dropped rather than stored invalid.
 */
function buildIntegerDuration(form: DurationForm): Duration | undefined {
  const duration: Duration = {};
  const fields: ReadonlyArray<[keyof Duration, string]> = [
    ['days', form.days],
    ['hours', form.hours],
    ['minutes', form.minutes],
    ['seconds', form.seconds],
    ['milliseconds', form.milliseconds],
  ];
  for (const [field, raw] of fields) {
    const parsed = parseDurationField(raw);
    if (typeof parsed === 'number') {
      duration[field] = parsed;
    }
  }
  return Object.keys(duration).length > 0 ? duration : undefined;
}

/** Apply schema JSON to a container: blank removes it; invalid keeps the prior value. */
function applySchema(
  next: { schema?: Schema },
  raw: string,
  prior: Schema | undefined,
): void {
  const parsed = parseJsonField(raw);
  if (!parsed.valid) {
    // Don't lose the last valid schema while the user is mid-edit with bad JSON.
    if (prior !== undefined) {
      next.schema = prior;
    } else {
      delete next.schema;
    }
    return;
  }
  if (parsed.value === undefined) {
    delete next.schema;
  } else {
    // A fallback JSON field — the parsed value is the embedded schema document.
    next.schema = parsed.value as Schema;
  }
}

/** Set/clear an `as` field, reusing the `set`-value string-vs-object parse. */
function applyAs(
  next: { as?: string | Record<string, unknown> },
  raw: string,
): void {
  if (raw.trim() === '') {
    delete next.as;
  } else {
    next.as = parseSetValue(raw) as string | Record<string, unknown>;
  }
}

export function readCommonFields(task: TaskBase): CommonFieldsForm {
  return {
    if: task.if ?? '',
    inputSchema: formatJson(task.input?.schema),
    outputAs:
      task.output?.as === undefined ? '' : formatSetValue(task.output.as),
    outputSchema: formatJson(task.output?.schema),
    exportAs:
      task.export?.as === undefined ? '' : formatSetValue(task.export.as),
    exportSchema: formatJson(task.export?.schema),
    heartbeat: readDurationForm(task.metadata?.heartbeat),
    metadata: readMetadataEntries(task.metadata),
  };
}

/** Metadata entries the generic key/value list manages: string values, minus id/heartbeat. */
export function readMetadataEntries(
  metadata: TaskMetadata | undefined,
): SetEntry[] {
  if (!metadata) {
    return [];
  }
  return Object.entries(metadata)
    .filter(
      ([key, value]) =>
        key !== '__zigflow_id' &&
        key !== 'heartbeat' &&
        typeof value === 'string',
    )
    .map(([key, value]) => ({ key, value: value as string }));
}

export function writeMetadata(
  prior: TaskMetadata | undefined,
  heartbeat: DurationForm,
  entries: SetEntry[],
): TaskMetadata | undefined {
  const next: TaskMetadata = { ...(prior ?? {}) };
  // Drop the string-valued keys this editor manages; they're re-added from
  // `entries`. `__zigflow_id` (§2.3) and any non-string entries stay untouched.
  for (const [key, value] of Object.entries(prior ?? {})) {
    if (
      key !== '__zigflow_id' &&
      key !== 'heartbeat' &&
      typeof value === 'string'
    ) {
      delete next[key];
    }
  }
  for (const { key, value } of entries) {
    const trimmed = key.trim();
    if (
      trimmed === '' ||
      trimmed === '__zigflow_id' ||
      trimmed === 'heartbeat'
    ) {
      continue;
    }
    next[trimmed] = value;
  }
  const built = buildIntegerDuration(heartbeat);
  if (built) {
    next.heartbeat = built;
  } else {
    delete next.heartbeat;
  }
  return isEmptyObject(next) ? undefined : next;
}

function writeInput(
  prior: Input | undefined,
  schemaRaw: string,
): Input | undefined {
  const next: Input = { ...(prior ?? {}) };
  applySchema(next, schemaRaw, prior?.schema);
  return isEmptyObject(next) ? undefined : next;
}

function writeOutput(
  prior: Output | undefined,
  asRaw: string,
  schemaRaw: string,
): Output | undefined {
  const next: Output = { ...(prior ?? {}) };
  applyAs(next, asRaw);
  applySchema(next, schemaRaw, prior?.schema);
  return isEmptyObject(next) ? undefined : next;
}

function writeExport(
  prior: Export | undefined,
  asRaw: string,
  schemaRaw: string,
): Export | undefined {
  const next: Export = { ...(prior ?? {}) };
  applyAs(next, asRaw);
  applySchema(next, schemaRaw, prior?.schema);
  return isEmptyObject(next) ? undefined : next;
}

export function writeCommonFields<T extends TaskBase>(
  task: T,
  form: CommonFieldsForm,
): T {
  const next: T = { ...task };

  if (form.if.trim() !== '') {
    next.if = form.if;
  } else {
    delete next.if;
  }

  const input = writeInput(task.input, form.inputSchema);
  if (input) {
    next.input = input;
  } else {
    delete next.input;
  }

  const output = writeOutput(task.output, form.outputAs, form.outputSchema);
  if (output) {
    next.output = output;
  } else {
    delete next.output;
  }

  const exported = writeExport(task.export, form.exportAs, form.exportSchema);
  if (exported) {
    next.export = exported;
  } else {
    delete next.export;
  }

  const metadata = writeMetadata(task.metadata, form.heartbeat, form.metadata);
  if (metadata) {
    next.metadata = metadata;
  } else {
    delete next.metadata;
  }

  return next;
}

/**
 * Set/clear a task-level `then`. `continue` is the schema default, so selecting
 * it drops the property (keeping YAML minimal), matching the optional-field
 * convention used elsewhere.
 */
export function writeThen<T extends TaskBase>(task: T, value: string): T {
  const next: T = { ...task };
  if (value === 'continue') {
    delete next.then;
  } else {
    next.then = value;
  }
  return next;
}
