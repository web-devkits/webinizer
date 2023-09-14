/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import * as H from "../helper";
import { ALL_ACTION_FACTORIES } from "../action";
import { checkJsonType } from "../json_factory";
import { updateArgs } from "./args_change";
import { EnvType, ProjectEnv, IAction, IArg, IJsonObject, Project as IProject } from "webinizer";

const log = H.getLogger("config_env_change");

export class ConfigEnvChangeAction implements IAction {
  static __type__ = "ConfigEnvChange";
  type = ConfigEnvChangeAction.__type__;
  proj: IProject;
  desc: string;
  properties = "envs";
  partToUpdate: Partial<Record<EnvType, IArg[]>>;
  /**
   * An action to change the project compiler and linker flags
   * @param proj the Project object
   * @param desc action description
   * @param partToUpdate the envs args to be updated
   */
  constructor(proj: IProject, desc: string, partToUpdate: Partial<Record<EnvType, IArg[]>>) {
    this.proj = proj;
    this.desc = desc;
    this.partToUpdate = partToUpdate;
  }

  async apply(): Promise<boolean> {
    // calculate the updated partToUpdate @ apply instead of @ creation to avoid conflicts
    log.info("partToUpdate is:", this.partToUpdate);
    const envParts = Object.keys(this.partToUpdate) as EnvType[];
    const buildConfig = this.proj.config.getBuildConfigForTarget(this.proj.config.target);
    const updateEnv = (envs: ProjectEnv, k: EnvType, args: IArg | IArg[]) => {
      log.info(`... to update ${k} with args to change are \n`, args);
      // update envs and save
      if (envs) {
        const updatedArgs = updateArgs(envs[k], args);
        if (updatedArgs !== envs[k]) {
          envs[k] = updatedArgs;
        }
      }
    };
    const envsToUpdate = Object.assign({}, buildConfig.envs);
    for (const env of envParts) {
      updateEnv(envsToUpdate, env, this.partToUpdate[env] as IArg[]);
    }
    buildConfig.updateBuildConfig({ envs: envsToUpdate }, { updateEnvParts: envParts });
    return true;
  }

  toJson(): IJsonObject {
    return {
      __type__: ConfigEnvChangeAction.__type__,
      desc: this.desc,
      properties: this.properties,
      partToUpdate: this.partToUpdate,
    };
  }

  static fromJson(proj: IProject, o: IJsonObject): ConfigEnvChangeAction {
    checkJsonType(ConfigEnvChangeAction.__type__, o);
    return new ConfigEnvChangeAction(proj, o.desc as string, o.partToUpdate as H.Dict<IArg[]>);
  }
}

export default function onload() {
  ALL_ACTION_FACTORIES.register(ConfigEnvChangeAction.__type__, ConfigEnvChangeAction.fromJson);
}
