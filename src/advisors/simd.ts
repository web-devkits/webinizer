/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import * as H from "../helper";
import * as C from "../constants";
import { registerAdvisorFactory } from "../advisor";
import { Recipe } from "../recipe";
import { ErrorAdviseRequest } from "../advise_requests/common_requests";
import { ConfigOptionChangeAction } from "../actions/config_option_change";
import {
  IAdviseRequest,
  IAdviseResult,
  IAdvisorFactory,
  IAdvisor,
  Project as IProject,
} from "webinizer";

class SimdAdvisorFactory implements IAdvisorFactory {
  name = "SimdAdvisorFactory";
  desc = "Use this factory class to create SimdAdvisor instance";

  createAdvisor(): IAdvisor {
    return new SimdAdvisor();
  }
}

class SimdAdvisor implements IAdvisor {
  static __type__ = "SimdAdvisor";
  type = SimdAdvisor.__type__;
  desc = "Advise issues related to SIMD";

  private async _generateSimdAdvise(
    proj: IProject,
    req: ErrorAdviseRequest
  ): Promise<IAdviseResult> {
    const action = new ConfigOptionChangeAction(
      proj,
      "If you want to port `SIMD` code targeting WebAssembly, we should enable the `SIMD support` option.",
      { needSimd: true }
    );

    return {
      handled: true,
      recipe: new Recipe(proj, "Recipe for SIMD issue", this, req, action),
    };
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  async advise(
    proj: IProject,
    req: IAdviseRequest,
    requestList: ReadonlyArray<IAdviseRequest> // one can only return newRequestQueue to change it
  ): Promise<IAdviseResult> {
    if (req instanceof ErrorAdviseRequest) {
      const ErrlogStr =
        "emcc: error: Passing any of -msse, -msse2, -msse3, -mssse3, -msse4.1, -msse4.2, -msse4, -mavx, -mfpu=neon flags also requires passing -msimd128!";
      const errorReq = req as ErrorAdviseRequest;
      if (
        (await H.findPatternInFiles(ErrlogStr, proj.root, [C.buildDir, C.dependencyDir])).length > 0
      ) {
        return this._generateSimdAdvise(proj, errorReq);
      }
    }
    return {
      handled: false,
    };
  }
}

// loading
export default function onload() {
  registerAdvisorFactory(SimdAdvisor.__type__, new SimdAdvisorFactory());
}
