/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import { BaseBuildOption, registerOption } from "../option";
import { BuildOptionType, IProjectBuildOptions } from "webinizer";

class MainLoopOption extends BaseBuildOption {
  static __type__: BuildOptionType = "needMainLoop";
  constructor(name: BuildOptionType, data: IProjectBuildOptions) {
    if (name === MainLoopOption.__type__) super(name, data);
  }
}

// loading
export default function onload() {
  registerOption(MainLoopOption.__type__, MainLoopOption);
}
