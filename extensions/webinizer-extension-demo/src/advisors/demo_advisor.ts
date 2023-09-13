/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import * as webinizer from "webinizer";

class DemoAdvisorFactory implements webinizer.IAdvisorFactory {
  name = "DemoAdvisorFactory";
  desc = "Use this factory class to create DemoAdvisor instance";

  createAdvisor(): webinizer.IAdvisor {
    return new DemoAdvisor();
  }
}

class DemoAdvisor implements webinizer.IAdvisor {
  static __type__ = "DemoAdvisor";
  type = DemoAdvisor.__type__;
  desc = "Demo advisor for Webinizer extension demo";

  private _getSuggestionExample(): webinizer.SuggestionExample {
    const before = `This is demo advisor for Webinizer Extension Demo`;
    const after = `This is demo advisor for Webinizer Extension Demo!!!!!!`;
    return new webinizer.SuggestionExample(before, after);
  }

  private async _generateTestAdvise(
    proj: webinizer.Project,
    req: webinizer.ErrorAdviseRequest
  ): Promise<webinizer.IAdviseResult> {
    const action = new webinizer.ShowSuggestionAction(
      "error",
      `Demo Advisor for Webinizer Extension Demo.`,
      this._getSuggestionExample(),
      null
    );

    return {
      handled: true,
      recipe: new webinizer.Recipe(
        proj,
        "Recipe for demo advisor of Webinizer extension demo",
        this,
        req,
        action
      ),
    };
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  async advise(
    proj: webinizer.Project,
    req: webinizer.IAdviseRequest,
    requestList: ReadonlyArray<webinizer.IAdviseRequest> // one can only return newRequestQueue to change it
  ): Promise<webinizer.IAdviseResult> {
    if (req instanceof webinizer.ErrorAdviseRequest) {
      const errorReq = req as webinizer.ErrorAdviseRequest;
      if (errorReq.error.includes("demo builder error")) {
        return this._generateTestAdvise(proj, errorReq);
      }
    }
    return {
      handled: false,
    };
  }
}

// loading
export default function onload() {
  webinizer.registerAdvisorFactory(DemoAdvisor.__type__, new DemoAdvisorFactory());
}
