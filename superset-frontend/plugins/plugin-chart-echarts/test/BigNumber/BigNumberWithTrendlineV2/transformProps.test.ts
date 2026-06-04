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
import {
  DatasourceType,
  GenericDataType,
  supersetTheme,
} from '@superset-ui/core';
import transformProps from '../../../src/BigNumber/BigNumberWithTrendlineV2/transformProps';
import {
  BigNumberDatum,
  BigNumberWithTrendlineV2ChartProps,
  BigNumberWithTrendlineV2FormData,
} from '../../../src/BigNumber/types';

const formData = {
  metrics: ['current', 'target', 'six_month_ma'],
  targetLabel: 'of the target',
  secondaryTargetLabel: 'of 6 month ma',
  viz_type: 'big_number_v2',
  yAxisFormat: '.3s',
  datasource: 'test_datasource',
};

const rawFormData: BigNumberWithTrendlineV2FormData = {
  datasource: '1__table',
  metrics: ['current', 'target', 'six_month_ma'],
  target_label: 'of the target',
  secondary_target_label: 'of 6 month ma',
  viz_type: 'big_number_v2',
  y_axis_format: '.3s',
};

function generateProps(
  data: BigNumberDatum[],
  extraFormData = {},
  extraQueryData: any = {},
): BigNumberWithTrendlineV2ChartProps {
  return {
    width: 400,
    height: 300,
    annotationData: {},
    datasource: {
      id: 0,
      name: '',
      type: DatasourceType.Table,
      columns: [],
      metrics: [],
      columnFormats: {},
      verboseMap: {},
    },
    rawDatasource: {},
    rawFormData: {
      ...rawFormData,
      ...extraFormData,
    },
    hooks: {},
    initialValues: {},
    formData: {
      ...formData,
      ...extraFormData,
    },
    queriesData: [
      {
        data,
        colnames: ['current', 'target', 'six_month_ma'],
        coltypes: [
          GenericDataType.Numeric,
          GenericDataType.Numeric,
          GenericDataType.Numeric,
        ],
        ...extraQueryData,
      },
    ],
    ownState: {},
    filterState: {},
    behaviors: [],
    theme: supersetTheme,
  };
}

describe('BigNumberWithTrendlineV2', () => {
  describe('transformProps()', () => {
    it('uses three metric values from the first query row', () => {
      const transformed = transformProps(
        generateProps([
          {
            current: 172,
            target: 290,
            six_month_ma: 150,
          },
        ]),
      );

      expect(transformed.bigNumber).toStrictEqual(172);
      expect(transformed.comparisons[0]).toMatchObject({
        value: 290,
        label: 'of the target',
        className: 'negative',
      });
      expect(transformed.comparisons[0].percentChange).toBeCloseTo(
        172 / 290 - 1,
      );
      expect(transformed.comparisons[1]).toMatchObject({
        value: 150,
        label: 'of 6 month ma',
        className: 'positive',
      });
      expect(transformed.comparisons[1].percentChange).toBeCloseTo(
        172 / 150 - 1,
      );
    });

    it('falls back to the first three ordered rows for a single metric', () => {
      const transformed = transformProps(
        generateProps(
          [
            {
              __timestamp: 100,
              current: 290,
            },
            {
              __timestamp: 200,
              current: 172,
            },
            {
              __timestamp: 0,
              current: 150,
            },
          ],
          {
            metrics: ['current'],
            granularity_sqla: '__timestamp',
            x_axis: '__timestamp',
          },
          {
            colnames: ['__timestamp', 'current'],
            coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
          },
        ),
      );

      expect(transformed.bigNumber).toStrictEqual(172);
      expect(transformed.comparisons[0].value).toStrictEqual(290);
      expect(transformed.comparisons[1].value).toStrictEqual(150);
    });
  });
});
