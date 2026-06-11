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
  ChartProps,
  DTTM_ALIAS,
  SqlaFormData,
  supersetTheme,
} from '@superset-ui/core';
import transformProps from '../../src/MixedTimeseries/transformProps';
import { EchartsMixedTimeseriesProps } from '../../src/MixedTimeseries/types';
import { EchartsTimeseriesSeriesType } from '../../src/types';

describe('EchartsMixedTimeseries transformProps', () => {
  const timestampA = Date.UTC(2026, 4, 31);
  const timestampB = Date.UTC(2026, 5, 1);

  it('preserves null stacked bar values instead of rendering them as zero', () => {
    const formData: SqlaFormData = {
      colorScheme: 'bnbColors',
      datasource: '3__table',
      granularity_sqla: 'ds',
      metric: 'previous_month_registered',
      metrics: ['previous_month_registered', 'current_month_registered'],
      metricsB: [],
      viz_type: 'mixed_timeseries',
      seriesType: EchartsTimeseriesSeriesType.Bar,
      stack: true,
      showValue: true,
      percentageThreshold: 0,
      yAxisFormat: ',d',
    };
    const chartProps = new ChartProps({
      formData,
      width: 800,
      height: 600,
      queriesData: [
        {
          data: [
            {
              [DTTM_ALIAS]: timestampA,
              previous_month_registered: 2801,
              current_month_registered: null,
            },
            {
              [DTTM_ALIAS]: timestampB,
              previous_month_registered: null,
              current_month_registered: 2540,
            },
          ],
          label_map: {
            previous_month_registered: ['previous_month_registered'],
            current_month_registered: ['current_month_registered'],
          },
        },
        {
          data: [],
          label_map: {},
        },
      ],
      theme: supersetTheme,
    });

    const { echartOptions } = transformProps(
      chartProps as EchartsMixedTimeseriesProps,
    );
    const series = echartOptions.series as any[];
    const previousMonth = series.find(
      entry => entry.name === 'previous_month_registered',
    );
    const currentMonth = series.find(
      entry => entry.name === 'current_month_registered',
    );

    expect(previousMonth.data).toEqual([
      [timestampA, 2801],
      [timestampB, null],
    ]);
    expect(currentMonth.data).toEqual([
      [timestampA, null],
      [timestampB, 2540],
    ]);
    expect(
      previousMonth.label.formatter({
        dataIndex: 1,
        seriesIndex: series.indexOf(previousMonth),
        value: [timestampB, null],
      }),
    ).toBe('');

    const tooltip = (echartOptions.tooltip as any).formatter([
      {
        dataIndex: 1,
        marker: '',
        seriesId: 'previous_month_registered',
        value: [timestampB, null],
      },
      {
        dataIndex: 1,
        marker: '',
        seriesId: 'current_month_registered',
        value: [timestampB, 2540],
      },
    ]);

    expect(tooltip).toContain('current_month_registered: 2,540');
    expect(tooltip).not.toContain('previous_month_registered');
    expect(tooltip).not.toContain(': 0');
  });
});
