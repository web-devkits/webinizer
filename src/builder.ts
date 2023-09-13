/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

/**
 * Builder
 * @module
 */
import * as H from "./helper";
import { JsonFactories } from "./json_factory";
import { IBuilder, IBuilderFactory, Project as IProject } from "webinizer";

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
const log = H.getLogger("builder");

export const ALL_BUILDER_FACTORIES = new JsonFactories<IBuilder, IBuilderFactory>("Builder");

export function isPrevBuildersAllNative(proj: IProject, idx: number): boolean {
  const builders = proj.config.getBuildConfigForTarget(proj.config.target).rawBuilders;
  if (builders && builders.length && idx >= 0 && idx < builders.length) {
    for (let i = 0; i < idx; i++) {
      if (
        builders[i].__type__ === "NativeBuilder" ||
        (builders[i].__type__ === "MakeBuilder" && (builders[i].args as string).includes("clean"))
      )
        continue;
      else {
        return false;
      }
    }
    return true;
  }
  return false;
}

export function findFirstBuilder(proj: IProject, builder: string): number {
  const builders = proj.config.getBuildConfigForTarget(proj.config.target).rawBuilders;
  if (builders) {
    const builderArr = builders.map((b) => b.__type__);
    return builderArr.findIndex((v) => v === builder);
  }
  return -1;
}
