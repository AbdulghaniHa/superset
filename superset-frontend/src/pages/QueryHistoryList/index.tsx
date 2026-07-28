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
import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactElement,
} from 'react';
import { Link, useHistory } from 'react-router-dom';
import {
  QueryState,
  styled,
  SupersetClient,
  t,
  useTheme,
} from '@superset-ui/core';
import moment from 'moment';
import {
  createFetchRelated,
  createFetchDistinct,
  createErrorHandler,
  shortenSQL,
} from 'src/views/CRUD/utils';
import withToasts from 'src/components/MessageToasts/withToasts';
import { useListViewResource } from 'src/views/CRUD/hooks';
import Label from 'src/components/Label';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import Popover from 'src/components/Popover';
import { commonMenuData } from 'src/features/home/commonMenuData';
import ListView, {
  Filters,
  FilterOperator,
  ListViewProps,
} from 'src/components/ListView';
import { Tooltip } from 'src/components/Tooltip';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/cjs/light';
import sql from 'react-syntax-highlighter/dist/cjs/languages/hljs/sql';
import github from 'react-syntax-highlighter/dist/cjs/styles/hljs/github';
import { DATETIME_WITH_TIME_ZONE, TIME_WITH_MS } from 'src/constants';
import { QueryObject, QueryObjectColumns } from 'src/views/CRUD/types';

import Icons from 'src/components/Icons';
import QueryPreviewModal from 'src/features/queries/QueryPreviewModal';
import getOwnerName from 'src/utils/getOwnerName';
import Button from 'src/components/Button';
import Modal from 'src/components/Modal';

const PAGE_SIZE = 25;
const SQL_PREVIEW_MAX_LINES = 4;
const ACTIVE_QUERY_REFRESH_INTERVAL = 5000;
const ACTIVE_QUERY_STATES = new Set([
  QueryState.Started,
  QueryState.Pending,
  QueryState.Scheduled,
  QueryState.Running,
  QueryState.Fetching,
]);

const TopAlignedListView = styled(ListView)<ListViewProps<QueryObject>>`
  table .table-cell {
    vertical-align: top;
  }
`;

SyntaxHighlighter.registerLanguage('sql', sql);
const StyledSyntaxHighlighter = styled(SyntaxHighlighter)`
  height: ${({ theme }) => theme.gridUnit * 26}px;
  overflow: hidden !important; /* needed to override inline styles */
  text-overflow: ellipsis;
  white-space: nowrap;
`;

interface QueryListProps {
  addDangerToast: (msg: string, config?: any) => any;
  addSuccessToast: (msg: string, config?: any) => any;
}

const StyledTableLabel = styled.div`
  .count {
    margin-left: 5px;
    color: ${({ theme }) => theme.colors.primary.base};
    text-decoration: underline;
    cursor: pointer;
  }
`;

const StyledPopoverItem = styled.div`
  color: ${({ theme }) => theme.colors.grayscale.dark2};
`;

const TimerLabel = styled(Label)`
  text-align: left;
  font-family: ${({ theme }) => theme.typography.families.monospace};
`;

