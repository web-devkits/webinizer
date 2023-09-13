/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

/**
 * Recipe
 * @module
 */

import * as H from "./helper";
import { ALL_ADVISE_REQUESTS_FACTORIES, advisorFactoryFromType } from "./advisor";
import { ALL_ACTION_FACTORIES } from "./action";
import { checkJsonType } from "./json_factory";
import errorCode from "./error_code";
import {
  IAction,
  IAdvisor,
  IAdviseRequest,
  IJsonObject,
  IToJson,
  Project as IProject,
} from "webinizer";

const log = H.getLogger("recipe");

export class Recipe implements IToJson {
  proj: IProject;
  desc: string; // recipe description
  advisor: IAdvisor; // which advisor generates this
  requests: IAdviseRequest[]; // the requests that generate this
  actions: IAction[];
  showNoAdvisor = false;
  constructor(
    proj: IProject,
    desc: string,
    advisor: IAdvisor,
    requests: IAdviseRequest | IAdviseRequest[],
    actions: IAction | IAction[],
    showNoAdvisor?: boolean
  ) {
    this.proj = proj;
    this.advisor = advisor;
    if (!Array.isArray(requests)) {
      requests = [requests];
    }
    if (!Array.isArray(actions)) {
      actions = [actions];
    }
    this.requests = requests;
    this.actions = actions;
    this.desc = desc;
    if (showNoAdvisor) this.showNoAdvisor = showNoAdvisor;
  }

  async apply(): Promise<boolean> {
    log.info("... apply actions");
    for (const action of this.actions) {
      await action.apply();
    }
    return true;
  }

  toJson(): IJsonObject {
    return {
      __type__: "Recipe",
      proj: this.proj.root,
      desc: this.desc,
      advisor: this.advisor.type,
      requests: this.requests.map((r) => r.toJson()),
      actions: this.actions.map((a) => a.toJson()),
      showNoAdvisor: this.showNoAdvisor,
    };
  }
}

export function recipeFromJson(proj: IProject, o: IJsonObject): Recipe | null {
  checkJsonType("Recipe", o);
  const advisor = advisorFactoryFromType(o.advisor as string)?.createAdvisor();
  if (!advisor) {
    throw new H.WError(
      `Unknown advisor type ${o.advisor} is used.`,
      errorCode.WEBINIZER_ADVISOR_UNKNOWN
    );
  }
  return new Recipe(
    proj,
    o.desc as string,
    advisor,
    ALL_ADVISE_REQUESTS_FACTORIES.fromJsonArray(proj, o.requests as IJsonObject[]),
    ALL_ACTION_FACTORIES.fromJsonArray(proj, o.actions as IJsonObject[]),
    o.showNoAdvisor as boolean
  );
}

export function recipeArrayFromJson(proj: IProject, arr: IJsonObject[]): Recipe[] | null {
  const r: Recipe[] = [];
  arr.map((json) => {
    const o = recipeFromJson(proj, json);
    if (o) r.push(o);
  });
  return r;
}
