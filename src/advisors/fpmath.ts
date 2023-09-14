/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import path from "path";
import * as H from "../helper";
import * as C from "../constants";
import { registerAdvisorFactory } from "../advisor";
import { ShowSuggestionAction, SuggestionExample } from "../actions/show_suggestion";
import { Recipe } from "../recipe";
import { ErrorAdviseRequest } from "../advise_requests/common_requests";
import { FileChangeAction, FileRegion } from "../actions/file_change";
import {
  IAction,
  IAdviseRequest,
  IAdviseResult,
  IAdvisorFactory,
  IAdvisor,
  Project as IProject,
} from "webinizer";

class FpmathAdvisorFactory implements IAdvisorFactory {
  name = "FpmathAdvisorFactory";
  desc = "Use this factory class to create FpmathAdvisor instance";

  createAdvisor(): IAdvisor {
    return new FpmathAdvisor();
  }
}

class FpmathAdvisor implements IAdvisor {
  static __type__ = "FpmathAdvisor";
  type = FpmathAdvisor.__type__;
  desc = "Advise issues related to fpmath";

  private _getSuggestionExample(): SuggestionExample {
    const before = "-mfpmath=sse -msse -msse2";
    const after = "-msse -msse2";
    return new SuggestionExample(before, after);
  }

  private async _generateFpmathAdvise(
    proj: IProject,
    req: ErrorAdviseRequest
  ): Promise<IAdviseResult> {
    const fileName = ["configure", "CMakeLists.txt", "Makefile"];
    const actions = [] as IAction[];

    const matched = await H.findPatternInFiles("mfpmath=", proj.root, [
      C.buildDir,
      C.dependencyDir,
    ]);
    if (matched.length) {
      for (const m of matched) {
        if (fileName.includes(m.file)) {
          actions.push(
            new FileChangeAction(
              proj.fileChangeManager,
              `Remove argument \`-mfpmath\` from \`${m.file}\` at line **${m.line}**`,
              new FileRegion(path.join(proj.root, m.file), m.line),
              m.content.replace(/-mfpmath=[^\s]*/gm, "")
            )
          );
        }
      }
    } else {
      // if we didn't find the flags setting in common configuration files, suggest the user to modify themselves.
      actions.push(
        new ShowSuggestionAction(
          "error",
          "Please remove all related '-mfpmath' compiler flags in your project.",
          this._getSuggestionExample(),
          null
        )
      );
    }

    return {
      handled: true,
      recipe: new Recipe(proj, "Recipe for fpmath issue", this, req, actions),
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
      if (
        (await H.findPatternInFiles("unknown FP unit", proj.root, [C.buildDir, C.dependencyDir]))
          .length > 0
      ) {
        return this._generateFpmathAdvise(proj, errorReq);
      }
    }
    return {
      handled: false,
    };
  }
}

// loading
export default function onload() {
  registerAdvisorFactory(FpmathAdvisor.__type__, new FpmathAdvisorFactory());
}
