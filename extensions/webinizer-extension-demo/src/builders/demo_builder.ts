/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import shlex from "shlex";
import * as webinizer from "webinizer";

const log = webinizer.getLogger("DemoBuilderStep");

class DemoBuilderFactory implements webinizer.IBuilderFactory {
  name = "demo_builder";
  desc = "Demo builder for webinizer extension demo";
  /* eslint-disable @typescript-eslint/no-unused-vars */
  detect(proj: webinizer.Project): DemoBuilder | null {
    // TODO. implement detect here
    return null;
  }

  createDefault(proj: webinizer.Project, args?: string): DemoBuilder {
    // use project root as default rootBuildFilePath
    return new DemoBuilder(proj, 0, "${projectRoot}", args || "");
  }

  fromJson(proj: webinizer.Project, o: webinizer.IJsonObject, index: number): webinizer.IBuilder {
    webinizer.checkJsonType(DemoBuilder.__type__, o);
    return new DemoBuilder(
      proj,
      index,
      o.rootBuildFilePath as string,
      o.args ? (o.args as string) : ""
    );
  }
}

class DemoBuilder implements webinizer.IBuilder {
  static __type__ = "DemoBuilder";
  type = DemoBuilder.__type__;
  desc = "demo builder";
  args: string[];
  id: number;
  private _proj: webinizer.Project;
  private _rootBuildFilePath: string;

  constructor(proj: webinizer.Project, id: number, rootBuildFilePath: string, args: string) {
    this._proj = proj;
    this.id = id;
    this.args = shlex.split(args);
    this._rootBuildFilePath = rootBuildFilePath;
  }
  toJson(): webinizer.IBuilderJson {
    return {
      __type__: this.type,
      id: this.id,
      desc: this.desc,
      args: shlex.join(this.args),
      rootBuildFilePath: this._rootBuildFilePath,
    };
  }

  private async _analyzeErrors(adviseManager: webinizer.AdviseManager, errors: string) {
    adviseManager.queueRequest(new webinizer.ErrorAdviseRequest(["demo"], errors, null, this.id));
    return;
  }

  async build(adviseManager: webinizer.AdviseManager): Promise<boolean> {
    log.info("Start the build of demo builder...");
    const error = "demo builder error";
    await this._analyzeErrors(adviseManager, error);
    return false;
  }
}

// loading
export default function onload() {
  webinizer.ALL_BUILDER_FACTORIES.register(DemoBuilder.__type__, new DemoBuilderFactory());
}
