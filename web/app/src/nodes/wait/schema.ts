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
import { type NodeSchema, sharedProperties } from '@workflowbuilder/sdk';

import { dataFlowProperties } from '../shared/data-flow';
import { durationUnitOptions } from './select-options';

export const schema = {
  type: 'object',
  properties: {
    ...sharedProperties,
    durationAmount: {
      type: 'number',
    },
    durationUnit: {
      type: 'string',
      options: Object.values(durationUnitOptions),
    },
    ...dataFlowProperties,
  },
} satisfies NodeSchema;

export type WaitSchema = typeof schema;
