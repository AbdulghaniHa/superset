/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { t } from '@superset-ui/core';
import {
  ControlPanelConfig,
  getStandardizedControls,
  temporalColumnMixin,
} from '@superset-ui/chart-controls';
import { headerFontSize, subheaderFontSize } from '../sharedControls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['metrics'],
        ['x_axis'],
        ['time_grain_sqla'],
        ['adhoc_filters'],
      ],
    },
    {
      label: t('Options'),
      tabOverride: 'data',
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'target_label',
            config: {
              type: 'TextControl',
              label: t('First comparison label'),
              renderTrigger: true,
              default: t('of the target'),
              description: t(
                'Text displayed after the percentage for the first comparison row',
              ),
            },
          },
        ],
        [
          {
            name: 'secondary_target_label',
            config: {
              type: 'TextControl',
              label: t('Second comparison label'),
              renderTrigger: true,
              default: t('of 6 month ma'),
              description: t(
                'Text displayed after the percentage for the second comparison row',
              ),
            },
          },
        ],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        [headerFontSize],
        [subheaderFontSize],
        ['y_axis_format'],
        ['currency_format'],
      ],
    },
  ],
  controlOverrides: {
    y_axis_format: {
      label: t('Number format'),
    },
    x_axis: {
      label: t('TEMPORAL X-AXIS'),
      ...temporalColumnMixin,
    },
  },
  formDataOverrides: formData => ({
    ...formData,
    metrics: getStandardizedControls().popAllMetrics(),
  }),
};

export default config;
