/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import { registerAdvisorFactory } from "../advisor";
import { Recipe } from "../recipe";
import { ErrorAdviseRequest } from "../advise_requests/common_requests";
import { ShowSuggestionAction, SuggestionExample } from "../actions/show_suggestion";
import {
  IAdviseRequest,
  IAdviseResult,
  IAdvisorFactory,
  IAdvisor,
  Project as IProject,
} from "webinizer";

class RanlibAdvisorFactory implements IAdvisorFactory {
  name = "RanlibAdvisorFactory";
  desc = "Use this factory class to create RanlibAdvisor instance";

  createAdvisor(): IAdvisor {
    return new RanlibAdvisor();
  }
}

class RanlibAdvisor implements IAdvisor {
  static __type__ = "RanlibAdvisor";
  type = RanlibAdvisor.__type__;
  desc = "Advise issues related to ranlib";

  private _getSuggestionExample(): SuggestionExample {
    const before = `./configure\n --target-os=none\n --arch=x86_32`;
    const after = `./configure\n --target-os=none\n --arch=x86_32\n --ranlib=emranlib`;
    return new SuggestionExample(before, after);
  }

  private async _fixRanlibErr(proj: IProject, req: ErrorAdviseRequest): Promise<IAdviseResult> {
    const action = new ShowSuggestionAction(
      "error",
      `You're using the system \`ranlib\` instead of \`emranlib\` (which calls llvm-ranlib).Please check if the build system has it hardcoded (i.e., ranlib_default="ranlib"), or requires you to pass an option to use \`emranlib\` instead.`,
      this._getSuggestionExample(),
      null
    );

    return {
      handled: true,
      recipe: new Recipe(proj, "Recipe for ranlib issue", this, req, action),
    };
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
        errorReq.error.includes("wasm-ld: error: ") &&
        errorReq.error.includes("archive has no index; run ranlib to add one")
      ) {
        return this._fixRanlibErr(proj, errorReq);
      }
    }
    return {
      handled: false,
    };
  }
}

// loading
export default function onload() {
  registerAdvisorFactory(RanlibAdvisor.__type__, new RanlibAdvisorFactory());
}
