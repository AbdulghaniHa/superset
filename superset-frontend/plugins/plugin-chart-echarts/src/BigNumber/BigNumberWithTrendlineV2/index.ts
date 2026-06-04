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
import { t, Behavior } from '@superset-ui/core';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import buildQuery from './buildQuery';
import example from '../BigNumberTotal/images/BigNumber.jpg';
import thumbnail from '../BigNumberTotal/images/thumbnail.png';
import {
  BigNumberWithTrendlineV2ChartProps,
  BigNumberWithTrendlineV2FormData,
} from '../types';
import { EchartsChartPlugin } from '../../types';

const metadata = {
  category: t('KPI'),
  description: t(
    'Showcases one main KPI with two query-driven comparison values and calculated percentage deltas.',
  ),
  exampleGallery: [{ url: example }],
  name: t('Big Number with Trendline V2'),
  tags: [t('KPI'), t('Percentages'), t('Report'), t('Description'), t('Trend')],
  thumbnail,
  behaviors: [Behavior.DrillToDetail],
};

export default class BigNumberWithTrendlineV2ChartPlugin extends EchartsChartPlugin<
  BigNumberWithTrendlineV2FormData,
  BigNumberWithTrendlineV2ChartProps
> {
  constructor() {
    super({
      loadChart: () => import('./BigNumberV2Viz'),
      metadata,
      buildQuery,
      transformProps,
      controlPanel,
    });
  }
}
