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
import { isPrevBuildersAllNative } from "../builder";
import { dependencyDir } from "../constants";
import {
  IBuilder,
  IBuilderFactory,
  IBuilderJson,
  IJsonObject,
  AdviseManager as IAdviseManager,
  Project as IProject,
} from "webinizer";

const log = H.getLogger("MakeBuildStep");

class MakeBuilderFactory implements IBuilderFactory {
  name = "emmake (in place of Make)";
  desc = "Use this builder if native project is built with Make";
  detect(proj: IProject): MakeBuilder | null {
    log.info("... detecting Makefile in", proj.root);
    const makeFiles = H.matchFilePath("**/Makefile", proj.root, [dependencyDir]);
    if (makeFiles.length > 0) {
      return new MakeBuilder(
        proj,
        0 /*set builder id as 0 by default*/,
        path.join("${projectRoot}", path.dirname(makeFiles[0])),
        "" /*no args by default from detection*/
      );
    }
    return null;
  }

  createDefault(proj: IProject, args?: string): MakeBuilder {
    // use project root as default rootBuildFilePath
    return new MakeBuilder(proj, 0, "${projectRoot}", args || "");
  }

  fromJson(proj: IProject, o: IJsonObject, index: number): IBuilder {
    checkJsonType(MakeBuilder.__type__, o);
    return new MakeBuilder(
      proj,
      index,
      o.rootBuildFilePath as string,
      o.args ? (o.args as string) : ""
    );
  }
}

class MakeBuilder implements IBuilder {
  static __type__ = "MakeBuilder";
  type = MakeBuilder.__type__;
  desc = "make";
  id: number;
  private _proj: IProject;
  private _rootBuildFilePath: string; // file dirname (w/o file name)
  args: string[]; // build args
  constructor(proj: IProject, id: number, rootBuildFilePath: string, args: string) {
    this._proj = proj;
    this.id = id;
    this._rootBuildFilePath = rootBuildFilePath;
    this.args = shlex.split(args);
  }
  toJson(): IBuilderJson {
    return {
      __type__: MakeBuilder.__type__,
      id: this.id,
      desc: this.desc,
      args: shlex.join(this.args),
      rootBuildFilePath: this._rootBuildFilePath,
    };
  }

  private async _analyzeErrors(adviseManager: IAdviseManager, errors: string) {
    adviseManager.queueRequest(new ErrorAdviseRequest(["cfg_args", "make"], errors, null, this.id));
    return;
  }

  async build(adviseManager: IAdviseManager): Promise<boolean> {
    const dumpLog = (data: string) => {
      this._proj.log.update(data);
    };

    let envCmds = "";
    const buildConfig = this._proj.config.getBuildConfigForTarget(this._proj.config.target);
    // apply env variables to the first non-native non-clean builder
    if (
      (this.id === 0 || (this.id !== 0 && isPrevBuildersAllNative(this._proj, this.id))) &&
      !this.args.includes("clean")
    ) {
      // general env methods, remove "'" from cmds
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
        ? `PREFIX=${this._proj.constant.projectDist} `
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
        (compilerFlags ? `CFLAGS="${compilerFlags}" CXXFLAGS="${compilerFlags}" ` : "") +
        (linkerFlags ? `LDFLAGS="${linkerFlags}" ` : "") +
        prefixFlags;
    }

    const cmd =
      envCmds +
      "emmake make -j4 " +
      (this.args
        ? shlex
            .join([...new Set(this.args.map((a) => this._proj.evalTemplateLiterals(a)))])
            .replace(/'/g, "")
        : "");
    log.info(`... running emmake command: ${cmd}`, dumpLog);
    const results = await H.runCommand(
      cmd,
      { cwd: this._proj.evalTemplateLiterals(this._rootBuildFilePath) },
      dumpLog,
      dumpLog
    );

    if (results.code !== 0) {
      log.warn("Make ", `Got errors with return code ${results.code} ...`, dumpLog);
      await this._analyzeErrors(adviseManager, results.all);
      return false;
    } else {
      log.info(`... make successfully!`, dumpLog);
      return true;
    }
  }
}

// loading
export default function onload() {
  ALL_BUILDER_FACTORIES.register(MakeBuilder.__type__, new MakeBuilderFactory());
}
