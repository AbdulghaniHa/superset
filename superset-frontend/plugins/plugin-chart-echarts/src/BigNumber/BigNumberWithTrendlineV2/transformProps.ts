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
  ensureIsArray,
  GenericDataType,
  getMetricLabel,
  getNumberFormatter,
  getValueFormatter,
  getXAxisLabel,
  NumberFormats,
} from '@superset-ui/core';
import {
  BigNumberDatum,
  BigNumberV2Comparison,
  BigNumberV2VizProps,
  BigNumberWithTrendlineV2ChartProps,
} from '../types';
import { parseMetricValue } from '../utils';

const percentFormatter = getNumberFormatter(
  NumberFormats.PERCENT_SIGNED_1_POINT,
);

function getSortValue(value: unknown) {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? value : parsed;
  }
  return 0;
}

function getClassName(percentChange: number | null) {
  if (percentChange === null) {
    return '';
  }
  if (percentChange > 0) {
    return 'positive';
  }
  if (percentChange < 0) {
    return 'negative';
  }
  return '';
}

function getPercentChange(
  currentValue: number | null,
  targetValue: number | null,
) {
  if (currentValue === null || targetValue === null || targetValue === 0) {
    return null;
  }
  return currentValue / targetValue - 1;
}

export default function transformProps(
  chartProps: BigNumberWithTrendlineV2ChartProps,
): BigNumberV2VizProps {
  const {
    width,
    height,
    queriesData,
    formData,
    rawFormData,
    hooks,
    datasource: { currencyFormats = {}, columnFormats = {} },
  } = chartProps;
  const {
    headerFontSize,
    metrics = [],
    targetLabel = '',
    secondaryTargetLabel = '',
    subheaderFontSize,
    yAxisFormat,
    currencyFormat,
  } = formData;
  const { data = [], colnames = [], coltypes = [] } = queriesData[0];
  const metricLabels = ensureIsArray(metrics).map(getMetricLabel);
  const xAxisLabel = getXAxisLabel(rawFormData) as string | undefined;
  const sortableData = (data as BigNumberDatum[])
    .map(row => ({
      row,
      sortValue: getSortValue(xAxisLabel ? row[xAxisLabel] : undefined),
    }))
    .sort((a, b) => {
      if (a.sortValue > b.sortValue) {
        return -1;
      }
      if (a.sortValue < b.sortValue) {
        return 1;
      }
      return 0;
    });
  const firstRow = sortableData[0]?.row ?? data[0];
  const numericColumns = colnames.filter(
    (_, index) => coltypes[index] === GenericDataType.Numeric,
  );
  const valueColumns =
    metricLabels.length >= 3 ? metricLabels : numericColumns.slice(0, 3);

  let currentValue: number | null = null;
  let firstTargetValue: number | null = null;
  let secondTargetValue: number | null = null;

  if (firstRow && valueColumns.length >= 3) {
    currentValue = parseMetricValue(firstRow[valueColumns[0]]);
    firstTargetValue = parseMetricValue(firstRow[valueColumns[1]]);
    secondTargetValue = parseMetricValue(firstRow[valueColumns[2]]);
  } else if (metricLabels.length > 0 && sortableData.length >= 3) {
    const metricLabel = metricLabels[0];
    currentValue = parseMetricValue(sortableData[0].row[metricLabel]);
    firstTargetValue = parseMetricValue(sortableData[1].row[metricLabel]);
    secondTargetValue = parseMetricValue(sortableData[2].row[metricLabel]);
  }

  const comparisonValues = [
    {
      key: 'first-comparison',
      value: firstTargetValue,
      label: targetLabel,
    },
    {
      key: 'second-comparison',
      value: secondTargetValue,
      label: secondaryTargetLabel,
    },
  ];
  const comparisons: BigNumberV2Comparison[] = comparisonValues.map(
    comparison => {
      const percentChange = getPercentChange(currentValue, comparison.value);
      return {
        ...comparison,
        percentChange,
        className: getClassName(percentChange),
      };
    },
  );

  const headerFormatter = getValueFormatter(
    ensureIsArray(metrics)[0],
    currencyFormats,
    columnFormats,
    yAxisFormat,
    currencyFormat,
  );
  const comparisonValueFormatter = getValueFormatter(
    ensureIsArray(metrics)[1] ?? ensureIsArray(metrics)[0],
    currencyFormats,
    columnFormats,
    yAxisFormat,
    currencyFormat,
  );
  const { onContextMenu } = hooks;

  return {
    width,
    height,
    bigNumber: currentValue,
    comparisons,
    headerFormatter,
    comparisonValueFormatter,
    percentFormatter,
    headerFontSize,
    subheaderFontSize,
    onContextMenu,
  };
}
