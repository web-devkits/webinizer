/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import path from "path";
import fs from "graceful-fs";
import * as H from "../helper";
import { registerAdvisorFactory } from "../advisor";
import { Recipe } from "../recipe";
import { PlainAdviseRequest } from "../advise_requests/common_requests";
import { FileChangeAction, FileRegion } from "../actions/file_change";
import { ConfigEnvChangeAction } from "../actions/config_env_change";
import { ShowSuggestionAction } from "../actions/show_suggestion";
import { preloadFontFiles } from "./sdl";
import { isPrevBuildersAllNative, findFirstBuilder } from "../builder";
import {
  IAction,
  IArg,
  IAdviseRequest,
  IAdviseResult,
  IAdvisorFactory,
  IAdvisor,
  Project as IProject,
} from "webinizer";

export async function generateEmPorts(): Promise<H.Dict<string>> {
  const ports = {} as H.Dict<string>; // <name, commands>
  const results = await H.runCommand("emcc --show-ports", { silent: true });
  if (results.code === 0) {
    const lines = results.all.split("\n");
    const portReg = /(?<pkg>.*) \(((?<cmd>.*);)?.*\)/;
    for (const line of lines) {
      if (line.trim() !== "Available ports:") {
        const m = line.trim().match(portReg);
        if (m && m.groups) {
          const pkgName = m.groups.pkg.toLowerCase().replace(/_/g, "");
          if (!Object.keys(ports).includes(pkgName)) {
            if (m.groups.cmd) {
              if (m.groups.cmd.trim().startsWith("-s")) {
                ports[pkgName] = m.groups.cmd.trim().replace("-s", "");
              } else ports[pkgName] = m.groups.cmd;
            } else {
              switch (m.groups.pkg) {
                case "SDL2_net":
                  ports[pkgName] = "USE_SDL_NET=2";
                  break;
                case "SDL2_gfx":
                  ports[pkgName] = "USE_SDL_GFX=2";
                  break;
                default: // no special handling for other libraries
              }
            }
          }
        } else if (line.trim() === "cocos2d") {
          ports["cocos2d"] = "USE_COCOS2D=3";
        }
      }
    }
  }
  return ports;
}

class DepCheckAdvisorFactory implements IAdvisorFactory {
  name = "DepCheckAdvisorFactory";
  desc = "Use this factory class to create DepCheckAdvisor instance";

  createAdvisor(): IAdvisor {
    return new DepCheckAdvisor();
  }
}

class DepCheckAdvisor implements IAdvisor {
  static __type__ = "DepCheckAdvisor";
  type = DepCheckAdvisor.__type__;
  desc = "Advise issues related to project dependencies";

