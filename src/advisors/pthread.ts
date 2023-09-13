/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import * as H from "../helper";
import * as C from "../constants";
import path from "path";
import { registerAdvisorFactory } from "../advisor";
import { Recipe } from "../recipe";
import { PlainAdviseRequest } from "../advise_requests/common_requests";
import { ConfigOptionChangeAction } from "../actions/config_option_change";
import {
  IAdviseRequest,
  IAdviseResult,
  IAdvisorFactory,
  IAdvisor,
  Project as IProject,
} from "webinizer";

const log = H.getLogger("PThreadAdvisor");

class PThreadAdvisorFactory implements IAdvisorFactory {
  name = "PThreadAdvisorFactory";
  desc = "Use this factory class to create PThreadAdvisor instance";

  createAdvisor(): IAdvisor {
    return new PThreadAdvisor();
  }
}

class PThreadAdvisor implements IAdvisor {
  static __type__ = "PThreadAdvisor";
  type = PThreadAdvisor.__type__;
  desc = "Advise issues related to pthread";

  private async _generatePThreadAdvise(
    proj: IProject,
    req: PlainAdviseRequest
  ): Promise<IAdviseResult> {
    const pthreadPattern = "#include <pthread.h>"; // use keyword '#include <pthread.h>' as identifier for pthread usage pattern
    const fileExt = C.C_ENDINGS.concat(C.CXX_ENDINGS, C.HEADER_ENDINGS);
    const pthreadPatternUsed: string[] = [];

    const matched = await H.findPatternInFiles(pthreadPattern, proj.root, [
      C.buildDir,
      C.dependencyDir,
    ]);
    if (matched.length) {
      for (const m of matched) {
        // FIXME. detect if this line is in a multi-line block comment
        if (
          fileExt.includes(path.extname(m.file)) &&
          !m.content.trim().startsWith("//") &&
          !m.content.trim().startsWith("/*")
        ) {
          log.info(`The line using pthread is in file ${m.file} @ line ${m.line}:\n${m.content}`);
          pthreadPatternUsed.push(
            `- [${m.file}](/edit?type=0&path=${encodeURIComponent(
              path.join(proj.root, m.file)
            )}&resourceType=file) at line **${m.line}**: \`${m.content}\``
          );
        }
      }
    }

    if (
      !pthreadPatternUsed.length &&
      proj.config.getBuildConfigForTarget(proj.config.target).getOption("needPthread")
    ) {
      // set option 'needPthread' to false
      const action = new ConfigOptionChangeAction(
        proj,
        "We didn't detect pthread usage in codebase, but it's enabled in project configuration for building phase. Do you want to disable the pthread support from webinizer?",
        { needPthread: false }
      );

      return {
        handled: true,
        recipe: new Recipe(
          proj,
          "Recipe for pthread support",
          this,
          req,
          action,
          true /* showNoAdvisor = true */
        ),
        needPropagation: true,
      };
    }

    if (
      pthreadPatternUsed.length &&
      !proj.config.getBuildConfigForTarget(proj.config.target).getOption("needPthread")
    ) {
      // set option 'needPthread' to true
      const action = new ConfigOptionChangeAction(
        proj,
        `We detected pthread usage in codebase, but it's disabled in project configuration for building phase. We recommend to enable \`Pthread\` option if you want this feature.\n${pthreadPatternUsed.join(
          "\n"
        )}`,
        { needPthread: true }
      );

      return {
        handled: true,
        recipe: new Recipe(
          proj,
          "Recipe for pthread support",
          this,
          req,
          action,
          true /* showNoAdvisor = true */
        ),
        needPropagation: true,
      };
    }
    return { handled: true, needPropagation: true };
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  async advise(
    proj: IProject,
    req: IAdviseRequest,
    requestList: ReadonlyArray<IAdviseRequest> // one can only return newRequestQueue to change it
  ): Promise<IAdviseResult> {
    if (req instanceof PlainAdviseRequest) {
      const plainReq = req as PlainAdviseRequest;
      // skip to run this advisor if disabledAdvisor flag is set from user.
      if (
        !proj.config.getBuildConfigForTarget(proj.config.target).getDisabledAdvisorFlag(this.type)
      ) {
        return this._generatePThreadAdvise(proj, plainReq);
      }
    }
    return {
      handled: false,
    };
  }
}

// loading
export default function onload() {
  registerAdvisorFactory(PThreadAdvisor.__type__, new PThreadAdvisorFactory());
}
