/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import * as H from "../helper";
import * as C from "../constants";
import { registerAdvisorFactory } from "../advisor";
import { Recipe } from "../recipe";
import { ErrorAdviseRequest, PlainAdviseRequest } from "../advise_requests/common_requests";
import { ConfigEnvChangeAction } from "../actions/config_env_change";
import {
  IArg,
  IAdviseRequest,
  IAdviseResult,
  IAdvisorFactory,
  IAdvisor,
  Project as IProject,
} from "webinizer";

class ExportNameAdvisorFactory implements IAdvisorFactory {
  name = "ExportNameAdvisorFactory";
  desc = "Use this factory class to create ExportNameAdvisor instance";

  createAdvisor(): IAdvisor {
    return new ExportNameAdvisor();
  }
}

class ExportNameAdvisor implements IAdvisor {
  static __type__ = "ExportNameAdvisor";
  type = ExportNameAdvisor.__type__;
  desc = "Advise issues related to export name of wasm module";

  private async _fixExportNameError(
    proj: IProject,
    req: ErrorAdviseRequest | PlainAdviseRequest
  ): Promise<IAdviseResult> {
    const exportName = proj.config.name ? proj.config.name.replace(/\s/g, "") : "WebinizerProj";
    const action = new ConfigEnvChangeAction(
      proj,
      `Enable \`Pthreads + MODULARIZE\` currently require you to set \`-sEXPORT_NAME=Something\` to \`Something != Module\`. Specify the WASM module name as \`${exportName}\` (${
        exportName === "WebinizerProj" ? "default name as project name is not set" : "project name"
      }) instead of the default \`Module\`.`,
      {
        ldflags: [
          {
            option: "-sEXPORT_NAME",
            value: exportName,
            type: "replace",
          },
        ] as IArg[],
      }
    );

    return {
      handled: true,
      recipe: new Recipe(proj, "Recipe for exporting name of wasm module issue", this, req, action),
    };
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
      const buildConfig = proj.config.getBuildConfigForTarget(proj.config.target);
      if (
        buildConfig.getOption("needPthread") &&
        buildConfig.getOption("needModularize") &&
        (!buildConfig.getEnv("ldflags").includes("-sEXPORT_NAME=") ||
          buildConfig.getEnv("ldflags").includes("-sEXPORT_NAME=Module"))
      ) {
        return this._fixExportNameError(proj, plainReq);
      }
    }

    if (req instanceof ErrorAdviseRequest) {
      // build check
      const errorReq = req as ErrorAdviseRequest;
      if (
        (
          await H.findPatternInFiles(
            "emcc: error: pthreads + MODULARIZE currently require you to set -sEXPORT_NAME=Something (see settings.js) to Something != Module, so that the .worker.js file can work",
            proj.root,
            [C.buildDir, C.dependencyDir]
          )
        ).length > 0
      ) {
        return this._fixExportNameError(proj, errorReq);
      }
    }
    return {
      handled: false,
    };
  }
}

// loading
export default function onload() {
  registerAdvisorFactory(ExportNameAdvisor.__type__, new ExportNameAdvisorFactory());
}
