/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

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

class InlineAsmAdvisorFactory implements IAdvisorFactory {
  name = "InlineAsmAdvisorFactory";
  desc = "Use this factory class to create InlineAsmAdvisor instance";

  createAdvisor(): IAdvisor {
    return new InlineAsmAdvisor();
  }
}

class InlineAsmAdvisor implements IAdvisor {
  static __type__ = "InlineAsmAdvisor";
  type = InlineAsmAdvisor.__type__;
  desc = "Advise issues related to inline asm";

  private _getSuggestionExample(): SuggestionExample {
    const before = `./configure\n --target-os=none\n --arch=x86_32`;
    const after = `./configure\n --target-os=none\n --arch=x86_32\n --disable-inline-asm`;
    return new SuggestionExample(before, after);
  }

  private async _generateInlineAsmAdvise(
    proj: IProject,
    req: ErrorAdviseRequest
  ): Promise<IAdviseResult> {
    const action = new ShowSuggestionAction(
      "error",
      `Code with architecture-specific inline assembly (like an \`asm()\` containing x86 code) is not portable. That code would need to be replaced with portable C or C++.\nSometimes a codebase will have both portable code and optional inline assembly as an optimization, so you might find an option to disable the inline assembly (i.e., \`--disable-inline-asm\`).`,
      this._getSuggestionExample(),
      null
    );

    return {
      handled: true,
      recipe: new Recipe(proj, "Recipe for inline assembly issue", this, req, action),
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
      if (errorReq.error.includes("in asm")) {
        return this._generateInlineAsmAdvise(proj, errorReq);
      }
    }
    return {
      handled: false,
    };
  }
}

// loading
export default function onload() {
  registerAdvisorFactory(InlineAsmAdvisor.__type__, new InlineAsmAdvisorFactory());
}
