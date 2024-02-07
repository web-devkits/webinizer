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
import { ConfigOptionChangeAction } from "../actions/config_option_change";
import { ShowSuggestionAction, SuggestionExample } from "../actions/show_suggestion";
import { ConfigEnvChangeAction } from "../actions/config_env_change";
import {
  IAdviseRequest,
  IAdviseResult,
  IAdvisorFactory,
  IAdvisor,
  Project as IProject,
  IArg,
  IAction,
} from "webinizer";

class SimdAdvisorFactory implements IAdvisorFactory {
  name = "SimdAdvisorFactory";
  desc = "Use this factory class to create SimdAdvisor instance";

  createAdvisor(): IAdvisor {
    return new SimdAdvisor();
  }
}

class SimdAdvisor implements IAdvisor {
  static __type__ = "SimdAdvisor";
  type = SimdAdvisor.__type__;
  desc = "Advise issues related to SIMD";

  private async _generateSimdAdvise(
    proj: IProject,
    req: ErrorAdviseRequest
  ): Promise<IAdviseResult> {
    const action = new ConfigOptionChangeAction(
      proj,
      "If you want to port `SIMD` code targeting WebAssembly, we should enable the `SIMD support` option.",
      { needSimd: true }
    );

    return {
      handled: true,
      recipe: new Recipe(proj, "Recipe for SIMD issue", this, req, action),
    };
  }

  private _getSuggestionExample(): SuggestionExample {
    const before = `#ifdef _WIN32
#include <intrin.h>
#else
#include <x86intrin.h>
#endif`;
    const after = `#ifdef _WIN32
#include <intrin.h>
#else
/* carefully comment or remove if it is not used */
// #include <x86intrin.h>
#endif`;
    return new SuggestionExample(before, after);
  }

  private async _generateSimdStaticScanAdvise(
    proj: IProject,
    req: PlainAdviseRequest
  ): Promise<IAdviseResult> {
    const buildConfig = proj.config.getBuildConfigForTarget(proj.config.target);

    const supportedInstructionSetsObj = {
      sse: {
        header: "#include <xmmintrin.h>",
        flag: "-msse",
      },
      sse2: { header: "#include <emmintrin.h>", flag: "-msse2" },
      sse3: { header: "#include <pmmintrin.h>", flag: "-msse3" },
      ssse3: { header: "#include <tmmintrin.h>", flag: "-mssse3" },
      sse4_1: { header: "#include <smmintrin.h>", flag: "-msse4.1" },
      sse4_2: { header: "#include <nmmintrin.h>", flag: "-msse4.2" },
      avx: { header: "#include <immintrin.h>", flag: "-mavx" },
    };

    let setKey: keyof typeof supportedInstructionSetsObj;
    const actions: IAction[] = [];

    for (setKey in supportedInstructionSetsObj) {
      const matched = await H.findPatternInFiles(
        supportedInstructionSetsObj[setKey].header,
        proj.root,
        [C.buildDir, C.dependencyDir]
      );
      if (
        matched.length &&
        !buildConfig.getEnv("cflags").includes(supportedInstructionSetsObj[setKey].flag)
      ) {
        // this instruction set is used in codebase, add
        // corresponding flag into the compiler flags.
        const addCflags: IArg[] = [
          {
            option: supportedInstructionSetsObj[setKey].flag,
            value: null,
            type: "replace",
          },
        ];

        const action = new ConfigEnvChangeAction(
          proj,
          `Add corresponding compiler flag since \`${setKey}\` instruction set is used in the codebase`,
          {
            cflags: addCflags,
          }
        );

        actions.push(action);
      }
    }

    if (actions.length) {
      if (
        !buildConfig.getEnv("cflags").includes("-msimd128") ||
        !buildConfig.getEnv("ldflags").includes("-msimd128")
      ) {
        actions.push(
          new ConfigOptionChangeAction(
            proj,
            "If you want to port `SIMD` code targeting WebAssembly, we should enable the `SIMD support` option.",
            { needSimd: true }
          )
        );
      }

      return {
        handled: true,
        recipe: new Recipe(proj, "Recipe for SIMD intrinsic header issue", this, req, actions),
      };
    } else {
      return {
        handled: false,
      };
    }
  }

  private async _generateIntrinsicAdvise(
    proj: IProject,
    req: ErrorAdviseRequest
  ): Promise<IAdviseResult> {
    const action = new ShowSuggestionAction(
      "error",
      `Emscripten does \`not\` support including \`x86intrin.h\` directly, please check out your codebase and remove corresponding header files including statements if they are useless.\n As for using SIMD, please refer to [Using SIMD with WebAssembly](https://emscripten.org/docs/porting/simd.html#using-simd-with-webassembly)`,
      this._getSuggestionExample(),
      null
    );
    return {
      handled: true,
      recipe: new Recipe(proj, "Recipe for SIMD intrinsic header issue", this, req, action),
    };
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  async advise(
    proj: IProject,
    req: IAdviseRequest,
    requestList: ReadonlyArray<IAdviseRequest> // one can only return newRequestQueue to change it
  ): Promise<IAdviseResult> {
    if (req instanceof ErrorAdviseRequest) {
      const ErrlogStr =
        "emcc: error: Passing any of -msse, -msse2, -msse3, -mssse3, -msse4.1, -msse4.2, -msse4, -mavx, -mfpu=neon flags also requires passing -msimd128!";
      const errorReq = req as ErrorAdviseRequest;
      if (
        (await H.findPatternInFiles(ErrlogStr, proj.root, [C.buildDir, C.dependencyDir])).length > 0
      ) {
        return this._generateSimdAdvise(proj, errorReq);
      }

      // check if the error is caused by x86intrinsic header file
      const errRegexPattern =
        /In file included from .+\/upstream\/lib\/clang\/((\d+\.\d+\.\d+)|\d+)\/include\/x86intrin.h/;

      const matchResult = errorReq.error.match(errRegexPattern);
      if (matchResult !== null) {
        return this._generateIntrinsicAdvise(proj, errorReq);
      }
    }

    if (req instanceof PlainAdviseRequest) {
      return this._generateSimdStaticScanAdvise(proj, req);
    }
    return {
      handled: false,
    };
  }
}

// loading
export default function onload() {
  registerAdvisorFactory(SimdAdvisor.__type__, new SimdAdvisorFactory());
}
