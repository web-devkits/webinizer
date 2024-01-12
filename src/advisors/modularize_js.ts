/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2024 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import path from "path";
import fs from "graceful-fs";
import { registerAdvisorFactory } from "../advisor";
import { Recipe } from "../recipe";
import { PlainAdviseRequest, ErrorAdviseRequest } from "../advise_requests/common_requests";
import { ConfigOptionChangeAction } from "../actions/config_option_change";
import {
  IAdviseRequest,
  IAdviseResult,
  IAdvisorFactory,
  IAdvisor,
  Project as IProject,
} from "webinizer";
import { isPrevBuildersAllNative, findFirstBuilder } from "../builder";

class ModularizeJSAdvisorFactory implements IAdvisorFactory {
  name = "ModularizeJSAdvisorFactory";
  desc = "Use this factory class to create ModularizeJSAdvisor instance";

  createAdvisor(): IAdvisor {
    return new ModularizeJSAdvisor();
  }
}

class ModularizeJSAdvisor implements IAdvisor {
  static __type__ = "ModularizeJSAdvisor";
  type = ModularizeJSAdvisor.__type__;
  desc = "Advise issues related to modularize JS output";

  private async _generateModularizeJSAdvise(
    proj: IProject,
    req: ErrorAdviseRequest | PlainAdviseRequest
  ): Promise<IAdviseResult> {
    // set option 'needModularize' to false
    const action = new ConfigOptionChangeAction(
      proj,
      "We have detected that `html` is set as the build target format, which conflicts with the modularize js output configuration option. Do you want to disable the `Modularize JS output` option and keep html as the build target format?",
      { needModularize: false }
    );

    return {
      handled: true,
      recipe: new Recipe(proj, "Recipe for modularize JS output option", this, req, action),
    };
  }

  private async _checkTargetFormat4PreBuild(proj: IProject): Promise<boolean> {
    // pre-build check
    const rawBuilders = proj.config.getBuildConfigForTarget(proj.config.target).rawBuilders;
    // FIXME. currently we only support checking for CMake file
    if (
      rawBuilders &&
      ((rawBuilders[0].__type__ as string) === "CMakeBuilder" ||
        isPrevBuildersAllNative(proj, findFirstBuilder(proj, "CMakeBuilder")))
    ) {
      const workingDir = (
        rawBuilders[findFirstBuilder(proj, "CMakeBuilder")].rootBuildFilePath as string
      ).replace("${projectRoot}", proj.root);

      const suffixReg = /set\(CMAKE_EXECUTABLE_SUFFIX ".html"\)/g;
      const file = path.join(workingDir, "CMakeLists.txt");
      const relative = path.relative(proj.root, file);

      if (
        fs.existsSync(file) &&
        relative &&
        !relative.startsWith("..") &&
        !path.isAbsolute(relative)
      ) {
        const lines = fs.readFileSync(file, "utf-8").split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim().length > 0 && !lines[i].trim().startsWith("#")) {
            const m = lines[i].match(suffixReg);
            if (m !== null) return true;
          }
        }
      }
    }
    return false;
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  async advise(
    proj: IProject,
    req: IAdviseRequest,
    requestList: ReadonlyArray<IAdviseRequest> // one can only return newRequestQueue to change it
  ): Promise<IAdviseResult> {
    if (req instanceof PlainAdviseRequest) {
      // pre-build check
      const plainReq = req as PlainAdviseRequest;
      // check if html is set as the build target format in cmake file
      if (
        (await this._checkTargetFormat4PreBuild(proj)) &&
        proj.config.getBuildConfigForTarget(proj.config.target).getOption("needModularize")
      ) {
        return this._generateModularizeJSAdvise(proj, plainReq);
      }
    }

    if (req instanceof ErrorAdviseRequest) {
      // build check
      const errorReq = req as ErrorAdviseRequest;
      const errorReg =
        /.+emsdk\/upstream\/emscripten\/src\/shell\.html" is not compatible with build options "-sMODULARIZE -sEXPORT_NAME=Module"/g;
      const m = errorReq.error.match(errorReg);
      if (m !== null) {
        return this._generateModularizeJSAdvise(proj, errorReq);
      }
    }

    return {
      handled: false,
    };
  }
}

// loading
export default function onload() {
  registerAdvisorFactory(ModularizeJSAdvisor.__type__, new ModularizeJSAdvisorFactory());
}
