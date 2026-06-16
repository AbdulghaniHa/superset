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
import { CHART_TYPE } from './componentTypes';
import { DASHBOARD_ROOT_ID } from './constants';

export default function getChartIdsFromLayout(layout) {
  const chartIds = [];

  function visit(componentId) {
    const component = layout[componentId];

    if (!component) {
      return;
    }

    if (
      component.type === CHART_TYPE &&
      component.meta &&
      component.meta.chartId
    ) {
      chartIds.push(component.meta.chartId);
      return;
    }

    (component.children || []).forEach(visit);
  }

  if (layout[DASHBOARD_ROOT_ID]) {
    visit(DASHBOARD_ROOT_ID);
    Object.values(layout).forEach(component => {
      if (
        component &&
        component.type === CHART_TYPE &&
        component.meta &&
        component.meta.chartId &&
        !chartIds.includes(component.meta.chartId)
      ) {
        chartIds.push(component.meta.chartId);
      }
    });
    return chartIds;
  }

  return Object.values(layout).reduce((ids, currentComponent) => {
    if (
      currentComponent &&
      currentComponent.type === CHART_TYPE &&
      currentComponent.meta &&
      currentComponent.meta.chartId
    ) {
      ids.push(currentComponent.meta.chartId);
    }
    return ids;
  }, []);
}
