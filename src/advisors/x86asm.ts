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

class X86AsmAdvisorFactory implements IAdvisorFactory {
  name = "X86AsmAdvisorFactory";
  desc = "Use this factory class to create X86AsmAdvisor instance";

  createAdvisor(): IAdvisor {
    return new X86AsmAdvisor();
  }
}

class X86AsmAdvisor implements IAdvisor {
  static __type__ = "X86AsmAdvisor";
  type = X86AsmAdvisor.__type__;
  desc = "Advise issues related to x86asm";

  private _getSuggestionExample(): SuggestionExample {
    const before = `./configure\n --target-os=none\n --arch=x86_32`;
    const after = `./configure\n --target-os=none\n --arch=x86_32\n --disable-x86asm`;
    return new SuggestionExample(before, after);
  }

  private async _generateAsmAdvise(
    proj: IProject,
    req: ErrorAdviseRequest
  ): Promise<IAdviseResult> {
    const action = new ShowSuggestionAction(
      "error",
      `Emscripten does \`not\` support \`x86 SIMD assembly\`, all code should be written to use SIMD intrinsic functions or compiler vector extensions. Otherwise it would need to be replaced with portable C or C++.\nSometimes a codebase will have both portable code and optional architectures-specific assembly as an optimization, so you might find an option to disable it (i.e., \`--disable-x86asm\`, \`--disable-asm\`).`,
      this._getSuggestionExample(),
      null
    );

    return {
      handled: true,
      recipe: new Recipe(proj, "Recipe for asm issue", this, req, action),
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
        errorReq.error.includes("nasm/yasm not found or too old.") ||
        (
          await H.findPatternInFiles("nasm: command not found", proj.root, [
            C.buildDir,
            C.dependencyDir,
          ])
        ).length > 0
      ) {
        return this._generateAsmAdvise(proj, errorReq);
      }
    }
    return {
      handled: false,
    };
  }
}

// loading
export default function onload() {
  registerAdvisorFactory(X86AsmAdvisor.__type__, new X86AsmAdvisorFactory());
}
