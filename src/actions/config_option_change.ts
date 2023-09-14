/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import * as H from "../helper";
import { ALL_ACTION_FACTORIES } from "../action";
import { checkJsonType } from "../json_factory";
import {
  BuildOptionType,
  IProjectBuildOptions,
  IAction,
  IJsonObject,
  Project as IProject,
} from "webinizer";

const log = H.getLogger("config_option_change");

export class ConfigOptionChangeAction implements IAction {
  static __type__ = "ConfigOptionChange";
  type = ConfigOptionChangeAction.__type__;
  proj: IProject;
  desc: string;
  properties = "options";
  partToUpdate: IProjectBuildOptions;
  /**
   * An action to change the project config options
   * @param proj the Project object
   * @param desc action description
   * @param partToUpdate the config part to be updated
   */
  constructor(proj: IProject, desc: string, partToUpdate: IProjectBuildOptions) {
    this.proj = proj;
    this.desc = desc;
    this.partToUpdate = partToUpdate;
  }

  async apply(): Promise<boolean> {
    // calculate the updated partToUpdate @ apply instead of @ creation to avoid conflicts
    log.info("partToUpdate is:", this.partToUpdate);
    const buildConfig = this.proj.config.getBuildConfigForTarget(this.proj.config.target);
    const updateOptions: IProjectBuildOptions = {};
    if (buildConfig.options) {
      Object.assign(updateOptions, buildConfig.options, this.partToUpdate);
    } else {
      Object.assign(updateOptions, this.partToUpdate);
    }
    buildConfig.updateBuildConfig(
      { options: updateOptions },
      { updateOptParts: Object.keys(this.partToUpdate) as BuildOptionType[] }
    );
    return true;
  }

  toJson(): IJsonObject {
    return {
      __type__: ConfigOptionChangeAction.__type__,
      desc: this.desc,
      properties: this.properties,
      partToUpdate: this.partToUpdate,
    };
  }

  static fromJson(proj: IProject, o: IJsonObject): ConfigOptionChangeAction {
    checkJsonType(ConfigOptionChangeAction.__type__, o);
    return new ConfigOptionChangeAction(proj, o.desc as string, o.partToUpdate as H.Dict<boolean>);
  }
}

export default function onload() {
  ALL_ACTION_FACTORIES.register(
    ConfigOptionChangeAction.__type__,
    ConfigOptionChangeAction.fromJson
  );
}
