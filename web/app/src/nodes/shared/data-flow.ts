/*
 * Copyright 2026 Zigflow authors <https://github.com/zigflow/studio/graphs/contributors>
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
import type { UISchema } from '@workflowbuilder/sdk';

// Task-level Serverless Workflow data-flow keys shared by every task node:
// `if:` (conditional execution), `export.as` (context update), `output.as`
// (task output filter).
export const dataFlowProperties = {
  ifExpr: {
    type: 'string',
  },
  exportAs: {
    type: 'string',
  },
  outputAs: {
    type: 'string',
  },
} as const;

export const dataFlowDefaults = {
  ifExpr: '',
  exportAs: '',
  outputAs: '',
};

type DataFlowScopes = {
  ifExpr: string;
  exportAs: string;
  outputAs: string;
};

export function dataFlowAccordion(scopes: DataFlowScopes): UISchema {
  return {
    type: 'Accordion',
    label: 'Data Flow',
    elements: [
      {
        type: 'Text',
        scope: scopes.ifExpr,
        label: 'If (run condition)',
        placeholder: '${ $data.approved == true }',
      },
      {
        type: 'Text',
        scope: scopes.exportAs,
        label: 'Export As',
        placeholder: '${ $context + . }',
      },
      {
        type: 'Text',
        scope: scopes.outputAs,
        label: 'Output As',
        placeholder: '${ $context }',
      },
    ],
  };
}
