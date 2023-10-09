/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import { registerAdvisorFactory } from "../advisor";
import { ShowSuggestionAction } from "../actions/show_suggestion";
import { Recipe } from "../recipe";
import { ErrorAdviseRequest } from "../advise_requests/common_requests";
import {
  IAdviseRequest,
  IAdviseResult,
  IAdvisorFactory,
  IAdvisor,
  Project as IProject,
} from "webinizer";

class ErrorsNotHandledAdvisorFactory implements IAdvisorFactory {
  name = "ErrorsNotHandledAdvisorFactory";
  desc = "Use this factory class to create ErrorsNotHandledAdvisor instance";

  createAdvisor(): IAdvisor {
    return new ErrorsNotHandledAdvisor();
  }
}

class ErrorsNotHandledAdvisor implements IAdvisor {
  static __type__ = "ErrorsNotHandledAdvisor";
  type = ErrorsNotHandledAdvisor.__type__;
  desc = "Default advisor for errors not handled by Webinizer";

  private async _generateRecipeToShowErrors(
    proj: IProject,
    req: ErrorAdviseRequest
  ): Promise<IAdviseResult> {
    const action = new ShowSuggestionAction(
      "error",
      `This error is \`not\` handled by Webinizer, please try to resolve it manually:\n\n\`\`\`\n${req.error}\n\`\`\``,
      null,
      req.location ? req.location.toFileRegion() : null
    );

    return {
      handled: true,
      recipe: new Recipe(proj, "Recipe for errors not handled by Webinizer", this, req, action),
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
      return this._generateRecipeToShowErrors(proj, errorReq);
    }
    return {
      handled: false,
    };
  }
}

// loading
export default function onload() {
  registerAdvisorFactory(ErrorsNotHandledAdvisor.__type__, new ErrorsNotHandledAdvisorFactory());
}