function QueryList({ addDangerToast, addSuccessToast }: QueryListProps) {
  const {
    state: { loading, resourceCount: queryCount, resourceCollection: queries },
    fetchData,
    refreshData,
  } = useListViewResource<QueryObject>(
    'query',
    t('Query history'),
    addDangerToast,
    false,
  );

  const [queryCurrentlyPreviewing, setQueryCurrentlyPreviewing] =
    useState<QueryObject>();
  const [stoppingQueryId, setStoppingQueryId] = useState<number>();

  const refreshDataRef = useRef(refreshData);
  const hasActiveQueriesRef = useRef(false);
  refreshDataRef.current = refreshData;
  hasActiveQueriesRef.current = queries.some(({ status }) =>
    ACTIVE_QUERY_STATES.has(status),
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (
        document.visibilityState === 'visible' &&
        hasActiveQueriesRef.current
      ) {
        refreshDataRef.current();
      }
    }, ACTIVE_QUERY_REFRESH_INTERVAL);

    return () => window.clearInterval(interval);
  }, []);

  const theme = useTheme();
  const history = useHistory();

  const handleQueryPreview = useCallback(
    (id: number) => {
      SupersetClient.get({
        endpoint: `/api/v1/query/${id}`,
      }).then(
        ({ json = {} }) => {
          setQueryCurrentlyPreviewing({ ...json.result });
        },
        createErrorHandler(errMsg =>
          addDangerToast(
            t('There was an issue previewing the selected query. %s', errMsg),
          ),
        ),
      );
    },
    [addDangerToast],
  );

  const handleStopQuery = useCallback(
    (query: QueryObject) => {
      Modal.confirm({
        title: t('Stop this query?'),
        content: t(
          'Superset will ask the database to cancel this query. Cancellation may not be supported by every database.',
        ),
        okText: t('Stop query'),
        cancelText: t('Keep running'),
        onOk: () => {
          setStoppingQueryId(query.id);
          return SupersetClient.post({
            endpoint: '/api/v1/query/stop',
            body: JSON.stringify({ client_id: query.client_id }),
            headers: { 'Content-Type': 'application/json' },
          })
            .then(() => {
              addSuccessToast(t('Query was stopped.'));
              return refreshDataRef.current();
            })
            .catch(
              createErrorHandler(errMsg =>
                addDangerToast(t('Failed to stop query: %s', errMsg)),
              ),
            )
            .finally(() => setStoppingQueryId(undefined));
        },
      });
    },
    [addDangerToast, addSuccessToast],
  );

  const menuData: SubMenuProps = {
    activeChild: 'Query history',
    ...commonMenuData,
  };

  const initialSort = [{ id: QueryObjectColumns.StartTime, desc: true }];
  const columns = useMemo(
    () => [
      {
        Cell: ({
          row: {
            original: { status },
          },
        }: {
          row: {
            original: {
              status: QueryState;
            };
          };
        }) => {
          const statusConfig: {
            name: ReactElement | null;
            label: string;
          } = {
            name: null,
            label: '',
          };
          if (status === QueryState.Success) {
            statusConfig.name = (
              <Icons.Check iconColor={theme.colors.success.base} />
            );
            statusConfig.label = t('Success');
          } else if (status === QueryState.Failed) {
            statusConfig.name = (
              <Icons.XSmall iconColor={theme.colors.error.base} />
            );
            statusConfig.label = t('Failed');
          } else if (status === QueryState.Stopped) {
            statusConfig.name = (
              <Icons.XSmall iconColor={theme.colors.grayscale.base} />
            );
            statusConfig.label = t('Stopped');
          } else if (
            status === QueryState.Running ||
            status === QueryState.Started
          ) {
            statusConfig.name = (
              <Icons.Running iconColor={theme.colors.primary.base} />
            );
            statusConfig.label = t('Running');
          } else if (status === QueryState.TimedOut) {
            statusConfig.name = (
              <Icons.Offline iconColor={theme.colors.grayscale.light1} />
            );
            statusConfig.label = t('Offline');
          } else if (status === QueryState.Fetching) {
            statusConfig.name = (
              <Icons.Queued iconColor={theme.colors.primary.base} />
            );
            statusConfig.label = t('Fetching');
          } else if (status === QueryState.Scheduled) {
            statusConfig.name = (
              <Icons.Queued iconColor={theme.colors.grayscale.base} />
            );
            statusConfig.label = t('Scheduled');
          } else if (status === QueryState.Pending) {
            statusConfig.name = (
              <Icons.Queued iconColor={theme.colors.grayscale.base} />
            );
            statusConfig.label = t('Pending');
          }
          return (
            <Tooltip title={statusConfig.label} placement="bottom">
              <span>{statusConfig.name}</span>
            </Tooltip>
          );
        },
        accessor: QueryObjectColumns.Status,
        size: 'xs',
        disableSortBy: true,
      },
      {
        accessor: QueryObjectColumns.StartTime,
        Header: t('Time'),
        size: 'xl',
        Cell: ({
          row: {
            original: { start_time },
          },
        }: any) => {
          const startMoment = moment.utc(start_time).local();
          const formattedStartTimeData = startMoment
            .format(DATETIME_WITH_TIME_ZONE)
            .split(' ');

          const formattedStartTime = (
            <>
              {formattedStartTimeData[0]} <br />
              {formattedStartTimeData[1]}
            </>
          );
          return formattedStartTime;
        },
      },
      {
        Header: t('Duration'),
        size: 'xl',
        Cell: ({
          row: {
            original: { status, start_time, end_time },
          },
        }: any) => {
          const timerType = status === QueryState.Failed ? 'danger' : status;
          const durationEnd = ACTIVE_QUERY_STATES.has(status)
            ? Date.now()
            : end_time;
          const timerTime = durationEnd
            ? moment(moment.utc(durationEnd - start_time)).format(TIME_WITH_MS)
            : '00:00:00.000';
          return (
            <TimerLabel type={timerType} role="timer">
              {timerTime}
            </TimerLabel>
          );
        },
      },
      {
        accessor: QueryObjectColumns.TabName,
        Header: t('Tab name'),
        size: 'xl',
      },
      {
        accessor: QueryObjectColumns.DatabaseName,
        Header: t('Database'),
        size: 'xl',
      },
      {
        accessor: QueryObjectColumns.Database,
        hidden: true,
      },
      {
        accessor: QueryObjectColumns.Schema,
        Header: t('Schema'),
        size: 'xl',
      },
      {
        Cell: ({
          row: {
            original: { sql_tables: tables = [] },
          },
        }: any) => {
          const names = tables.map((table: any) => table.table);
          const main = names.length > 0 ? names.shift() : '';

          if (names.length) {
            return (
              <StyledTableLabel>
                <span>{main}</span>
                <Popover
                  placement="right"
                  title={t('TABLES')}
                  trigger="click"
                  content={
                    <>
                      {names.map((name: string) => (
                        <StyledPopoverItem key={name}>{name}</StyledPopoverItem>
                      ))}
                    </>
                  }
                >
                  <span className="count">(+{names.length})</span>
                </Popover>
              </StyledTableLabel>
            );
          }

          return main;
        },
        accessor: QueryObjectColumns.SqlTables,
        Header: t('Tables'),
        size: 'xl',
        disableSortBy: true,
      },
      {
        accessor: QueryObjectColumns.UserFirstName,
        Header: t('User'),
        size: 'xl',
        Cell: ({
          row: {
            original: { user },
          },
        }: any) => getOwnerName(user),
      },
      {
        accessor: QueryObjectColumns.User,
        hidden: true,
      },
      {
        accessor: QueryObjectColumns.Rows,
        Header: t('Rows'),
        size: 'md',
      },
      {
        accessor: QueryObjectColumns.Sql,
        Header: t('SQL'),
        Cell: ({ row: { original, id } }: any) => (
          <div
            tabIndex={0}
            role="button"
            data-test={`open-sql-preview-${id}`}
            onClick={() => setQueryCurrentlyPreviewing(original)}
          >
            <StyledSyntaxHighlighter language="sql" style={github}>
              {shortenSQL(original.sql, SQL_PREVIEW_MAX_LINES)}
            </StyledSyntaxHighlighter>
          </div>
        ),
      },
      {
        Header: t('Actions'),
        id: 'actions',
        disableSortBy: true,
        Cell: ({ row: { original: query } }: any) => (
          <div>
            <Tooltip title={t('Open query in SQL Lab')} placement="bottom">
              <Link to={`/sqllab?queryId=${query.id}`}>
                <Icons.Full iconColor={theme.colors.grayscale.base} />
              </Link>
            </Tooltip>
            {ACTIVE_QUERY_STATES.has(query.status) && (
              <Button
                buttonStyle="link"
                buttonSize="small"
                data-test={`stop-query-${query.id}`}
                disabled={stoppingQueryId === query.id}
                loading={stoppingQueryId === query.id}
                onClick={() => handleStopQuery(query)}
                tooltip={t('Stop query')}
                aria-label={t('Stop query')}
              >
                <Icons.StopOutlined iconColor={theme.colors.error.base} />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [handleStopQuery, stoppingQueryId, theme],
  );

  const filters: Filters = useMemo(
    () => [
      {
        Header: t('Database'),
        key: 'database',
        id: 'database',
        input: 'select',
        operator: FilterOperator.RelationOneMany,
        unfilteredLabel: t('All'),
        fetchSelects: createFetchRelated(
          'query',
          'database',
          createErrorHandler(errMsg =>
            addDangerToast(
              t('An error occurred while fetching database values: %s', errMsg),
            ),
          ),
        ),
        paginate: true,
      },
      {
        Header: t('State'),
        key: 'state',
        id: 'status',
        input: 'select',
        operator: FilterOperator.Equals,
        unfilteredLabel: 'All',
        fetchSelects: createFetchDistinct(
          'query',
          'status',
          createErrorHandler(errMsg =>
            addDangerToast(
              t('An error occurred while fetching schema values: %s', errMsg),
            ),
          ),
        ),
        paginate: true,
      },
      {
        Header: t('User'),
        key: 'user',
        id: 'user',
        input: 'select',
        operator: FilterOperator.RelationOneMany,
        unfilteredLabel: 'All',
        fetchSelects: createFetchRelated(
          'query',
          'user',
          createErrorHandler(errMsg =>
            addDangerToast(
              t('An error occurred while fetching user values: %s', errMsg),
            ),
          ),
        ),
        paginate: true,
      },
      {
        Header: t('Time range'),
        key: 'start_time',
        id: 'start_time',
        input: 'datetime_range',
        operator: FilterOperator.Between,
      },
      {
        Header: t('Search by query text'),
        key: 'sql',
        id: 'sql',
        input: 'search',
        operator: FilterOperator.Contains,
      },
    ],
    [addDangerToast],
  );

  return (
    <>
      <SubMenu {...menuData} />
      {queryCurrentlyPreviewing && (
        <QueryPreviewModal
          onHide={() => setQueryCurrentlyPreviewing(undefined)}
          query={queryCurrentlyPreviewing}
          queries={queries}
          fetchData={handleQueryPreview}
          openInSqlLab={(id: number) => history.push(`/sqllab?queryId=${id}`)}
          show
        />
      )}
      <TopAlignedListView
        className="query-history-list-view"
        columns={columns}
        count={queryCount}
        data={queries}
        fetchData={fetchData}
        filters={filters}
        initialSort={initialSort}
        loading={loading}
        pageSize={PAGE_SIZE}
        highlightRowId={queryCurrentlyPreviewing?.id}
        refreshData={refreshData}
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
      />
    </>
  );
}

export default withToasts(QueryList);
