/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import * as H from "../helper";
import { ALL_ACTION_FACTORIES } from "../action";
import { checkJsonType } from "../json_factory";
import { IAction, IJsonObject, Project as IProject } from "webinizer";

const log = H.getLogger("show_dep_recipe");

export class ShowDepRecipeAction implements IAction {
  static __type__ = "ShowDepRecipe";
  type = ShowDepRecipeAction.__type__;
  desc: string;
  deps: string[];
  /**
   * An action to show dependent projects that have recipes generated
   * @param desc action description
   * @param deps dependent projects
   */
  constructor(desc: string, deps: string[]) {
    this.desc = desc;
    this.deps = deps;
  }

  async apply(): Promise<boolean> {
    log.info("Dependent projects that have recipes generated:\n", `${this.deps.join("\n")}`);
    return true;
  }

  toJson(): IJsonObject {
    return {
      __type__: ShowDepRecipeAction.__type__,
      desc: this.desc,
      deps: this.deps,
    };
  }

  static fromJson(proj: IProject, o: IJsonObject): ShowDepRecipeAction {
    checkJsonType(ShowDepRecipeAction.__type__, o);
    return new ShowDepRecipeAction(o.desc as string, o.deps as string[]);
  }
}

export default function onload() {
  ALL_ACTION_FACTORIES.register(ShowDepRecipeAction.__type__, ShowDepRecipeAction.fromJson);
}
