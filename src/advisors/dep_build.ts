/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import { registerAdvisorFactory } from "../advisor";
import { Recipe } from "../recipe";
import { PlainAdviseRequest } from "../advise_requests/common_requests";
import { ShowDepRecipeAction } from "../actions/show_dep_recipe";
import {
  IAdviseRequest,
  IAdviseResult,
  IAdvisorFactory,
  IAdvisor,
  Project as IProject,
} from "webinizer";

class DepBuildAdvisorFactory implements IAdvisorFactory {
  name = "DepBuildAdvisorFactory";
  desc = "Use this factory class to create DepBuildAdvisor instance";

  createAdvisor(): IAdvisor {
    return new DepBuildAdvisor();
  }
}

class DepBuildAdvisor implements IAdvisor {
  static __type__ = "DepBuildAdvisor";
  type = DepBuildAdvisor.__type__;
  desc = "Advisor to handle recipes generated from dependent projects build";

  private async _generateRecipeForDepBuild(
    proj: IProject,
    req: PlainAdviseRequest
  ): Promise<IAdviseResult> {
    if (req.plainData) {
      const action = new ShowDepRecipeAction(
        "Recipes are generated for below dependent projects. Please go to the corresponding page of each dependent project for more details.",
        Array.isArray(req.plainData) ? req.plainData : [req.plainData]
      );
      return {
        handled: true,
        recipe: new Recipe(proj, "Recipes generated for dependent projects", this, req, action),
      };
    }
    return {
      handled: false,
    };
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  async advise(
    proj: IProject,
    req: IAdviseRequest,
    requestList: ReadonlyArray<IAdviseRequest> // one can only return newRequestQueue to change it
  ): Promise<IAdviseResult> {
    if (req instanceof PlainAdviseRequest) {
      const plainReq = req as PlainAdviseRequest;
      return this._generateRecipeForDepBuild(proj, plainReq);
    }
    return {
      handled: false,
    };
  }
}

// loading
export default function onload() {
  registerAdvisorFactory(DepBuildAdvisor.__type__, new DepBuildAdvisorFactory());
}
