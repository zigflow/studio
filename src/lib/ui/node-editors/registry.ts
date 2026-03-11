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
// Node editor registry — maps each NodeType to a Svelte editor component.
//
// Each component receives `node: Node` and emits `onupdate: (node: Node) => void`.
// The registry is keyed by the node's config.kind (for task nodes) or node.type
// (for structural nodes), matching the NodeType union.
import type { Node } from '$lib/tasks/model';
import type { Component } from 'svelte';

import CallActivityEditor from './CallActivityEditor.svelte';
import CallGrpcEditor from './CallGrpcEditor.svelte';
import CallHttpEditor from './CallHttpEditor.svelte';
import ForkNodeEditor from './ForkNodeEditor.svelte';
import LoopNodeEditor from './LoopNodeEditor.svelte';
import RunContainerEditor from './RunContainerEditor.svelte';
import RunScriptEditor from './RunScriptEditor.svelte';
import RunShellEditor from './RunShellEditor.svelte';
import RunWorkflowEditor from './RunWorkflowEditor.svelte';
import SetNodeEditor from './SetNodeEditor.svelte';
import SwitchNodeEditor from './SwitchNodeEditor.svelte';
import TryNodeEditor from './TryNodeEditor.svelte';
import WaitNodeEditor from './WaitNodeEditor.svelte';

export interface NodeEditorProps {
  node: Node;
  onupdate: (node: Node) => void;
}

// Cast is intentional: each editor declares a narrower Props type internally
// but is used through this common interface. The registry guarantees the correct
// editor is only ever paired with the matching node type.
type EditorComponent = Component<NodeEditorProps>;

const registry: Partial<Record<string, EditorComponent>> = {
  'call-activity': CallActivityEditor as unknown as EditorComponent,
  'call-grpc': CallGrpcEditor as unknown as EditorComponent,
  'call-http': CallHttpEditor as unknown as EditorComponent,
  'run-container': RunContainerEditor as unknown as EditorComponent,
  'run-script': RunScriptEditor as unknown as EditorComponent,
  'run-shell': RunShellEditor as unknown as EditorComponent,
  'run-workflow': RunWorkflowEditor as unknown as EditorComponent,
  set: SetNodeEditor as unknown as EditorComponent,
  wait: WaitNodeEditor as unknown as EditorComponent,
  switch: SwitchNodeEditor as unknown as EditorComponent,
  fork: ForkNodeEditor as unknown as EditorComponent,
  try: TryNodeEditor as unknown as EditorComponent,
  loop: LoopNodeEditor as unknown as EditorComponent,
};

export function getNodeEditor(node: Node): EditorComponent | null {
  const key = node.type === 'task' ? node.config.kind : node.type;
  return registry[key] ?? null;
}
