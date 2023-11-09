/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import path from "path";
import * as H from "../helper";
import * as C from "../constants";
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

const log = H.getLogger("CppExceptionAdvisor");

class CppExceptionAdvisorFactory implements IAdvisorFactory {
  name = "CppExceptionAdvisorFactory";
  desc = "Use this factory class to create CppExceptionAdvisor instance";

  createAdvisor(): IAdvisor {
    return new CppExceptionAdvisor();
  }
}

class CppExceptionAdvisor implements IAdvisor {
  static __type__ = "CppExceptionAdvisor";
  type = CppExceptionAdvisor.__type__;
  desc = "Advise issues related to C++ exception handling";

  private async _generateCppExceptionAdvise(
    proj: IProject,
    req: PlainAdviseRequest
  ): Promise<IAdviseResult> {
    const throwPattern = "throw "; // use keyword 'throw' as identifier for exception catching pattern
    const fileExt = C.CXX_ENDINGS.concat(C.HEADER_ENDINGS);
    const throwPatternUsed: string[] = [];

    const matched = await H.findPatternInFiles(throwPattern, proj.root, [
      C.buildDir,
      C.dependencyDir,
    ]);
    if (matched.length) {
      for (const m of matched) {
        // FIXME. detect if this line is in a multi-line block comment
        if (
          fileExt.includes(path.extname(m.file)) &&
          !m.content.trim().startsWith("//") &&
          !m.content.trim().startsWith("/*") &&
          !m.content.trim().endsWith("*/")
        ) {
          log.info(
            `The line with throw pattern is in file ${m.file} @ line ${m.line}:\n${m.content}`
          );
          throwPatternUsed.push(
            `- [${m.file}](/edit?type=0&path=${encodeURIComponent(
              path.join(proj.root, m.file)
            )}&resourceType=file) at line **${m.line}**: \`${m.content}\``
          );
        }
      }
    }

    if (
      !throwPatternUsed.length &&
      proj.config.getBuildConfigForTarget(proj.config.target).getOption("needCppException")
    ) {
      // set option 'needCppException' to false
      const action = new ConfigOptionChangeAction(
        proj,
        "We didn't detect C++ exception used in codebase, but it's enabled in project configuration for building phase, which might bring extra performance overhead. We recommend to disable `C++ exception` option if you don't want this feature.",
        { needCppException: false }
      );

      return {
        handled: true,
        recipe: new Recipe(
          proj,
          "Recipe for C++ exception",
          this,
          req,
          action,
          true /* showNoAdvisor = true */
        ),
        needPropagation: true,
      };
    }

    if (
      throwPatternUsed.length &&
      !proj.config.getBuildConfigForTarget(proj.config.target).getOption("needCppException")
    ) {
      // set option 'needCppException' to true
      const action = new ConfigOptionChangeAction(
        proj,
        `We detected C++ exception used in codebase, but it's disabled in project configuration for building phase, which will disable exception catching. We recommend to enable \`C++ exception\` option if you want this feature.\n${throwPatternUsed.join(
          "\n"
        )}`,
        { needCppException: true }
      );

      return {
        handled: true,
        recipe: new Recipe(
          proj,
          "Recipe for C++ exception",
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
        return this._generateCppExceptionAdvise(proj, plainReq);
      }
    }
    return {
      handled: false,
    };
  }
}

// loading
export default function onload() {
  registerAdvisorFactory(CppExceptionAdvisor.__type__, new CppExceptionAdvisorFactory());
}
