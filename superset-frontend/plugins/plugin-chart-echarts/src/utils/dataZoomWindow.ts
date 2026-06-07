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
  AxisType,
  normalizeTimestamp,
  TimeGranularity,
} from '@superset-ui/core';
import type { SeriesOption } from 'echarts';

const DAY_MS = 86400000;

export type InitialDataZoomRange =
  | { start: number; end: number }
  | { startValue: number | string; endValue: number | string };

/** Daily chart time grains: N means last N calendar days. All other grains: N means last N x-axis points (bars). When grain is omitted, keeps legacy calendar-day behavior. */
export function isCalendarDayTimeGrain(
  grain: TimeGranularity | undefined | null,
): boolean {
  if (grain === undefined || grain === null) {
    return true;
  }
  return grain === TimeGranularity.DAY || grain === TimeGranularity.DATE;
}

export function parseDataZoomLastNDays(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return Math.floor(n);
}

export function normalizeChartXToUnixMs(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === 'string') {
    const normalized = normalizeTimestamp(value);
    const t = Date.parse(normalized);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

function sliceSeriesRows(
  seriesForExtent: SeriesOption[],
  isHorizontal: boolean,
): unknown[][] {
  const idx = isHorizontal ? 1 : 0;
  const firstSeries = seriesForExtent.find(
    s => Array.isArray(s.data) && s.data.length,
  );
  const firstData = firstSeries?.data as unknown[] | undefined;
  if (!firstData) {
    return [];
  }
  return firstData.filter(
    row => Array.isArray(row) && row.length > idx,
  ) as unknown[][];
}

/**
 * Last N x-axis buckets (bars), using series point order — not calendar length.
 */
function computeLastNBarsDataZoomRange(
  seriesForExtent: SeriesOption[],
  xAxisType: AxisType,
  isHorizontal: boolean,
  lastN: number,
): InitialDataZoomRange {
  if (xAxisType !== AxisType.Time && xAxisType !== AxisType.Category) {
    return { start: 0, end: 100 };
  }

  const rows = sliceSeriesRows(seriesForExtent, isHorizontal);
  const total = rows.length;
  if (total === 0) {
    return { start: 0, end: 100 };
  }

  const n = Math.min(lastN, total);
  if (n <= 0 || n >= total) {
    return { start: 0, end: 100 };
  }

  const idx = isHorizontal ? 1 : 0;
  const startRow = rows[total - n];
  const endRow = rows[total - 1];
  const startRaw = startRow[idx];
  const endRaw = endRow[idx];

  if (xAxisType === AxisType.Time) {
    const startMs = normalizeChartXToUnixMs(startRaw);
    const endMs = normalizeChartXToUnixMs(endRaw);
    if (startMs == null || endMs == null) {
      return { start: 0, end: 100 };
    }
    return { startValue: startMs, endValue: endMs };
  }

  return { startValue: total - n, endValue: total - 1 };
}

/**
 * Reads x-coordinates from [x, y] series rows (or [y, x] when `isHorizontal`).
 */
export function getSeriesTimeExtent(
  seriesList: SeriesOption[],
  isHorizontal: boolean,
): { min: number; max: number } | null {
  const timeIdx = isHorizontal ? 1 : 0;
  let min = Infinity;
  let max = -Infinity;

  seriesList.forEach(series => {
    const data = series.data as unknown[] | undefined;
    if (!Array.isArray(data)) {
      return;
    }
    data.forEach(row => {
      if (!Array.isArray(row)) {
        return;
      }
      const t = normalizeChartXToUnixMs(row[timeIdx]);
      if (t != null) {
        min = Math.min(min, t);
        max = Math.max(max, t);
      }
    });
  });

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return null;
  }
  return { min, max };
}

function computeCalendarDaysDataZoomRange(
  seriesForExtent: SeriesOption[],
  xAxisType: AxisType,
  isHorizontal: boolean,
  lastNDays: number,
): InitialDataZoomRange {
  if (xAxisType !== AxisType.Time && xAxisType !== AxisType.Category) {
    return { start: 0, end: 100 };
  }

  const extent = getSeriesTimeExtent(seriesForExtent, isHorizontal);
  if (!extent) {
    return computeLastNBarsDataZoomRange(
      seriesForExtent,
      xAxisType,
      isHorizontal,
      lastNDays,
    );
  }

  const windowEndMs = extent.max;
  const windowStartMs = windowEndMs - lastNDays * DAY_MS;

  const startMs = Math.max(windowStartMs, extent.min);
  const endMs = windowEndMs;

  if (startMs >= endMs) {
    return computeLastNBarsDataZoomRange(
      seriesForExtent,
      xAxisType,
      isHorizontal,
      lastNDays,
    );
  }

  if (xAxisType === AxisType.Time) {
    return { startValue: startMs, endValue: endMs };
  }

  const firstSeries = seriesForExtent.find(
    s => Array.isArray(s.data) && s.data.length,
  );
  const firstData = firstSeries?.data as unknown[] | undefined;
  const idx = isHorizontal ? 1 : 0;

  if (!firstData) {
    return computeLastNBarsDataZoomRange(
      seriesForExtent,
      xAxisType,
      isHorizontal,
      lastNDays,
    );
  }

  let startCat: string | number | undefined;
  let endCat: string | number | undefined;

  for (let i = 0; i < firstData.length; i += 1) {
    const row = firstData[i];
    if (!Array.isArray(row)) {
      continue;
    }
    const rawX = row[idx];
    const ms = normalizeChartXToUnixMs(rawX);
    if (ms == null) {
      continue;
    }
    if (ms >= startMs && startCat === undefined) {
      startCat = rawX as string | number;
    }
    if (ms <= endMs) {
      endCat = rawX as string | number;
    }
  }

  if (startCat === undefined || endCat === undefined) {
    return computeLastNBarsDataZoomRange(
      seriesForExtent,
      xAxisType,
      isHorizontal,
      lastNDays,
    );
  }

  return { startValue: startCat, endValue: endCat };
}

/**
 * Initial dataZoom: for **Day** or **Date** time axes, last N calendar days
 * ending at the latest data point; for category axes and other grains, last N
 * x-axis points (bars).
 */
export function computeInitialDataZoomRange(
  seriesForExtent: SeriesOption[],
  xAxisType: AxisType,
  isHorizontal: boolean,
  lastN: number | null,
  timeGrainSqla?: TimeGranularity | null,
): InitialDataZoomRange {
  if (!lastN) {
    return { start: 0, end: 100 };
  }

  const useCalendarDays =
    xAxisType === AxisType.Time && isCalendarDayTimeGrain(timeGrainSqla);

  if (!useCalendarDays) {
    return computeLastNBarsDataZoomRange(
      seriesForExtent,
      xAxisType,
      isHorizontal,
      lastN,
    );
  }

  return computeCalendarDaysDataZoomRange(
    seriesForExtent,
    xAxisType,
    isHorizontal,
    lastN,
  );
}
