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

class HeaderMissingAdvisorFactory implements IAdvisorFactory {
  name = "HeaderMissingAdvisorFactory";
  desc = "Use this factory class to create HeaderMissingAdvisor instance";

  createAdvisor(): IAdvisor {
    return new HeaderMissingAdvisor();
  }
}

class HeaderMissingAdvisor implements IAdvisor {
  static __type__ = "HeaderMissingAdvisor";
  type = HeaderMissingAdvisor.__type__;
  desc = "Advise issues related to missing header files.";

  private async _generateHeaderMissingAdvise(
    proj: IProject,
    req: ErrorAdviseRequest,
    errorMsg: string
  ): Promise<IAdviseResult> {
    const searchStr = errorMsg.slice(errorMsg.indexOf("fatal error"));
    const suggestionContent = `A header file is missing. There might be several reasons:\n
- The related library is \`not\` installed. You can search \`${searchStr}\` in Google and find out which library is missing. Note that the library should be built by emscripten. If this library has no emscripten-built precompiled binary available online, you could download the source code and try to build it with Webinizer.
- If the library has already been installed, then the reason may be that the header directory is not included in compiler/linker flags, please add \`-I\${HEADER_PATH}\` to compiler/linker flags while building.`;
    const action = new ShowSuggestionAction(
      "error",
      `**Error log**\n\n\`\`\`${errorMsg}\`\`\`\n\n${suggestionContent}`,
      null,
      null
    );

    return {
      handled: true,
      recipe: new Recipe(proj, "Recipe for issue of missing header file", this, req, action),
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
      const headerMissReg = /fatal error: '.*.h' file not found/;
      for (const line of lines) {
        if (line.match(headerMissReg))
          return this._generateHeaderMissingAdvise(proj, errorReq, line);
      }
    }
    return {
      handled: false,
    };
  }
}

// loading
export default function onload() {
  registerAdvisorFactory(HeaderMissingAdvisor.__type__, new HeaderMissingAdvisorFactory());
}
