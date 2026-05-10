# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

from datetime import datetime, timezone
from io import BytesIO

import pandas as pd

from superset.utils.excel import df_to_excel


def test_timezone_conversion() -> None:
    """
    Test that columns with timezones are converted to a string.
    """
    df = pd.DataFrame({"dt": [datetime(2023, 1, 1, 0, 0, tzinfo=timezone.utc)]})
    contents = df_to_excel(df)
    assert pd.read_excel(contents)["dt"][0] == "2023-01-01 00:00:00+00:00"


def test_extra_sheets() -> None:
    """
    Test that extra sheets are written without changing the main data sheet.
    """
    df = pd.DataFrame({"name": ["Alice"], "value": [1]})
    metadata = pd.DataFrame(
        {"Field": ["Exported by", "Export date"], "Value": ["admin", "2026-05-10"]}
    )

    contents = df_to_excel(df, extra_sheets={"Export Metadata": metadata}, index=False)

    workbook = pd.ExcelFile(BytesIO(contents))
    assert workbook.sheet_names == ["Sheet1", "Export Metadata"]
    assert pd.read_excel(workbook, sheet_name="Sheet1").to_dict("records") == [
        {"name": "Alice", "value": 1}
    ]
    assert pd.read_excel(workbook, sheet_name="Export Metadata").to_dict(
        "records"
    ) == [
        {"Field": "Exported by", "Value": "admin"},
        {"Field": "Export date", "Value": "2026-05-10"},
    ]
