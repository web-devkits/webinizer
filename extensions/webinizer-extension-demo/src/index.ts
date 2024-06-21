/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import * as webinizer from "webinizer";
import path from "path";

const builderPath = path.join(__dirname, "builders");
const advisorPath = path.join(__dirname, "advisors");
const actionPath = path.join(__dirname, "actions");
const moduleDirectories = [builderPath, advisorPath, actionPath];

export default async function load() {
  for (const md of moduleDirectories) {
    await webinizer.loadAllModulesInDirectory(md);
  }
}
