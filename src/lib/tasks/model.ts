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

// Zigflow Visual Editor — Canonical IR Types
//
// This file is the authoritative source of truth for the workflow intermediate
// representation (IR). It must remain free of UI dependencies and serialisable
// to JSON at all times.

// ---------------------------------------------------------------------------
// Internal metadata key — used to persist stable node/branch IDs across
// round-trips through the Zigflow DSL YAML format.
// ---------------------------------------------------------------------------

export const ZIGFLOW_ID_KEY = '__zigflow_id';

// ---------------------------------------------------------------------------
// Document & file
// ---------------------------------------------------------------------------

export type DocumentMetadata = {
  dsl: string;
  namespace: string;
  name: string;
  version: string;
  title?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
};

export type WorkflowFile = {
  document: DocumentMetadata;
  workflows: Record<string, NamedWorkflow>;
  order: string[]; // stable ordering of named workflows
};

export type NamedWorkflow = {
  id: string;
  name: string;
  root: FlowGraph;
};

// ---------------------------------------------------------------------------
// FlowGraph
// ---------------------------------------------------------------------------

export type FlowGraph = {
  nodes: Record<string, Node>;
  order: string[]; // execution sequence — edges are derived from this
};

// ---------------------------------------------------------------------------
// Node union
// ---------------------------------------------------------------------------

export type Node = TaskNode | SwitchNode | ForkNode | TryNode | LoopNode;

// ---------------------------------------------------------------------------
// TaskNode
// Represents leaf Zigflow tasks: set, call, run, wait, raise, listen
// ---------------------------------------------------------------------------

export type TaskNode = {
  id: string;
  type: 'task';
  name: string;
  config: TaskConfig;
  if?: string;
  metadata?: Record<string, unknown>;
  export?: string;
  output?: string;
};

// ---------------------------------------------------------------------------
// SwitchNode
// Branches are modelled as embedded FlowGraphs; the exporter hoists them.
// ---------------------------------------------------------------------------

export type SwitchNode = {
  id: string;
  type: 'switch';
  name: string;
  branches: SwitchBranch[];
  if?: string;
  metadata?: Record<string, unknown>;
};

export type SwitchBranch = {
  id: string;
  label: string;
  condition?: string; // undefined = default branch
  graph: FlowGraph;
  metadata?: Record<string, unknown>;
  // When set, this branch references a top-level named workflow (new format).
  // The exporter emits `then: <thenWorkflowName>` instead of hoisting the
  // branch graph. The local `graph` is kept empty in this case.
  thenWorkflowName?: string;
};

// ---------------------------------------------------------------------------
// ForkNode
// ---------------------------------------------------------------------------

export type ForkNode = {
  id: string;
  type: 'fork';
  name: string;
  compete: boolean;
  branches: ForkBranch[];
  if?: string;
  metadata?: Record<string, unknown>;
};

