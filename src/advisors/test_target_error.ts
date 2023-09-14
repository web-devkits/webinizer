/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import { registerAdvisorFactory } from "../advisor";
import { Recipe } from "../recipe";
import { ErrorAdviseRequest } from "../advise_requests/common_requests";
import { ShowSuggestionAction } from "../actions/show_suggestion";
import {
  IAdviseRequest,
  IAdviseResult,
  IAdvisorFactory,
  IAdvisor,
  Project as IProject,
} from "webinizer";

class TestTargetErrorAdvisorFactory implements IAdvisorFactory {
  name = "TestTargetErrorAdvisorFactory";
  desc = "Use this factory class to create TestTargetErrorAdvisor instance";

  createAdvisor(): IAdvisor {
    return new TestTargetErrorAdvisor();
  }
}

class TestTargetErrorAdvisor implements IAdvisor {
  static __type__ = "TestTargetErrorAdvisor";
  type = TestTargetErrorAdvisor.__type__;
  desc = "Advise issues related to errors while building test targets with emscripten.";

  private async _fixTestTargetErr(proj: IProject, req: ErrorAdviseRequest): Promise<IAdviseResult> {
    const action = new ShowSuggestionAction(
      "error",
      `Most test related targets are aimed to build&execute with native compiler/environment and probably have errors while building with emscripten.
      You'd better remove/comment out these targets in Makefile to make the whole build process succeed.`,
      null,
      null
    );

    return {
      handled: true,
      recipe: new Recipe(
        proj,
        "Recipe for issue of errors while building test targets with emscripten",
        this,
        req,
        action
      ),
    };
  }

  private _isLeavingTestDir(errLog: string, projRoot: string): boolean {
    const lines = errLog.split("\n");
    let tempIndex = -1;

    for (let i = lines.length - 1; i > 0; i--) {
      if (lines[i].includes("Leaving directory")) {
        tempIndex = i;
        break;
      }
    }

    if (
      tempIndex > 0 &&
      lines[tempIndex]
        .slice(projRoot.length, lines[tempIndex].length)
        .toLowerCase()
        .includes("test")
    ) {
      return true;
    }

    return false;
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  async advise(
    proj: IProject,
    req: IAdviseRequest,
    requestList: ReadonlyArray<IAdviseRequest> // one can only return newRequestQueue to change it
  ): Promise<IAdviseResult> {
    if (req instanceof ErrorAdviseRequest) {
      const errorReq = req as ErrorAdviseRequest;
      if (
        errorReq.error.includes("emmake: error:") &&
        this._isLeavingTestDir(errorReq.error, proj.root)
      ) {
        return this._fixTestTargetErr(proj, errorReq);
      }
    }
    return {
      handled: false,
    };
  }
}

// loading
export default function onload() {
  registerAdvisorFactory(TestTargetErrorAdvisor.__type__, new TestTargetErrorAdvisorFactory());
}
