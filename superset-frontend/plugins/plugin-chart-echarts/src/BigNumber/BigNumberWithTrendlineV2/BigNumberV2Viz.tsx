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
import React, { MouseEvent } from 'react';
import {
  computeMaxFontSize,
  getNumberFormatter,
  styled,
  t,
} from '@superset-ui/core';
import { BigNumberV2VizProps } from '../types';

const defaultNumberFormatter = getNumberFormatter();
const DETAIL_FONT_SCALE = 0.95;

// Matches the existing BigNumber renderer pattern for measuring dynamic text.
// eslint-disable-next-line react-prefer-function-component/react-prefer-function-component
class BigNumberV2Viz extends React.PureComponent<BigNumberV2VizProps> {
  static defaultProps = {
    headerFontSize: 0.4,
    subheaderFontSize: 0.15,
  };

  createTemporaryContainer() {
    const container = document.createElement('div');
    container.className = 'superset-legacy-chart-big-number-v2';
    container.style.position = 'absolute';
    container.style.opacity = '0';
    return container;
  }

  renderHeader(maxHeight: number) {
    const {
      bigNumber,
      headerFormatter = defaultNumberFormatter,
      onContextMenu,
      width,
    } = this.props;
    const text = bigNumber === null ? t('No data') : headerFormatter(bigNumber);

    const container = this.createTemporaryContainer();
    document.body.append(container);
    const fontSize = computeMaxFontSize({
      text,
      maxWidth: width - 8,
      maxHeight,
      className: 'header-line',
      container,
    });
    container.remove();

    const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
      if (onContextMenu) {
        e.preventDefault();
        onContextMenu(e.nativeEvent.clientX, e.nativeEvent.clientY);
      }
    };

    return (
      <div
        className="header-line"
        style={{ fontSize, height: maxHeight }}
        onContextMenu={handleContextMenu}
      >
        {text}
      </div>
    );
  }

  renderComparisonRows(maxHeight: number) {
    const {
      bigNumber,
      comparisons,
      comparisonValueFormatter = defaultNumberFormatter,
      percentFormatter = defaultNumberFormatter,
      subheaderFontSize,
      width,
    } = this.props;

    if (bigNumber === null) {
      return null;
    }

    const visibleComparisons = comparisons.filter(
      comparison => comparison.value !== null,
    );

    if (!visibleComparisons.length) {
      return null;
    }

    const rowHeight = Math.max(
      1,
      Math.floor(maxHeight / visibleComparisons.length),
    );
    const valueMaxWidth = Math.floor(width * 0.32);
    const detailMaxWidth = Math.floor(width * 0.66);

    return (
      <div className="comparison-list" style={{ height: maxHeight }}>
        {visibleComparisons.map(comparison => {
          const valueText = comparisonValueFormatter(comparison.value);
          const percentText =
            comparison.percentChange === null
              ? t('N/A')
              : percentFormatter(comparison.percentChange);
          const detailText = [percentText, comparison.label]
            .filter(Boolean)
            .join(' ');

          const container = this.createTemporaryContainer();
          document.body.append(container);
          const valueFontSize = computeMaxFontSize({
            text: valueText,
            maxWidth: valueMaxWidth,
            maxHeight: rowHeight,
            className: 'comparison-value',
            container,
          });
          const detailFontSize = computeMaxFontSize({
            text: detailText,
            maxWidth: detailMaxWidth,
            maxHeight: Math.ceil(rowHeight * subheaderFontSize * 5),
            className: 'comparison-detail',
            container,
          });
          const scaledDetailFontSize = Math.max(
            1,
            Math.floor(detailFontSize * DETAIL_FONT_SCALE),
          );
          container.remove();

          return (
            <div
              className={`comparison-row ${comparison.className}`}
              key={comparison.key}
              style={{ height: rowHeight }}
            >
              <span
                className="comparison-value"
                style={{ fontSize: valueFontSize }}
              >
                {valueText}
              </span>
              <span
                className={`comparison-detail ${comparison.className}`}
                style={{ fontSize: scaledDetailFontSize }}
              >
                <span className="comparison-percentage">{percentText}</span>
                {comparison.label && (
                  <span className="comparison-label"> {comparison.label}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  render() {
    const {
      className = '',
      height,
      headerFontSize,
      subheaderFontSize,
    } = this.props;
    const headerHeight = Math.ceil(headerFontSize * height);
    const comparisonHeight = Math.max(
      0,
      height - headerHeight - Math.ceil(subheaderFontSize * height * 0.4),
    );

    return (
      <div
        className={`superset-legacy-chart-big-number-v2 ${className}`}
        style={{ height }}
      >
        {this.renderHeader(headerHeight)}
        {this.renderComparisonRows(comparisonHeight)}
      </div>
    );
  }
}

export default styled(BigNumberV2Viz)`
  ${({ theme }) => `
    font-family: ${theme.typography.families.sansSerif};
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    overflow: hidden;

    .header-line {
      color: ${theme.colors.grayscale.dark2};
      line-height: 1em;
      white-space: nowrap;
    }

    .comparison-list {
      display: flex;
      flex-direction: column;
      justify-content: center;
      width: 100%;
    }

    .comparison-row {
      align-items: center;
      display: flex;
      column-gap: ${theme.gridUnit * 2}px;
      line-height: 1;
      min-height: ${theme.gridUnit * 8}px;
      width: 100%;
    }

    .comparison-value {
      color: ${theme.colors.grayscale.dark2};
      flex: 0 0 auto;
      // margin-right: ${theme.gridUnit * 3}px;
      white-space: nowrap;
    }

    .comparison-detail {
      color: ${theme.colors.grayscale.dark1};
      flex: 1 1 auto;
      min-width: 0;
      white-space: nowrap;
    }

    .comparison-percentage,
    .comparison-label {
      color: inherit;
    }

    .comparison-row.positive .comparison-detail,
    .comparison-row.positive .comparison-percentage,
    .comparison-row.positive .comparison-label {
      color: #288760 !important;
    }

    .comparison-row.negative .comparison-detail,
    .comparison-row.negative .comparison-percentage,
    .comparison-row.negative .comparison-label {
      color: #FF2E00 !important;
    }
  `}
`;
