/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import path from "path";
import * as H from "../helper";
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

class BuildNativeToolAdvisorFactory implements IAdvisorFactory {
  name = "BuildNativeToolAdvisorFactory";
  desc = "Use this factory class to create BuildNativeToolAdvisor instance";

  createAdvisor(): IAdvisor {
    return new BuildNativeToolAdvisor();
  }
}

class BuildNativeToolAdvisor implements IAdvisor {
  static __type__ = "BuildNativeToolAdvisor";
  type = BuildNativeToolAdvisor.__type__;
  desc =
    "Advise issues related to build intermedium tools with native compiler other than Emscripten";

  private async _fixBuildNativeToolErr(
    proj: IProject,
    req: ErrorAdviseRequest
  ): Promise<IAdviseResult> {
    const action = new ShowSuggestionAction(
      "error",
      `The build process needs to build some tools to generate some intermedium files. These tools should be \`native\` binaries. You need to adopt native compiler/tool-chain (such as \`gcc\`) to build these tools. Otherwise, emscripten-built tools cannot work and will interrupt the build process.`,
      null,
      null
    );

    return {
      handled: true,
      recipe: new Recipe(
        proj,
        "Recipe for issue of building intermedium tools with native compiler other than Emscripten",
        this,
        req,
        action
      ),
    };
  }

  private async _checkFileFormatNative(errLog: string): Promise<boolean> {
    let fileName = null;
    let filePath = null;
    let fullPath = null;
    let cmd = null;
    let tempIndex = 0;
    const lines = errLog.split("\n");

    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].includes(": Permission denied")) {
        fileName = lines[i]
          .substring(lines[i].lastIndexOf("./") + 2, lines[i].indexOf(": Permission denied"))
          .trim();
        tempIndex = i;
        break;
      }
    }

    for (let i = tempIndex + 1; i < lines.length; i++) {
      if (lines[i].includes("make[1]: Leaving directory")) {
        filePath = lines[i].substring(lines[i].indexOf("'") + 1, lines[i].lastIndexOf("'"));
      }
    }

    if (filePath && fileName) {
      fullPath = path.join(filePath, fileName);
    }

    cmd = "file " + fullPath;
    const results = await H.runCommand(cmd, { silent: true });
    if (results.code !== 0 && results.output.includes("ELF")) {
      return true;
    }
    return false;
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  async advise(
    proj: IProject,
    req: IAdviseRequest,
    requestList: ReadonlyArray<IAdviseRequest> // one can only return newRequestQueue to change it
  ): Promise<IAdviseResult> {
    if (req instanceof ErrorAdviseRequest) {
      const errorReq = req as ErrorAdviseRequest;
      if (
        errorReq.error.includes("Permission denied") &&
        !(await this._checkFileFormatNative(errorReq.error)).valueOf()
      ) {
        return this._fixBuildNativeToolErr(proj, errorReq);
      }
    }
    return {
      handled: false,
    };
  }
}

// loading
export default function onload() {
  registerAdvisorFactory(BuildNativeToolAdvisor.__type__, new BuildNativeToolAdvisorFactory());
}
