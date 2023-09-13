/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import fs from "graceful-fs";
import path from "path";
import * as H from "../helper";
import { registerAdvisorFactory } from "../advisor";
import { Recipe } from "../recipe";
import { PlainAdviseRequest } from "../advise_requests/common_requests";
import { ShowSuggestionAction } from "../actions/show_suggestion";
import { isPrevBuildersAllNative } from "../builder";
import {
  IAdviseRequest,
  IAdviseResult,
  IAdvisorFactory,
  IAdvisor,
  Project as IProject,
} from "webinizer";

class BuildPathValidateAdvisorFactory implements IAdvisorFactory {
  name = "BuildPathValidateAdvisor";
  desc = "Use this factory class to create BuildPathValidateAdvisor instance";

  createAdvisor(): IAdvisor {
    return new BuildPathValidateAdvisor();
  }
}

class BuildPathValidateAdvisor implements IAdvisor {
  static __type__ = "BuildPathValidateAdvisor";
  type = BuildPathValidateAdvisor.__type__;
  desc = "Advise issues related to invalid path";

  private async _validateBuildPath(
    proj: IProject,
    req: PlainAdviseRequest
  ): Promise<IAdviseResult> {
    const results: H.Dict<string> = {};

    const builders = proj.config.getBuildConfigForTarget(proj.config.target).rawBuilders;
    if (builders && builders.length) {
      const emptyPath: number[] = [];
      const invalidBuildFile: number[] = [];
      const outsideOfRoot: number[] = [];
      const buildFileMap = new Map<string, string>([
        ["CMakeBuilder", "CMakeLists.txt"],
        ["ConfigureBuilder", "configure"],
        ["MakeBuilder", "Makefile"],
      ]);
      const buildStepMap = new Map<string, string>([
        ["CMakeBuilder", "CMake"],
        ["ConfigureBuilder", "Configure"],
        ["MakeBuilder", "Make"],
        ["EmccBuilder", "emcc"],
        ["NativeBuilder", "Native Command"],
      ]);
      for (let i = 0; i < builders.length; i++) {
        const builder = builders[i];
        if (!builder.rootBuildFilePath) {
          emptyPath.push(i);
          continue;
        }
        const m = proj.validateTemplateLiterals(builder.rootBuildFilePath as string);
        if (m.length) {
          // invalid template literal used, bypass here as this will be taken care of by `TemplateLiteralValidateAdvisor`
          continue;
        }
        const workingDir = proj.evalTemplateLiterals(builder.rootBuildFilePath as string);

        if (!fs.existsSync(workingDir)) {
          invalidBuildFile.push(i);
          continue;
        } else {
          if (buildFileMap.get(builder.__type__)) {
            // builders with specified build file (cmake, configure and make) - check path for build file
            if (!fs.existsSync(path.join(workingDir, buildFileMap.get(builder.__type__) || ""))) {
              // build file path error - no such file
              if (builder.__type__ === "MakeBuilder") {
                // only check at pre-build for MakeBuilder if it's the first non-native builder
                if (isPrevBuildersAllNative(proj, i)) {
                  invalidBuildFile.push(i);
                  continue;
                }
              } else {
                invalidBuildFile.push(i);
                continue;
              }
            }
          }
        }

        const relative = path.relative(proj.root, workingDir);
        if (relative.startsWith("..") || path.isAbsolute(relative)) {
          // build file path error - outside of project root
          outsideOfRoot.push(i);
        }
      }

      const invalidBuildSteps: string[][] = [];
      if (emptyPath.length)
        emptyPath.forEach((idx) => {
          invalidBuildSteps.push([
            `${idx + 1}`,
            buildStepMap.get(builders[idx].__type__) || "",
            `\`${builders[idx].rootBuildFilePath}\``,
            "Empty working directory.",
          ]);
        });

      if (invalidBuildFile.length)
        invalidBuildFile.forEach((idx) => {
          invalidBuildSteps.push([
            `${idx + 1}`,
            buildStepMap.get(builders[idx].__type__) || "",
            `\`${builders[idx].rootBuildFilePath}\``,
            "Invalid working directory for build.",
          ]);
        });

      if (outsideOfRoot.length)
        outsideOfRoot.forEach((idx) => {
          invalidBuildSteps.push([
            `${idx + 1}`,
            buildStepMap.get(builders[idx].__type__) || "",
            `\`${builders[idx].rootBuildFilePath}\``,
            "Working directory is outside the project root.",
          ]);
        });

      if (invalidBuildSteps.length) {
        Object.assign(results, {
          "Build Steps": H.constructMarkdownTable(
            ["Build Step #", "Type", "Invalid Value", "Reason"],
            invalidBuildSteps
          ),
        });
      }
    }

    const preloads = proj.config.getBuildConfigForTarget(proj.config.target).preloadFiles;
    if (preloads && preloads.length) {
      const invalidPreloads: string[][] = [];
      for (const p of preloads) {
        const fileDir = p.split("@").shift()?.trim() || p;
        if (proj.validateTemplateLiterals(fileDir).length) {
          // handled in TemplateLiteralValidateAdvisor
          continue;
        }
        const dir = proj.evalTemplateLiterals(fileDir);
        if (!fs.existsSync(dir)) {
          invalidPreloads.push([`\`${fileDir}\``, "File doesn't exist."]);
        }
      }
      if (invalidPreloads.length)
        Object.assign(results, {
          "Local Data Files": H.constructMarkdownTable(["Files", "Reason"], invalidPreloads),
        });
    }

    if (Object.keys(results).length) {
      const descs = Object.keys(results)
        .map((item) => {
          let link = "";
          if (item === "Build Steps") link = `/buildSteps`;
          else if (item === "Dependencies") link = `/basic`;
          else link = `/config`;
          return `[**_${item}_**](${link})\n${results[item]}`;
        })
        .join("\n\n");
      const action = new ShowSuggestionAction(
        "error",
        `Below are the \`invalid\` paths we detected in project configuration:\n\n${descs}\n\nPlease modify them with correct ones.\n\n#\n\n Below are available template literals and their values for your reference:\n${proj
          .getTemplateLiterals(true)
          .map((t) => "- " + t)
          .join("\n")}`,
        null,
        null
      );
      return {
        handled: true,
        recipe: new Recipe(proj, "Recipe for invalid path in project config", this, req, action),
        needPropagation: true,
      };
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
    if (req instanceof PlainAdviseRequest) {
      const plainReq = req as PlainAdviseRequest;
      return this._validateBuildPath(proj, plainReq);
    }
    return {
      handled: false,
    };
  }
}

// loading
export default function onload() {
  registerAdvisorFactory(BuildPathValidateAdvisor.__type__, new BuildPathValidateAdvisorFactory());
}
