/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import { registerAdvisorFactory } from "../advisor";
import { Recipe } from "../recipe";
import { PlainAdviseRequest } from "../advise_requests/common_requests";
import { findFirstBuilder } from "../builder";
import { BuildStepChangeAction, BuildStepRegion } from "../actions/build_step_change";
import {
  IAdviseRequest,
  IAdviseResult,
  IAdvisorFactory,
  IAdvisor,
  IBuilderJson,
  Project as IProject,
} from "webinizer";

class BuildStepValidateAdvisorFactory implements IAdvisorFactory {
  name = "BuildStepValidateAdvisorFactory";
  desc = "Use this factory class to create BuildStepValidateAdvisor instance";

  createAdvisor(): IAdvisor {
    return new BuildStepValidateAdvisor();
  }
}

class BuildStepValidateAdvisor implements IAdvisor {
  static __type__ = "BuildStepValidateAdvisor";
  type = BuildStepValidateAdvisor.__type__;
  desc = "Advise issues related to invalid build file path";

  private async _validateBuildSteps(
    proj: IProject,
    req: PlainAdviseRequest
  ): Promise<IAdviseResult> {
    // check if there is a 'clean' step before 'make' to ensure a clean build environment
    const makeIdx = findFirstBuilder(proj, "MakeBuilder");
    const rawBuilders = proj.config.getBuildConfigForTarget(proj.config.target).rawBuilders;
    if (makeIdx >= 0 && rawBuilders) {
      const builder = rawBuilders[makeIdx];
      if (!(builder.args as string).includes("clean")) {
        // add action to insert an 'clean' step before actual make
        const newBuilder: IBuilderJson = {
          __type__: "MakeBuilder",
          id: 0 /* set to default 0 as this will be re-set in next build*/,
          desc: "Make",
          args: "clean",
          rootBuildFilePath: builder.rootBuildFilePath as string,
        };
        const action = new BuildStepChangeAction(
          proj,
          "Add a `make clean` step before `make` to ensure a clean build environment.",
          new BuildStepRegion(makeIdx),
          [newBuilder]
        );
        return {
          handled: true,
          recipe: new Recipe(proj, "Recipe for changing build steps", this, req, action, true),
          needPropagation: true,
        };
      }
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
    if (
      req instanceof PlainAdviseRequest &&
      !proj.config.getBuildConfigForTarget(proj.config.target).getDisabledAdvisorFlag(this.type)
    ) {
      const plainReq = req as PlainAdviseRequest;
      return this._validateBuildSteps(proj, plainReq);
    }
    return {
      handled: false,
    };
  }
}

// loading
export default function onload() {
  registerAdvisorFactory(BuildStepValidateAdvisor.__type__, new BuildStepValidateAdvisorFactory());
}
