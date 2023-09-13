/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import * as H from "./helper";
import { JsonFactories } from "./json_factory";
import { IAction } from "webinizer";

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
const log = H.getLogger("action");

export const ALL_ACTION_FACTORIES = new JsonFactories<IAction>("Action");
