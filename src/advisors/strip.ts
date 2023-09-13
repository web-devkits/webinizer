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

class StripAdvisorFactory implements IAdvisorFactory {
  name = "StripAdvisorFactory";
  desc = "Use this factory class to create StripAdvisor instance";

  createAdvisor(): IAdvisor {
    return new StripAdvisor();
  }
}

class StripAdvisor implements IAdvisor {
  static __type__ = "StripAdvisor";
  type = StripAdvisor.__type__;
  desc = "Advise issues related to file strip";

  private _getSuggestionExample(): SuggestionExample {
    const before = `./configure\n --target-os=none\n --arch=x86_32`;
    const after = `./configure\n --target-os=none\n --arch=x86_32\n --disable-stripping`;
    return new SuggestionExample(before, after);
  }

  private async _generateStripAdvise(
    proj: IProject,
    req: ErrorAdviseRequest
  ): Promise<IAdviseResult> {
    const action = new ShowSuggestionAction(
      "error",
      "Native tools such as `GNU strip` are not aware of the WebAssembly object format and cannot create archive indexes. Please disable strip if possible.",
      this._getSuggestionExample(),
      null
    );

    return {
      handled: true,
      recipe: new Recipe(proj, "Recipe for strip issue", this, req, action),
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
      const lines = errorReq.error.split("\n");
      const stripReg = /strip:.* (File|file) format not recognized/;
      for (const line of lines) {
        if (line.match(stripReg)) return this._generateStripAdvise(proj, errorReq);
      }
    }
    return {
      handled: false,
    };
  }
}

// loading
export default function onload() {
  registerAdvisorFactory(StripAdvisor.__type__, new StripAdvisorFactory());
}