  private async _generateDepCheckAdviseForCMake(
    proj: IProject,
    req: PlainAdviseRequest,
    emPorts: H.Dict<string>
  ): Promise<IAdviseResult> {
    // generate for CMake - find find_package(<packageName> REQUIRED) pattern
    const pkgReg = /find_package\((\s*)?(?<pkg>\S*) .*REQUIRED.*\)/;
    const libraryReg = /\${(.+?)(_LIBRARIES|_INCLUDE_DIRS)}/;
    // store the regex pattern of the statements that lead cmake
    // construction errors
    const fatalBlackListReg: RegExp[] = [/string\(.*\)/];
    const actions = [] as IAction[];
    const nonPorts = [] as string[];
    const rawBuilders = proj.config.getBuildConfigForTarget(proj.config.target).rawBuilders;
    if (rawBuilders) {
      const workingDir = (
        rawBuilders[findFirstBuilder(proj, "CMakeBuilder")].rootBuildFilePath as string
      ).replace("${projectRoot}", proj.root);
      const file = path.join(workingDir, "CMakeLists.txt");
      const relative = path.relative(proj.root, file);
      if (
        fs.existsSync(file) &&
        relative &&
        !relative.startsWith("..") &&
        !path.isAbsolute(relative)
      ) {
        const lines = fs.readFileSync(file, "utf-8").split("\n");
        const resolvedPkgs: string[] = [];
        const uselessParamsLocationMap = new Map<number, string>();
        for (let i = 0; i < lines.length; i++) {
          // ignore comment out lines and empty lines
          if (lines[i].trim().length > 0 && !lines[i].trim().startsWith("#")) {
            // check if this line is to find dependent package
            const m = lines[i].match(pkgReg);

            if (m && m.groups) {
              // handle variants of the emPorts names: SDL2_ttf -> sdl2ttf, SDL2ttf, etc.
              const pkgName = m.groups.pkg.toLowerCase().replace(/_/g, "");
              // dependent package is one of the emcc ports
              if (Object.keys(emPorts).includes(pkgName)) {
                // 1. remove find_package statement from CMakeLists.txt file
                actions.push(
                  new FileChangeAction(
                    proj.fileChangeManager,
                    `Remove \`find_package()\` statement for \`${
                      m.groups.pkg
                    }\` from \`CMakeLists.txt\` at line **${i + 1}**`,
                    new FileRegion(file, i + 1),
                    null
                  )
                );
                // 2. add related compiler and linker flags.
                // TODO. add more knowledge on possible fixes of other ported libraries
                const opt = "-s" + emPorts[pkgName].trim().split("=")[0];
                const val = emPorts[pkgName].trim().split("=")[1];
                const addCflags = [{ option: opt, value: val, type: "replace" }] as IArg[];
                const addLdflags = [{ option: opt, value: val, type: "replace" }] as IArg[];

                if (pkgName === "sdl2ttf") {
                  // add flags for preload font files for SDL2ttf package
                  const ttfFontFix = await preloadFontFiles(proj);
                  ttfFontFix.opts.forEach((opt) => {
                    addLdflags.push({ option: opt, value: null, type: "replace" });
                  });
                  actions.push(...ttfFontFix.actions);
                }

                actions.push(
                  new ConfigEnvChangeAction(
                    proj,
                    `Add compiler and linker flags to use Emscripten ported package of \`${m.groups.pkg}\``,
                    {
                      cflags: addCflags,
                      ldflags: addLdflags,
                    }
                  )
                );
                // only resolved packages that are ported by
                // emscripten and the compiler and linker flags for
                // this package are added can be added into
                // resolvedPkgs
                resolvedPkgs.push(pkgName);
              } else {
                nonPorts.push(m.groups.pkg);
              }
            } else {
              // check if this line is related to resolved packages
              // ${XXX_LIBRARIES} & ${XXX_INCLUDE_DIRS} are defined
              // from statement `find_package`, also should be
              // checked and resolved
              let matchLib;

              let lineContent = lines[i];
              const paramsSet = new Set<string>();
              while ((matchLib = libraryReg.exec(lineContent)) !== null) {
                const libName = matchLib[1].toLowerCase().replace(/_/g, "");
                // if this library has been resolved
                if (libName !== "" && resolvedPkgs.includes(libName)) {
                  // for the statements exists in black-list
                  const isFatal = fatalBlackListReg.some((reg) => {
                    if (reg.test(lines[i])) {
                      return true;
                    }
                  });
                  if (isFatal) {
                    actions.push(
                      new FileChangeAction(
                        proj.fileChangeManager,
                        `Comment useless statement for \`${libName}\` from \`CMakeLists.txt\` at line **${
                          i + 1
                        }**`,
                        new FileRegion(file, i + 1),
                        `# ${lines[i]}`
                      )
                    );
                    break;
                  }

                  paramsSet.add(matchLib[0]);
                  lineContent = lineContent.replace(matchLib[0], "");
                } else {
                  break;
                }
              }

              if (paramsSet.size > 0) {
                uselessParamsLocationMap.set(i + 1, [...paramsSet].join(", "));
              }
            }

            if (nonPorts.length > 0) {
              // show suggestion to user to build non EMCC ported dependent packages from source
              actions.push(
                new ShowSuggestionAction(
                  "option",
                  `We detect that your project depends on below required packages:\n${nonPorts.join(
                    ", "
                  )}\nHowever, we can't use native build versions of them. Instead, please build them from source with Webinizer first - add them to your dependent projects and then link them against the current main project.`,
                  null,
                  null
                )
              );
            }
          }
        }

        if (uselessParamsLocationMap.size > 0) {
          const tableHeader = `| Line | Parameter |\n|:---:|:---:|`;
          const tableContent = Array.from(uselessParamsLocationMap.entries())
            .map(([line, param]) => `| _**${line}**_ | \`${param}\``)
            .join("\n");
          const descPrefix = `Followings are the parameters and their location in \`CMakeLists.txt\` file,  which will be invalid after you click apply recipe button because webinizer will attempt to remove \`find_package\` for this package since it has been ported by emscripten.`;
          const descSuffix = `You could resolve them manually to avoid the possible interruption of cmake construction.`;
          const tableMd = `${descPrefix}\n${tableHeader}\n${tableContent}\n\n${descSuffix}`;

          // just define one action for these invalid parameters
          actions.push(new ShowSuggestionAction("error", tableMd, null, null));
        }
      }
    }

    if (actions.length > 0)
      return {
        handled: true,
        recipe: new Recipe(
          proj,
          "Recipe for checking project dependent packages",
          this,
          req,
          actions,
          true /* show no advisor */
        ),
        needPropagation: true,
      };
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
        const emPorts = await generateEmPorts();
        const rawBuilders = proj.config.getBuildConfigForTarget(proj.config.target).rawBuilders;
        // FIXME. currently we only support checking for CMake file
        if (
          rawBuilders &&
          ((rawBuilders[0].__type__ as string) === "CMakeBuilder" ||
            isPrevBuildersAllNative(proj, findFirstBuilder(proj, "CMakeBuilder")))
        ) {
          return this._generateDepCheckAdviseForCMake(proj, plainReq, emPorts);
        }
      }
    }
    return {
      handled: false,
    };
  }
}

// loading
export default function onload() {
  registerAdvisorFactory(DepCheckAdvisor.__type__, new DepCheckAdvisorFactory());
}
