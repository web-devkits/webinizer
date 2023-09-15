#!/bin/bash

#  Copyright (C) 2023 Intel Corporation. All rights reserved.
#  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
#  SPDX-License-Identifier: Apache-2.0

function replaceLine() {
  local LINE_PATTERN=$1
  local NEW_LINE=$2
  local FILE=$3
  local NEW=$(echo "${NEW_LINE}" | sed 's/\//\\\//g')
  touch "${FILE}"
  sed -i '/'"${LINE_PATTERN}"'/s/.*/'"${NEW}"'/' "${FILE}"
}

SERVER_DIR=`pwd`
# update WEBINIZER_HOME in src/constants.ts at first
replaceLine "export const WEBINIZER_HOME =" "export const WEBINIZER_HOME = \"${SERVER_DIR}\";" src/constants.ts
