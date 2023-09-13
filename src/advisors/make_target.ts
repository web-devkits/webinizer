/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import path from "path";
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

class MakeTargetAdvisorFactory implements IAdvisorFactory {
  name = "MakeTargetAdvisorFactory";
  desc = "Use this factory class to create MakeTargetAdvisor instance";

  createAdvisor(): IAdvisor {
    return new MakeTargetAdvisor();
  }
}

class MakeTargetAdvisor implements IAdvisor {
  static __type__ = "MakeTargetAdvisor";
  type = MakeTargetAdvisor.__type__;
  desc = "Advise issues related to make target";

  private _getSuggestionExample(): SuggestionExample {
    const before = `make`;
    const after = `make -Csrc`;
    return new SuggestionExample(before, after);
  }

  private async _generateMakeTargetAdvise(
    proj: IProject,
    req: ErrorAdviseRequest,
    target: string,
    dir: string
  ): Promise<IAdviseResult> {
    const action = new ShowSuggestionAction(
      "error",
      `You are failed to build the target \`${target}\` in directory \`${dir}\`, which seems to be not required for build.\nPlease specify a build directory or target to avoid such unnecessary builds (i.e., \`make -Csrc, make main_target\`).`,
      this._getSuggestionExample(),
      null
    );

    return {
      handled: true,
      recipe: new Recipe(proj, "Recipe for make target issue", this, req, action),
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
      let i = 0;
      let target = "";
      let dir = "";
      // General logic
      // 1. find the failure build target that appears the first
      // Example: make[3]: *** [gnuplot.gih] Error 126
      const targetReg = /make.*: \*\*\* \[(?<target>.*)\] Error [0-9]*/;
      for (i = 0; i < lines.length; i++) {
        const m = lines[i].match(targetReg);
        if (m && m.groups) {
          target = m.groups.target.trim();
          break;
        }
      }
      // 2. find the make directory of build target
      // Example: make[3]: Entering directory '/home/work/projects/gnuplot-repos/gnuplot-5.4.3/docs'
      const dirReg = /make.*: Entering directory '(?<dir>.*)'/;
      for (let j = i - 1; j >= 0; j--) {
        const m = lines[j].match(dirReg);
        if (m && m.groups) {
          dir = m.groups.dir.trim();
          break;
        }
      }
      // 3. check if the make directory is a auxilliaryDir that is not necessary to build
      // FIXME. extend the hardcode here to cover more cases
      const auxilliaryDir = ["doc", "docs", "demo", "man", "test"];
      if (target && dir && auxilliaryDir.includes(path.relative(path.resolve(proj.root), dir))) {
        return this._generateMakeTargetAdvise(proj, errorReq, target, dir);
      }
    }
    return {
      handled: false,
    };
  }
}

// loading
export default function onload() {
  registerAdvisorFactory(MakeTargetAdvisor.__type__, new MakeTargetAdvisorFactory());
}
