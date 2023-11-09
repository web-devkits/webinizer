/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import shlex from "shlex";
import * as H from "../helper";
import { ALL_BUILDER_FACTORIES } from "../builder";
import { ErrorAdviseRequest } from "../advise_requests/common_requests";
import { checkJsonType } from "../json_factory";
import {
  IBuilder,
  IBuilderFactory,
  IBuilderJson,
  IBuilderOptions,
  IJsonObject,
  AdviseManager as IAdviseManager,
  Project as IProject,
} from "webinizer";

const log = H.getLogger("EmccBuildStep");

class EmccBuilderFactory implements IBuilderFactory {
  name = "emcc (in place of CC)";
  desc = "Use this if native project is built with CC (gcc, clang etc.)";
  /* eslint-disable @typescript-eslint/no-unused-vars */
  detect(proj: IProject): EmccBuilder | null {
    return null;
  }

  createDefault(proj: IProject, options?: IBuilderOptions): EmccBuilder {
    return new EmccBuilder(
      proj,
      0,
      options?.rootBuildFilePath || "${projectRoot}",
      options?.args || ""
    );
  }

  fromJson(proj: IProject, o: IJsonObject, index: number): IBuilder {
    checkJsonType(EmccBuilder.__type__, o);
    return new EmccBuilder(
      proj,
      index,
      o.rootBuildFilePath as string,
      o.args ? (o.args as string) : ""
    );
  }
}

class EmccBuilder implements IBuilder {
  static __type__ = "EmccBuilder";
  type = EmccBuilder.__type__;
  desc = "emcc";
  command = "emcc";
  args: string[];
  id: number;
  private _proj: IProject;
  private _rootBuildFilePath: string;

  constructor(proj: IProject, id: number, rootBuildFilePath: string, args: string) {
    this._proj = proj;
    this.id = id;
    this.args = shlex.split(args);
    this._rootBuildFilePath = rootBuildFilePath;
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
    adviseManager.queueRequest(
      new ErrorAdviseRequest(["cfg_args", "make", "cmake"], errors, null, this.id)
    );
    return;
  }

  async build(adviseManager: IAdviseManager): Promise<boolean> {
    const dumpLog = (data: string) => {
      this._proj.log.update(data);
    };

    // get the union of compiler, linker flags and builder args and apply to emcc directly
    const argsUnion = [
      ...new Set([
        ...(this._proj.config.getOverallEnv("cflags")
          ? shlex.split(this._proj.evalTemplateLiterals(this._proj.config.getOverallEnv("cflags")))
          : []),
        ...(this._proj.config.getOverallEnv("ldflags")
          ? shlex.split(this._proj.evalTemplateLiterals(this._proj.config.getOverallEnv("ldflags")))
          : []),
        ...this.args.map((a) => this._proj.evalTemplateLiterals(a)),
      ]),
    ];

    const cmd = `${this.command} ` + shlex.join(argsUnion).replace(/'/g, "");
    log.info(`... running emcc command: ${cmd}`, dumpLog);
    const results = await H.runCommand(
      cmd,
      { cwd: this._proj.evalTemplateLiterals(this._rootBuildFilePath) },
      dumpLog,
      dumpLog
    );

    if (results.code !== 0) {
      log.warn("emcc ", `Got errors with return code ${results.code}...`, dumpLog);
      await this._analyzeErrors(adviseManager, results.error);
      return false;
    } else {
      log.info(`... emcc successfully!`, dumpLog);
      return true;
    }
  }
}

// loading
export default function onload() {
  ALL_BUILDER_FACTORIES.register(EmccBuilder.__type__, new EmccBuilderFactory());
}
