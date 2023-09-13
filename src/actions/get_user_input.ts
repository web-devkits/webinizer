/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import { IAction, IJsonObject } from "webinizer";

const ACTION_TYPE = "GetUserInputAction";
export class GetUserInputAction implements IAction {
  type = ACTION_TYPE;
  desc = "This is GetUserInputAction";
  // TODO: it should send a request to frontend and get the user input and then run the customized
  // callback to process the input
  async apply(): Promise<boolean> {
    return false;
  }
  toJson(): IJsonObject {
    return {
      __type__: this.type,
      desc: this.desc,
    };
  }
}
