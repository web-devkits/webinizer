/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import * as H from "../helper";
import * as C from "../constants";
import { registerAdvisorFactory } from "../advisor";
import { ShowSuggestionAction, SuggestionExample } from "../actions/show_suggestion";
import { Recipe } from "../recipe";
import { ErrorAdviseRequest } from "../advise_requests/common_requests";
import {
  IAdviseRequest,
  IAdviseResult,
  IAdvisorFactory,
  IAdvisor,
  Project as IProject,
} from "webinizer";

class BuildTargetSpecifyAdvisorFactory implements IAdvisorFactory {
  name = "BuildTargetSpecifyAdvisorFactory";
  desc = "Use this factory class to create BuildTargetSpecifyAdvisor instance";

  createAdvisor(): IAdvisor {
    return new BuildTargetSpecifyAdvisor();
  }
}

class BuildTargetSpecifyAdvisor implements IAdvisor {
  static __type__ = "BuildTargetSpecifyAdvisor";
  type = BuildTargetSpecifyAdvisor.__type__;
  desc = "Advise issues related to host specification";

  private _getSuggestionExample(): SuggestionExample {
    const before = `./configure\n --enable-static\n --disable-cli`;
    const after = `./configure\n --enable-static\n --disable-cli\n --host=i686-gnu`;
    return new SuggestionExample(before, after);
  }

  private async _generateBuildTargetSpecifyAdvise(
    proj: IProject,
    req: ErrorAdviseRequest
  ): Promise<IAdviseResult> {
    const action = new ShowSuggestionAction(
      "error",
      "Please specify the build target as `32-bit` architecture while configuring the build, i.e., `x86_32`, `i686`, etc.",
      this._getSuggestionExample(),
      null
    );

    return {
      handled: true,
      recipe: new Recipe(proj, "Recipe for build target specification issue", this, req, action),
    };
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  async advise(
    proj: IProject,
    req: IAdviseRequest,
    requestList: ReadonlyArray<IAdviseRequest> // one can only return newRequestQueue to change it
  ): Promise<IAdviseResult> {
    if (req instanceof ErrorAdviseRequest) {
      const errLogStr = "must specify -mwasm64 to process wasm64 object files";
      const errorReq = req as ErrorAdviseRequest;
      if (
        (await H.findPatternInFiles(errLogStr, proj.root, [C.buildDir, C.dependencyDir])).length > 0
      ) {
        return this._generateBuildTargetSpecifyAdvise(proj, errorReq);
      }
    }
    return {
      handled: false,
    };
  }
}

// loading
export default function onload() {
  registerAdvisorFactory(
    BuildTargetSpecifyAdvisor.__type__,
    new BuildTargetSpecifyAdvisorFactory()
  );
}