export type ForkBranch = {
  id: string;
  label: string;
  graph: FlowGraph;
  metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// TryNode
// ---------------------------------------------------------------------------

export type TryNode = {
  id: string;
  type: 'try';
  name: string;
  tryGraph: FlowGraph;
  catchGraph?: FlowGraph;
  if?: string;
  metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// LoopNode  (Zigflow `for` task)
// ---------------------------------------------------------------------------

export type LoopNode = {
  id: string;
  type: 'loop';
  name: string;
  each?: string; // variable name for the current item
  in: string; // expression: collection, array, or count
  at?: string; // variable name for the current index
  while?: string; // optional break condition
  bodyGraph: FlowGraph;
  if?: string;
  metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Task configs
// Each config carries a `kind` discriminant for exhaustive switching.
// ---------------------------------------------------------------------------

// Assignment values support JSON primitives. Objects and arrays are
// intentionally excluded from the Studio editor (they remain valid in
// the IR for round-trip purposes but cannot be created via the UI).
export type AssignmentValue = string | number | boolean | null;

export type SetConfig = {
  kind: 'set';
  assignments: Record<string, AssignmentValue>;
};

export type CallHTTPConfig = {
  kind: 'call-http';
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  endpoint: string;
  headers?: Record<string, string>;
  body?: string;
};

export type CallGRPCConfig = {
  kind: 'call-grpc';
  protoEndpoint: string;
  serviceName: string;
  serviceHost: string;
  servicePort: number;
  method: string;
  arguments?: Record<string, string>;
};

// A simple scalar value or expression string that can be used as a
// call-activity argument and edited in the Studio UI.
export type ActivityScalarArg = string | number | boolean | null;

// An argument that was parsed from YAML but is an object or array — the
// Studio cannot edit these inline, but preserves them for round-trip export.
export type ActivityComplexArg = { __unsupported: true; value: unknown };

export type ActivityArg = ActivityScalarArg | ActivityComplexArg;

export function isActivityComplexArg(
  arg: ActivityArg,
): arg is ActivityComplexArg {
  return (
    typeof arg === 'object' &&
    arg !== null &&
    '__unsupported' in (arg as object)
  );
}

export type CallActivityConfig = {
  kind: 'call-activity';
  name: string;
  taskQueue?: string;
  arguments?: ActivityArg[];
};

export type LifetimePolicy = 'always' | 'onSuccess' | 'onError' | 'never';

export type RunContainerConfig = {
  kind: 'run-container';
  image: string;
  arguments?: ActivityArg[];
  environment?: Record<string, AssignmentValue>;
  workingDirectory?: string;
  lifetime?: LifetimePolicy;
  await?: boolean;
  ports?: unknown; // not editable; round-trip only
};

export type RunScriptConfig = {
  kind: 'run-script';
  language: string;
  code: string;
  arguments?: ActivityArg[];
  environment?: Record<string, AssignmentValue>;
  // await is always true for scripts; not stored
};

export type RunShellConfig = {
  kind: 'run-shell';
  command: string;
  arguments?: ActivityArg[];
  environment?: Record<string, AssignmentValue>;
  workingDirectory?: string;
  await?: boolean;
};

export type RunWorkflowConfig = {
  kind: 'run-workflow';
  name: string;
  namespace: string;
  version: string;
  await?: boolean;
};

export type WaitConfig = {
  kind: 'wait';
  duration: DurationSpec;
};

export type DurationSpec = {
  seconds?: number;
  minutes?: number;
  hours?: number;
  days?: number;
};

// Serverless Workflow native error types — canonical URI values with display keys.
export const SW_ERROR_DEFINITIONS = [
  {
    key: 'authentication',
    value: 'https://serverlessworkflow.io/spec/1.0.0/errors/authentication',
  },
  {
    key: 'authorization',
    value: 'https://serverlessworkflow.io/spec/1.0.0/errors/authorization',
  },
  {
    key: 'communication',
    value: 'https://serverlessworkflow.io/spec/1.0.0/errors/communication',
  },
  {
    key: 'configuration',
    value: 'https://serverlessworkflow.io/spec/1.0.0/errors/configuration',
  },
  {
    key: 'expression',
    value: 'https://serverlessworkflow.io/spec/1.0.0/errors/expression',
  },
  {
    key: 'runtime',
    value: 'https://serverlessworkflow.io/spec/1.0.0/errors/runtime',
  },
  {
    key: 'timeout',
    value: 'https://serverlessworkflow.io/spec/1.0.0/errors/timeout',
  },
  {
    key: 'validation',
    value: 'https://serverlessworkflow.io/spec/1.0.0/errors/validation',
  },
] as const;

export type SwErrorType = (typeof SW_ERROR_DEFINITIONS)[number]['value'];

// Named URI constants for special raise types (used by editor logic).
export const GO_PANIC_URI = 'https://go.dev/panic' as const;
export const TEMPORAL_NON_RETRYABLE_URI =
  'https://temporal.io/errors/nonretryable' as const;

// Special raise types — same shape as SW_ERROR_DEFAULT_STATUS (URI → status).
export const RAISE_SPECIAL_TYPES: Readonly<Record<string, number>> = {
  [GO_PANIC_URI]: 500,
  [TEMPORAL_NON_RETRYABLE_URI]: 500,
};

// Default HTTP-like status codes per Serverless Workflow error type URI.
// Spec-defined values; anything not in this map defaults to 400.
const SW_ERROR_DEFAULT_STATUS: Readonly<Record<string, number>> = {
  'https://serverlessworkflow.io/spec/1.0.0/errors/configuration': 400,
  'https://serverlessworkflow.io/spec/1.0.0/errors/validation': 400,
  'https://serverlessworkflow.io/spec/1.0.0/errors/expression': 400,
  'https://serverlessworkflow.io/spec/1.0.0/errors/authentication': 401,
  'https://serverlessworkflow.io/spec/1.0.0/errors/authorization': 403,
  'https://serverlessworkflow.io/spec/1.0.0/errors/timeout': 408,
  'https://serverlessworkflow.io/spec/1.0.0/errors/communication': 500,
  'https://serverlessworkflow.io/spec/1.0.0/errors/runtime': 500,
};

export function defaultStatusForType(type: string): number {
  return SW_ERROR_DEFAULT_STATUS[type] ?? RAISE_SPECIAL_TYPES[type] ?? 400;
}

export type RaiseErrorDefinition = {
  type?: string; // SW error type
  title?: string; // StringOrRuntimeExpr
  detail?: string; // StringOrRuntimeExpr
  status?: number; // optional HTTP-like status integer
};

export type RaiseConfig = {
  kind: 'raise';
  definition?: RaiseErrorDefinition;
};

export type ListenEvent = {
  id: string;
  type: 'signal' | 'query' | 'update';
  acceptIf?: string;
  data?: Record<string, string>;
  datacontenttype?: string;
};

export type ListenConfig = {
  kind: 'listen';
  mode: 'one' | 'all' | 'any';
  events: ListenEvent[];
};

export type TaskConfig =
  | SetConfig
  | CallHTTPConfig
  | CallGRPCConfig
  | CallActivityConfig
  | RunContainerConfig
  | RunScriptConfig
  | RunShellConfig
  | RunWorkflowConfig
  | WaitConfig
  | RaiseConfig
  | ListenConfig;

export type NodeType = TaskConfig['kind'] | 'switch' | 'fork' | 'try' | 'loop';

// ---------------------------------------------------------------------------
// GraphPath — stable, ID-based navigation into nested FlowGraphs
//
// Encoding rules:
//   segments = []                    → root graph of the named workflow
//   segments = [nodeId]              → bodyGraph of a LoopNode
//   segments = [nodeId, branchId]    → branch graph of SwitchNode or ForkNode
//   segments = [nodeId, 'tryGraph']  → tryGraph of a TryNode
//   segments = [nodeId, 'catchGraph']→ catchGraph of a TryNode
//   Segments recurse for deeper nesting.
//
// Never store FlowGraph references directly. Always derive from WorkflowFile
// plus GraphPath so state remains stable across immutable updates.
// ---------------------------------------------------------------------------

export type GraphPath = {
  workflowId: string;
  segments: string[];
};
