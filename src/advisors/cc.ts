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

class CCompilerAdvisorFactory implements IAdvisorFactory {
  name = "CCompilerAdvisorFactory";
  desc = "Use this factory class to create CCompilerAdvisor instance";

  createAdvisor(): IAdvisor {
    return new CCompilerAdvisor();
  }
}

class CCompilerAdvisor implements IAdvisor {
  static __type__ = "CCompilerAdvisor";
  type = CCompilerAdvisor.__type__;
  desc = "Advise issues related to C compiler";

  private _getSuggestionExample(): SuggestionExample {
    const before = `./configure\n --target-os=none\n --arch=x86_32`;
    const after = `./configure\n --target-os=none\n --arch=x86_32\n --cc=emcc`;
    return new SuggestionExample(before, after);
  }

  private async _fixCCompilerErr(proj: IProject, req: ErrorAdviseRequest): Promise<IAdviseResult> {
    const action = new ShowSuggestionAction(
      "error",
      `You're using \`gcc\` instead of \`emcc\`, which is a drop-in replacement for a standard compiler (like gcc or clang) to compile to WebAssembly. Please check if the build system has it hardcoded (i.e., cc_default="gcc"), or requires you to pass an option to specify \`emcc\` instead.`,
      this._getSuggestionExample(),
      null
    );

    return {
      handled: true,
      recipe: new Recipe(proj, "Recipe for C Compiler issue", this, req, action),
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
        errorReq.error.includes("C compiler test failed") &&
        errorReq.error.includes("gcc is unable to create an executable file")
      ) {
        return this._fixCCompilerErr(proj, errorReq);
      }
    }
    return {
      handled: false,
    };
  }
}

// loading
export default function onload() {
  registerAdvisorFactory(CCompilerAdvisor.__type__, new CCompilerAdvisorFactory());
}
