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

/* eslint-disable no-console -- trace dataZoom default window calculation for troubleshooting */

import { AxisType, normalizeTimestamp } from '@superset-ui/core';
import { SeriesOption } from 'echarts';

const DAY_MS = 86400000;
const LOG_PREFIX = '[dataZoomWindow]';

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

export type InitialDataZoomRange =
  | { start: number; end: number }
  | { startValue: number | string; endValue: number | string };

/**
 * Maps a rolling "last N calendar days ending now" window onto the initial
 * dataZoom slider. Does not affect queries — only the rendered zoom window.
 */
export function computeInitialDataZoomRange(
  seriesForExtent: SeriesOption[],
  xAxisType: AxisType,
  isHorizontal: boolean,
  lastNDays: number | null,
): InitialDataZoomRange {
  if (!lastNDays) {
    console.log(
      LOG_PREFIX,
      'Using full axis range (control empty or invalid last N days)',
    );
    return { start: 0, end: 100 };
  }

  if (xAxisType !== AxisType.Time && xAxisType !== AxisType.Category) {
    console.log(
      LOG_PREFIX,
      'Skipping default window: x-axis is not time or category',
      xAxisType,
    );
    return { start: 0, end: 100 };
  }

  const extent = getSeriesTimeExtent(seriesForExtent, isHorizontal);
  if (!extent) {
    console.log(
      LOG_PREFIX,
      'Using full axis range (could not derive a time extent from series)',
    );
    return { start: 0, end: 100 };
  }

  const windowEndMs = Date.now();
  const windowStartMs = windowEndMs - lastNDays * DAY_MS;
  console.log(LOG_PREFIX, 'Computed calendar window', {
    lastNDays,
    windowStartMs,
    windowEndMs,
    dataExtent: extent,
  });

  const startMs = Math.max(windowStartMs, extent.min);
  const endMs = Math.min(windowEndMs, extent.max);

  if (startMs >= endMs) {
    console.log(
      LOG_PREFIX,
      'Calendar window does not overlap chart data; using full range',
    );
    return { start: 0, end: 100 };
  }

  if (xAxisType === AxisType.Time) {
    console.log(LOG_PREFIX, 'Applying time-axis dataZoom', { startMs, endMs });
    return { startValue: startMs, endValue: endMs };
  }

  const firstSeries = seriesForExtent.find(
    s => Array.isArray(s.data) && s.data.length,
  );
  const firstData = firstSeries?.data as unknown[] | undefined;
  const idx = isHorizontal ? 1 : 0;

  if (!firstData) {
    console.log(LOG_PREFIX, 'Category axis: no series data for window mapping');
    return { start: 0, end: 100 };
  }

  let startCat: string | number | undefined;
  let endCat: string | number | undefined;

  for (let i = 0; i < firstData.length; i += 1) {
    const row = firstData[i];
    if (!Array.isArray(row)) {
      // continue
      continue;
    }
    const rawX = row[idx];
    const ms = normalizeChartXToUnixMs(rawX);
    if (ms == null) {
      // continue
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
    console.log(
      LOG_PREFIX,
      'Category axis: could not map window to category values',
    );
    return { start: 0, end: 100 };
  }

  console.log(LOG_PREFIX, 'Applying category-axis dataZoom', {
    startCat,
    endCat,
  });
  return { startValue: startCat, endValue: endCat };
}
