/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import path from "path";
import shlex from "shlex";
import * as H from "../helper";
import { ALL_BUILDER_FACTORIES } from "../builder";
import { checkJsonType } from "../json_factory";
import { ErrorAdviseRequest } from "../advise_requests/common_requests";
import { getFileLocation } from "../actions/file_change";
import { isPrevBuildersAllNative } from "../builder";
import { dependencyDir } from "../constants";
import {
  IBuilder,
  IBuilderFactory,
  IBuilderJson,
  IBuilderOptions,
  IJsonObject,
  AdviseManager as IAdviseManager,
  Project as IProject,
} from "webinizer";

const log = H.getLogger("CMakeBuildStep");

class CMakeBuilderFactory implements IBuilderFactory {
  name = "emcmake (in place of CMake)";
  desc = "Use this builder if native project is built with CMake";
  detect(proj: IProject): CMakeBuilder | null {
    log.info("... detecting CMakeLists.txt in", proj.root);
    const cmakeFiles = H.matchFilePath("**/CMakeLists.txt", proj.root, [dependencyDir]);
    if (cmakeFiles.length > 0) {
      return new CMakeBuilder(
        proj,
        0 /*set builder id as 0 by default*/,
        path.join("${projectRoot}", path.dirname(cmakeFiles[0])),
        "" /*no args by default from detection*/
      );
    }
    return null;
  }

  createDefault(proj: IProject, options?: IBuilderOptions): CMakeBuilder {
    return new CMakeBuilder(
      proj,
      0,
      options?.rootBuildFilePath || "${projectRoot}",
      options?.args || ""
    );
  }

  fromJson(proj: IProject, o: IJsonObject, index: number): IBuilder {
    checkJsonType(CMakeBuilder.__type__, o);
    return new CMakeBuilder(
      proj,
      index,
      o.rootBuildFilePath as string,
      o.args ? (o.args as string) : ""
    );
  }
}

class CMakeBuilder implements IBuilder {
  static __type__ = "CMakeBuilder";
  type = CMakeBuilder.__type__;
  desc = "CMake";
  command = "emcmake cmake";
  id: number;
  args: string[];
  private _proj: IProject;
  private _rootBuildFilePath: string; // file dirname (w/o file name)
  constructor(proj: IProject, id: number, rootBuildFilePath: string, args: string) {
    this._proj = proj;
    this.id = id;
    this._rootBuildFilePath = rootBuildFilePath;
    this.args = shlex.split(args);
  }
  toJson(): IBuilderJson {
    return {
      __type__: this.type,
      id: this.id,
      desc: this.desc,
      command: this.command,
      args: shlex.join(this.args),
      rootBuildFilePath: this._rootBuildFilePath,
    };
  }

  private async _analyzeErrors(adviseManager: IAdviseManager, errors: string) {
    let isAdvised = false;
    const blocks = errors.split("\n\n");
    // each error should start from "CMake Error"
    const errorHeader = "CMake Error";
    for (const block of blocks) {
      const lines = block.trim().split("\n");
      let i;
      for (i = 0; i < lines.length; ++i) {
        if (lines[i].trimStart().startsWith(errorHeader)) {
          break;
        }
      }
      if (i < lines.length) {
        const err = lines.slice(i).join("\n");
        // pass the entire block of error message instead of a single line to get file location
        // use getFileLocation() from first line will not capture the error line from file CMakeLists.txt correctly
        // i.e., get "/usr/share/cmake-3.10/Modules/FindPackageHandleStandardArgs.cmake:137" but need "CMakeLists.txt:15 (find_package)""
        // search from last line instead (entry of callstack)
        adviseManager.queueRequest(
          new ErrorAdviseRequest(
            "cmake",
            err,
            getFileLocation(err, true /*search from last*/),
            this.id
          )
        );
        if (!isAdvised) isAdvised = true;
      }
    }
    if (!isAdvised) {
      // if the error log is not captured with `errorHeader`, send an `ErrorAdviseRequest` with the whole error log
      adviseManager.queueRequest(new ErrorAdviseRequest("cmake", errors, null, this.id));
    }
  }

  async build(adviseManager: IAdviseManager): Promise<boolean> {
    const dumpLog = (data: string) => {
      this._proj.log.update(data);
    };

    let envCmds = "";
    const buildConfig = this._proj.config.getBuildConfigForTarget(this._proj.config.target);
    // apply env variables to the first non-native builder
    if (this.id === 0 || isPrevBuildersAllNative(this._proj, this.id)) {
      // cmake specific methods, remove "'" from cmds
      const compilerFlags = this._proj.config.getOverallEnv("cflags")
        ? shlex
            .join([
              ...new Set(
                shlex.split(
                  this._proj.evalTemplateLiterals(this._proj.config.getOverallEnv("cflags"))
                )
              ),
            ])
            .replace(/'/g, "")
        : "";
      const linkerFlags = this._proj.config.getOverallEnv("ldflags")
        ? shlex
            .join([
              ...new Set(
                shlex.split(
                  this._proj.evalTemplateLiterals(this._proj.config.getOverallEnv("ldflags"))
                )
              ),
            ])
            .replace(/'/g, "")
        : "";
      // define install path
      const prefixFlags = this._proj.config.isLibrary
        ? ` -DCMAKE_INSTALL_PREFIX=${this._proj.constant.projectDist}`
        : "";
      // update project prefix in `pkgConfig` field
      if (
        prefixFlags &&
        this._proj.evalTemplateLiterals(buildConfig.getPkgConfigEnv("prefix")) !==
          this._proj.constant.projectDist
      ) {
        buildConfig.setPkgConfigEnv(
          "prefix",
          this._proj.constant.projectDist.replace(this._proj.root, "${projectRoot}")
        );
      }
      envCmds =
        (compilerFlags
          ? ` -DCMAKE_C_FLAGS="${compilerFlags}" -DCMAKE_CXX_FLAGS="${compilerFlags}"`
          : "") +
        (linkerFlags ? ` -DCMAKE_EXE_LINKER_FLAGS="${linkerFlags}"` : "") +
        prefixFlags;
    }

    const cmd =
      `${this.command} ./ ` +
      (this.args
        ? shlex
            .join([...new Set(this.args.map((a) => this._proj.evalTemplateLiterals(a)))])
            .replace(/'/g, "")
        : "") +
      envCmds;
    log.info(`... running emcmake command: ${cmd}`, dumpLog);
    const results = await H.runCommand(
      cmd,
      { cwd: this._proj.evalTemplateLiterals(this._rootBuildFilePath) },
      dumpLog,
      dumpLog
    );

    if (results.code !== 0) {
      log.warn("CMake ", `Got errors with return code ${results.code} ...`, dumpLog);
      await this._analyzeErrors(adviseManager, results.error);
      return false;
    } else {
      log.info(`... cmake successfully!`, dumpLog);
      return true;
    }
  }
}

// loading
export default function onload() {
  ALL_BUILDER_FACTORIES.register(CMakeBuilder.__type__, new CMakeBuilderFactory());
}
