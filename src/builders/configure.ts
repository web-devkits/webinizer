/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import path from "path";
import shlex from "shlex";
import * as H from "../helper";
import { ALL_BUILDER_FACTORIES } from "../builder";
import { BuilderArgsChangeAction } from "../actions/args_change";
import { checkJsonType } from "../json_factory";
import { ErrorAdviseRequest } from "../advise_requests/common_requests";
import { isPrevBuildersAllNative } from "../builder";
import { buildDir, dependencyDir } from "../constants";
import {
  IBuilder,
  IBuilderFactory,
  IBuilderJson,
  IJsonObject,
  AdviseManager as IAdviseManager,
  Project as IProject,
} from "webinizer";

const log = H.getLogger("ConfigureBuildStep");

class ConfigureBuilderFactory implements IBuilderFactory {
  name = "configure";
  desc = "configure of the Autotools build system";
  detect(proj: IProject): ConfigureBuilder | null {
    log.info("... detecting configure file in", proj.root);
    const cfgFiles = H.matchFilePath("**/configure", proj.root, [dependencyDir]);
    if (cfgFiles.length > 0) {
      return new ConfigureBuilder(
        proj,
        0 /*set builder id as 0 by default*/,
        path.join("${projectRoot}", path.dirname(cfgFiles[0])),
        "" /*no args by default from detection*/
      );
    }
    return null;
  }

  createDefault(proj: IProject, args?: string): ConfigureBuilder {
    // use project root as default rootBuildFilePath
    return new ConfigureBuilder(proj, 0, "${projectRoot}", args || "");
  }

  fromJson(proj: IProject, o: IJsonObject, index: number): IBuilder {
    checkJsonType(ConfigureBuilder.__type__, o);
    return new ConfigureBuilder(
      proj,
      index,
      o.rootBuildFilePath as string,
      o.args ? (o.args as string) : ""
    );
  }
}

class ConfigureBuilder implements IBuilder {
  static __type__ = "ConfigureBuilder";
  type = ConfigureBuilder.__type__;
  desc = "configure";
  command = "emconfigure ./configure";
  args: string[];
  id: number;
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
    adviseManager.queueRequest(new ErrorAdviseRequest("cfg_args", errors, null, this.id));
    return;
  }

  private async _updatePrefixArg() {
    log.info("... add prefix arg");
    const argsChange = new BuilderArgsChangeAction(
      this._proj,
      `Add --prefix argument to configure options`,
      [
        {
          option: "--prefix",
          value: path.join("${projectRoot}", buildDir),
          type: "replace",
        },
      ],
      this.id,
      false /* no cache refresh as this is from builder to cache */
    );
    await argsChange.apply();

    // get the updated args for builder
    const rawBuilders = this._proj.config.getBuildConfigForTarget(
      this._proj.config.target
    ).rawBuilders;
    this.args = shlex.split(rawBuilders ? (rawBuilders[this.id].args as string) : "");
  }

  async build(adviseManager: IAdviseManager): Promise<boolean> {
    const dumpLog = (data: string) => {
      this._proj.log.update(data);
    };

    let envCmds = "";
    const buildConfig = this._proj.config.getBuildConfigForTarget(this._proj.config.target);
    // apply env variables to the first non-native builder
    if (this.id === 0 || isPrevBuildersAllNative(this._proj, this.id)) {
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
      envCmds =
        (compilerFlags ? `CFLAGS="${compilerFlags}" CXXFLAGS="${compilerFlags}" ` : "") +
        (linkerFlags ? `LDFLAGS="${linkerFlags}" ` : "");

      if (this._proj.config.isLibrary) {
        // define install path
        await this._updatePrefixArg();
        // update project prefix in `pkgConfig` field
        if (
          this._proj.evalTemplateLiterals(buildConfig.getPkgConfigEnv("prefix")) !==
          this._proj.constant.projectDist
        ) {
          buildConfig.setPkgConfigEnv(
            "prefix",
            this._proj.constant.projectDist.replace(this._proj.root, "${projectRoot}")
          );
        }
      }
    }

    // run cmd
    const cmd =
      envCmds +
      `${this.command} ` +
      (this.args
        ? shlex
            .join([...new Set(this.args.map((a) => this._proj.evalTemplateLiterals(a)))])
            .replace(/'/g, "")
        : "");
    log.info(`... running configure command: ${cmd}`, dumpLog);
    const results = await H.runCommand(
      cmd,
      { cwd: this._proj.evalTemplateLiterals(this._rootBuildFilePath) },
      dumpLog,
      dumpLog
    );

    if (results.code !== 0) {
      log.warn("configure ", `Got errors with return code ${results.code} ...`, dumpLog);
      await this._analyzeErrors(adviseManager, results.output + results.error);
      return false;
    } else {
      log.info(`... configure successfully!`, dumpLog);
      return true;
    }
  }
}

// loading
export default function onload() {
  ALL_BUILDER_FACTORIES.register(ConfigureBuilder.__type__, new ConfigureBuilderFactory());
}
