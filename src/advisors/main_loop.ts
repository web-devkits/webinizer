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
import { ShowSuggestionAction, SuggestionExample } from "../actions/show_suggestion";
import {
  IAdviseRequest,
  IAdviseResult,
  IAdvisorFactory,
  IAdvisor,
  Project as IProject,
} from "webinizer";

const log = H.getLogger("MainLoopAdvisor");

class MainLoopAdvisorFactory implements IAdvisorFactory {
  name = "MainLoopAdvisorFactory";
  desc = "Use this factory class to create MainLoopAdvisor instance";

  createAdvisor(): IAdvisor {
    return new MainLoopAdvisor();
  }
}

class MainLoopAdvisor implements IAdvisor {
  static __type__ = "MainLoopAdvisor";
  type = MainLoopAdvisor.__type__;
  desc = "Advise issues related to main loop";

  private _getSuggestionExample(): SuggestionExample {
    const before = `
#include "game.h"

int main() {
  Game game;
  while (game.loop());
  return 0;
}`;
    const after = `
#include "game.h"
#include <emscripten.h>

int main() {
  emscripten_set_main_loop(
    []() {
        static Game game;
        game.loop();
  }, 0, 1);
  return 0;
}`;
    return new SuggestionExample(before, after);
  }

  private async _generateMainLoopAdvise(
    proj: IProject,
    req: PlainAdviseRequest
  ): Promise<IAdviseResult> {
    const mainLoopAPIs = ["emscripten_set_main_loop", "emscripten_request_animation_frame_loop"];
    const fileExt = C.C_ENDINGS.concat(C.CXX_ENDINGS, C.HEADER_ENDINGS);
    let isMainLoopAPIUsed = false;
    for (const api of mainLoopAPIs) {
      const matched = await H.findPatternInFiles(api, proj.root, [C.buildDir, C.dependencyDir]);
      if (matched.length) {
        for (const m of matched) {
          // FIXME. detect if this line is in a multi-line block comment
          if (
            !m.file.startsWith(C.dependencyDir) &&
            fileExt.includes(path.extname(m.file)) &&
            !m.content.trim().startsWith("//") &&
            !m.content.trim().startsWith("/*")
          ) {
            log.info(
              `The line using emscripten main_loop API is in file ${m.file} @ line ${m.line}:\n${m.content}`
            );
            isMainLoopAPIUsed = true;
            break;
          }
        }
      }
    }

    if (
      !isMainLoopAPIUsed &&
      proj.config.getBuildConfigForTarget(proj.config.target).getOption("needMainLoop")
    ) {
      const action = new ShowSuggestionAction(
        "option",
        `Main loop implementation using Emscripten API is not detected. If you are using infinite loop in your application (i.e., for rendering / animation, etc.), please follow the example below to use [\`emscripten_set_main_loop()\`](https://emscripten.org/docs/api_reference/emscripten.h.html#c.emscripten_set_main_loop) API to modify. Otherwise, please click \`IGNORE\` to dismiss this recipe.`,
        this._getSuggestionExample(),
        null
      );
      return {
        handled: true,
        recipe: new Recipe(
          proj,
          "Recipe for main loop issue",
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
        return this._generateMainLoopAdvise(proj, plainReq);
      }
    }
    return {
      handled: false,
    };
  }
}

// loading
export default function onload() {
  registerAdvisorFactory(MainLoopAdvisor.__type__, new MainLoopAdvisorFactory());
}
