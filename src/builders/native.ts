/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import * as H from "../helper";
import { ALL_BUILDER_FACTORIES } from "../builder";
import { ErrorAdviseRequest } from "../advise_requests/common_requests";
import { checkJsonType } from "../json_factory";
import {
  IBuilder,
  IBuilderFactory,
  IBuilderJson,
  IJsonObject,
  AdviseManager as IAdviseManager,
  Project as IProject,
} from "webinizer";

const log = H.getLogger("NativeCommand");

class NativeBuilderFactory implements IBuilderFactory {
  name = "native commands";
  desc = "Use this to run native commands without Emscripten related configs";
  /* eslint-disable @typescript-eslint/no-unused-vars */
  detect(proj: IProject): NativeBuilder | null {
    return null;
  }

  createDefault(proj: IProject, args?: string): NativeBuilder {
    // use project root as default rootBuildFilePath
    return new NativeBuilder(proj, 0, "${projectRoot}", args || "");
  }

  fromJson(proj: IProject, o: IJsonObject, index: number): IBuilder {
    checkJsonType(NativeBuilder.__type__, o);
    return new NativeBuilder(
      proj,
      index,
      o.rootBuildFilePath as string,
      o.args ? (o.args as string) : ""
    );
  }
}

class NativeBuilder implements IBuilder {
  static __type__ = "NativeBuilder";
  type = NativeBuilder.__type__;
  desc = "Run native commands without emscripten related configs";
  command = ""; // no pre-defined command for native builder as it may vary
  args: string[];
  id: number;
  private _proj: IProject;
  private _rootBuildFilePath: string;

  constructor(proj: IProject, id: number, rootBuildFilePath: string, args: string) {
    this._proj = proj;
    this.id = id;
    this.args = [args]; // don't operate on the args but execute directly
    this._rootBuildFilePath = rootBuildFilePath;
  }
  toJson(): IBuilderJson {
    return {
      __type__: this.type,
      id: this.id,
      desc: this.desc,
      command: this.command,
      args: this.args[0],
      rootBuildFilePath: this._rootBuildFilePath,
    };
  }

  private async _analyzeErrors(adviseManager: IAdviseManager, errors: string) {
    adviseManager.queueRequest(new ErrorAdviseRequest(["native"], errors, null, this.id));
    return;
  }

  async build(adviseManager: IAdviseManager): Promise<boolean> {
    const dumpLog = (data: string) => {
      this._proj.log.update(data);
    };

    const cmd = this._proj.evalTemplateLiterals(this.args[0]);
    log.info(`... running native command: ${cmd}`, dumpLog);
    const results = await H.runCommand(
      cmd,
      { cwd: this._proj.evalTemplateLiterals(this._rootBuildFilePath) },
      dumpLog,
      dumpLog
    );

    if (results.code !== 0) {
      log.warn(
        "Native command ",
        `${cmd} `,
        `Got errors with return code ${results.code}...`,
        dumpLog
      );
      await this._analyzeErrors(adviseManager, results.error);
      return false;
    } else {
      log.info(`... native command runs successfully!`, dumpLog);
      return true;
    }
  }
}

// loading
export default function onload() {
  ALL_BUILDER_FACTORIES.register(NativeBuilder.__type__, new NativeBuilderFactory());
}
