/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import shlex from "shlex";
import { ALL_ACTION_FACTORIES } from "../action";
import { checkJsonType } from "../json_factory";
import { IAction, IArg, IJsonObject, Project as IProject } from "webinizer";

export function updateArgs(o: string, newArgs: IArg | IArg[]): string {
  //FIXME. implement this in a more general way
  // (i.e., 'merge' action with different separaters rather than " ")
  const oldArgs = shlex.split(o);
  for (const a of Array.isArray(newArgs) ? newArgs : [newArgs]) {
    let argSet = false;
    for (let i = 0; i < oldArgs.length; i++) {
      if (oldArgs[i].includes(a.option)) {
        if (a.type === "merge") {
          oldArgs[i] =
            a.value && !oldArgs[i].includes(a.value) ? oldArgs[i] + ` ${a.value}` : oldArgs[i];
          argSet = true;
          break;
        } else if (a.type === "replace") {
          oldArgs[i] = a.value ? `${a.option}=${a.value}` : a.option;
          argSet = true;
          break;
        } else if (a.type === "delete") {
          oldArgs[i] = a.value ? oldArgs[i].replace(a.value, "") : "";
          break;
        } else {
          // a.type == "deleteAll", we don't break here as we need to ensure all satisfied options
          // are removed.
          oldArgs[i] = "";
        }
      }
    }
    if (!argSet && a.type !== "delete" && a.type !== "deleteAll") {
      oldArgs.push(`${a.option}${a.value ? "=" + a.value : ""}`);
    }
  }
  return shlex.join(oldArgs.filter((o) => o));
}

export class BuilderArgsChangeAction implements IAction {
  static __type__ = "BuilderArgsChange";
  type = BuilderArgsChangeAction.__type__;
  proj: IProject;
  desc: string;
  args: IArg[];
  builderID: number;
  refresh: boolean;
  /**
   * An action to change the build step arguments
   * @param proj the Project object
   * @param desc action description
   * @param args args to be updated
   * @param builderID the builder to be updated with `args`
   * @param refresh whether refresh the cache or not when applying the action
   */
  constructor(proj: IProject, desc: string, args: IArg[], builderID: number, refresh = true) {
    this.proj = proj;
    this.desc = desc;
    this.args = args;
    this.builderID = builderID;
    this.refresh = refresh;
  }

  async apply(): Promise<boolean> {
    const buildConfig = this.proj.config.getBuildConfigForTarget(this.proj.config.target);
    const builders = buildConfig.rawBuilders;
    if (builders) {
      for (let i = 0; i < builders.length; i++) {
        if (builders[i].id === this.builderID) {
          // calculate the updated builders args @ apply instead of @ constructor
          const newArgs = updateArgs(builders[i].args as string, this.args);
          if (newArgs === (builders[i].args as string)) {
            // if no differences in updated args, simply return without any updates
            return true;
          } else {
            builders[i].args = newArgs;
            break;
          }
        }
      }
      buildConfig.updateBuildConfig(
        {
          builders: builders,
        },
        { refresh: this.refresh }
      );
      return true;
    }
    return false;
  }

  toJson(): IJsonObject {
    return {
      __type__: BuilderArgsChangeAction.__type__,
      desc: this.desc,
      args: this.args,
      builderID: this.builderID,
      refresh: this.refresh,
    };
  }

  static fromJson(proj: IProject, o: IJsonObject): BuilderArgsChangeAction {
    checkJsonType(BuilderArgsChangeAction.__type__, o);
    return new BuilderArgsChangeAction(
      proj,
      o.desc as string,
      o.args as IArg[],
      o.builderID as number,
      o.refresh as boolean
    );
  }
}

export default function onload() {
  ALL_ACTION_FACTORIES.register(BuilderArgsChangeAction.__type__, BuilderArgsChangeAction.fromJson);
}
