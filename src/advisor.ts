/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import chalk from "chalk";
import * as H from "./helper";
import { JsonFactories } from "./json_factory";
import { type Recipe } from "./recipe";
import { ErrorAdviseRequest } from "./advise_requests/common_requests";
import { advisorPipelineFactory } from "./advisor_pipeline";
import {
  AdviseManager as IAdviseManager,
  IAdviseRequest,
  IAdvisorFactory,
  Project as IProject,
} from "webinizer";

const log = H.getLogger("advisor");

export const ALL_ADVISE_REQUESTS_FACTORIES = new JsonFactories<IAdviseRequest>("AdviseRequest");

const _ALL_ADVISOR_FACTORIES = new Map<string, IAdvisorFactory>();

export class AdviseManager implements IAdviseManager {
  private _requestList: IAdviseRequest[] = [];
  proj: IProject;

  constructor(proj: IProject) {
    this.proj = proj;
  }

  queueRequest(req: IAdviseRequest) {
    this._requestList.push(req);
  }

  async advise(): Promise<Recipe[]> {
    let requests = this._requestList;
    const recipes: Recipe[] = [];
    while (requests.length > 0) {
      const req = requests.shift() as IAdviseRequest;
      log.info(`advising request with tag: ${req.tags}`);

      const pipelines = advisorPipelineFactory.createAdvisorPipeline(req.tags);
      let isBreak = false;
      for (const pipeline of pipelines) {
        for (const advisor of pipeline.advisors) {
          const result = await advisor.advise(this.proj, req, requests);
          if (result.handled) {
            log.info(`  - advised by ${advisor.type}`);
            if (result.recipe) {
              recipes.push(result.recipe);
            }
            // the advisor may change the rest of the queue
            if (result.newRequestQueue) {
              requests = result.newRequestQueue;
            }
            // this is the default behavior, i.e. a request is only handled by only one advisor
            if (!result.needPropagation) {
              isBreak = true;
              break;
            }
          }
        }
        if (isBreak) {
          break;
        }
      }

      // No recipe generated for the ErrorAdviseRequest, get errors_not_handled advisor and generate recipe.
      if (req instanceof ErrorAdviseRequest && !recipes.length) {
        const defaultErrorAdvisor =
          advisorFactoryFromType("ErrorsNotHandledAdvisor")?.createAdvisor();
        if (defaultErrorAdvisor) {
          const result = await defaultErrorAdvisor.advise(this.proj, req, requests);
          if (result.handled) {
            log.info(`  - errors not handled by Webinizer, running ${defaultErrorAdvisor.type}`);
            if (result.recipe) {
              recipes.push(result.recipe);
            }
          }
        }
      }
    }
    return recipes;
  }
}

export function registerAdvisorFactory(type: string, factory: IAdvisorFactory) {
  H.assert(
    !_ALL_ADVISOR_FACTORIES.has(type),
    `Already registered AdvisorFactory with type: ${type}`
  );

  _ALL_ADVISOR_FACTORIES.set(type, factory);

  log.info(
    `* ${chalk.yellowBright("<< AdvisorFactory >>")} - registered ${chalk.cyanBright(
      factory.name
    )} with type ${chalk.cyanBright(type)}`
  );
}

export function advisorFactoryFromType(type: string): IAdvisorFactory | null {
  return _ALL_ADVISOR_FACTORIES.get(type) || null;
}
