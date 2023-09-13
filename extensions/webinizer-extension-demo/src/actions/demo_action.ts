/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import * as webinizer from "webinizer";

export class DemoAction implements webinizer.IAction {
  static __type__ = "DemoAction";
  type: string = DemoAction.__type__;
  desc: string;

  constructor(desc: string) {
    this.desc = desc;
  }

  async apply(): Promise<boolean> {
    return false;
  }
  toJson(): webinizer.IJsonObject {
    return {
      __type__: DemoAction.__type__,
      desc: this.desc,
    };
  }

  static fromJson(proj: webinizer.Project, o: webinizer.IJsonObject): DemoAction {
    webinizer.checkJsonType(DemoAction.__type__, o);
    return new DemoAction(o.desc as string);
  }
}

export default function onload() {
  webinizer.ALL_ACTION_FACTORIES.register(DemoAction.__type__, DemoAction.fromJson);
}
