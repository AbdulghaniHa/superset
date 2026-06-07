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
import { AxisType, TimeGranularity } from '@superset-ui/core';
import type { SeriesOption } from 'echarts';
import {
  computeInitialDataZoomRange,
  parseDataZoomLastNDays,
} from '../../src/utils/dataZoomWindow';

describe('dataZoomWindow', () => {
  describe('parseDataZoomLastNDays', () => {
    it('normalizes valid positive values', () => {
      expect(parseDataZoomLastNDays('3')).toBe(3);
      expect(parseDataZoomLastNDays(3.8)).toBe(3);
    });

    it('rejects empty and non-positive values', () => {
      expect(parseDataZoomLastNDays('')).toBeNull();
      expect(parseDataZoomLastNDays(0)).toBeNull();
      expect(parseDataZoomLastNDays('abc')).toBeNull();
    });
  });

  describe('computeInitialDataZoomRange', () => {
    const categorySeries: SeriesOption[] = [
      {
        data: [
          ['2025-10-02 - Thu', 1],
          ['2025-10-03 - Fri', 2],
          ['2025-10-04 - Sat', 3],
          ['2025-10-05 - Sun', 4],
          ['2025-10-06 - Mon', 5],
        ],
      },
    ];

    it('uses last N bar indexes for category axes even with daily grain', () => {
      expect(
        computeInitialDataZoomRange(
          categorySeries,
          AxisType.Category,
          false,
          3,
          TimeGranularity.DAY,
        ),
      ).toEqual({ startValue: 2, endValue: 4 });
    });

    it('uses last N bar indexes for horizontal category axes', () => {
      expect(
        computeInitialDataZoomRange(
          [
            {
              data: [
                [1, '2025-10-02 - Thu'],
                [2, '2025-10-03 - Fri'],
                [3, '2025-10-04 - Sat'],
                [4, '2025-10-05 - Sun'],
              ],
            },
          ],
          AxisType.Category,
          true,
          2,
          TimeGranularity.DAY,
        ),
      ).toEqual({ startValue: 2, endValue: 3 });
    });

    it('anchors calendar windows to the latest time-axis data point', () => {
      const oct1 = Date.UTC(2025, 9, 1);
      const oct5 = Date.UTC(2025, 9, 5);

      expect(
        computeInitialDataZoomRange(
          [
            {
              data: [
                [oct1, 1],
                [Date.UTC(2025, 9, 3), 2],
                [oct5, 3],
              ],
            },
          ],
          AxisType.Time,
          false,
          3,
          TimeGranularity.DAY,
        ),
      ).toEqual({ startValue: Date.UTC(2025, 9, 2), endValue: oct5 });
    });
  });
});
