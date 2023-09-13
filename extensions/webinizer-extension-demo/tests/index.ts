/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import * as webinizer from "webinizer";

async function initTests() {
  try {
    await webinizer.init();
  } catch (e) {
    // stop running tests if initialization failed.
    process.exit();
  }
}

initTests();

import "./demo_action_tests";
import "./demo_advisor_tests";
import "./demo_builder_tests";
