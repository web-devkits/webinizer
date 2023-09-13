/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import { init } from "../src/init";

async function initTests() {
  try {
    await init();
  } catch (e) {
    // stop running tests if initialization failed.
    process.exit();
  }
}

initTests();

import "./action_tests";
import "./advisor_tests";
import "./builder_tests";
