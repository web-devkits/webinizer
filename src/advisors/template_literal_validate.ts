/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import * as H from "../helper";
import { registerAdvisorFactory } from "../advisor";
import { Recipe } from "../recipe";
import { PlainAdviseRequest } from "../advise_requests/common_requests";
import { ShowSuggestionAction } from "../actions/show_suggestion";
import {
  EnvType,
  IAdviseRequest,
  IAdviseResult,
  IAdvisorFactory,
  IAdvisor,
  Project as IProject,
} from "webinizer";

class TemplateLiteralValidateAdvisorFactory implements IAdvisorFactory {
  name = "TemplateLiteralValidateAdvisorFactory";
  desc = "Use this factory class to create TemplateLiteralValidateAdvisor instance";

  createAdvisor(): IAdvisor {
    return new TemplateLiteralValidateAdvisor();
  }
}

class TemplateLiteralValidateAdvisor implements IAdvisor {
  static __type__ = "TemplateLiteralValidateAdvisor";
  type = TemplateLiteralValidateAdvisor.__type__;
  desc = "Advise issues related to invalid template literals";

  private async _validateTemplateLiterals(
    proj: IProject,
    req: PlainAdviseRequest
  ): Promise<IAdviseResult> {
    const results: H.Dict<string[]> = {};
    const buildConfig = proj.config.getBuildConfigForTarget(proj.config.target);
    const builders = buildConfig.rawBuilders;
    if (builders && builders.length) {
      const invalidSteps: string[][] = [];
      for (let i = 0; i < builders.length; i++) {
        const b = builders[i];
        // check args and working directory
        const validateArgs = proj.validateTemplateLiterals(b.args as string);
        const validatePath = proj.validateTemplateLiterals(b.rootBuildFilePath as string);
        if (validateArgs.length) {
          invalidSteps.push([
            `**${i + 1}**`,
            "Arguments",
            `${validateArgs.map((p) => `\`${p}\``).join(", ")}`,
          ]);
        }
        if (validatePath.length) {
          invalidSteps.push([
            `**${i + 1}**`,
            "Working directory",
            `${validatePath.map((p) => `\`${p}\``).join(", ")}`,
          ]);
        }
      }
      if (invalidSteps.length) {
        Object.assign(results, {
          "Build Steps": H.constructMarkdownTable(
            ["Build Step #", "Invalid Config", "Invalid Values"],
            invalidSteps
          ),
        });
      }
    }

    const envs = buildConfig.envs;
    if (envs) {
      const invalidEnvs: string[][] = [];
      for (const e in envs) {
        const validation = proj.validateTemplateLiterals(envs[e as EnvType]);
        if (validation.length) {
          invalidEnvs.push([
            `${e === "cflags" ? "Compiler flags" : "Linker flags"}`,
            validation.map((e) => `\`${e}\``).join(", "),
          ]);
        }
      }
      if (invalidEnvs.length) {
        Object.assign(results, {
          "Environment Variables": H.constructMarkdownTable(
            ["Environment Variables", "Invalid Values"],
            invalidEnvs
          ),
        });
      }
    }

    const preloads = buildConfig.preloadFiles;
    if (preloads && preloads.length) {
      const invalidPreload: string[][] = [];
      for (const p of preloads) {
        const validation = proj.validateTemplateLiterals(p);
        if (validation.length) {
          invalidPreload.push([`${p}`, validation.map((f) => `\`${f}\``).join(", ")]);
        }
      }
      if (invalidPreload.length) {
        Object.assign(results, {
          "Local Data Files": H.constructMarkdownTable(["Files", "Invalid Values"], invalidPreload),
        });
      }
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
        `Below are the \`invalid\` template literals we detected in project configuration:\n\n${descs}\n\n#\n\nYou can refer to below available template literals to modify accordingly:\n${proj
          .getTemplateLiterals(true)
          .map((t) => `- ${t}`)
          .join("\n")}`,
        null,
        null
      );
      return {
        handled: true,
        recipe: new Recipe(
          proj,
          "Recipe for invalid template literals in project config",
          this,
          req,
          action
        ),
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
      return this._validateTemplateLiterals(proj, plainReq);
    }
    return {
      handled: false,
    };
  }
}

// loading
export default function onload() {
  registerAdvisorFactory(
    TemplateLiteralValidateAdvisor.__type__,
    new TemplateLiteralValidateAdvisorFactory()
  );
}
