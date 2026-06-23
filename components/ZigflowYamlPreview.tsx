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
import {
  createEmptyZigflowWorkflow,
  defaultZigflowAuthoringTarget,
  exportZigflowWorkflowToYaml,
} from '@/lib/zigflow';
import en from '@/locales/en.json';

// Read-only preview that proves the app can consume the Zigflow domain layer.
// Pure render: no hooks or browser APIs, so this stays a server component.
export default function ZigflowYamlPreview() {
  const workflow = createEmptyZigflowWorkflow(defaultZigflowAuthoringTarget);
  const yaml = exportZigflowWorkflowToYaml(workflow);

  return (
    <section
      aria-label={en.yamlPreview.title}
      className="flex h-full flex-col gap-2 overflow-auto p-4 text-sm"
    >
      <h2 className="font-semibold">{en.yamlPreview.title}</h2>
      <pre className="overflow-auto whitespace-pre rounded bg-zinc-50 p-3 font-mono text-xs">
        {yaml}
      </pre>
    </section>
  );
}
