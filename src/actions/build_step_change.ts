/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import * as H from "../helper";
import { ALL_ACTION_FACTORIES } from "../action";
import { checkJsonType } from "../json_factory";
import errorCode from "../error_code";
import { IAction, IJsonObject, IToJson, Project as IProject, IBuilderJson } from "webinizer";

const log = H.getLogger("build_step_change");

export class BuildStepRegion implements IToJson {
  iStart: number;
  iEnd: number;

  /**
   * Represent a region/index range of build steps. [iStart, iEnd), 0 indexed
   * @param iStart start of the region, 0 indexed
   * @param iEnd end of the region, default is the same as iStart
   */
  constructor(iStart: number, iEnd = iStart) {
    H.assert(iEnd >= iStart && iStart >= 0, "Invalid line numbers!");
    this.iStart = iStart;
    this.iEnd = iEnd;
  }

  static fromJson(o: IJsonObject): BuildStepRegion {
    checkJsonType("BuildStepRegion", o);
    return new BuildStepRegion(o.iStart as number, o.iEnd as number);
  }
  toJson(): IJsonObject {
    return {
      __type__: "BuildStepRegion",
      iStart: this.iStart,
      iEnd: this.iEnd,
    };
  }

  isIntersected(r: BuildStepRegion): boolean {
    // if iStart or iEnd in previous recorded BuildStepRegion - intersect
    return (
      (r.iStart <= this.iStart && this.iStart < r.iEnd) ||
      (r.iStart < this.iEnd && this.iEnd <= r.iEnd)
    );
  }

  /**
   * Index change if some build steps are changed previously
   * @param r The region that is changed previously
   * @param nNewSteps Number of build steps after changed this region
   * @returns Indexes shift for this change
   */
  indexesToAdjust(r: BuildStepRegion, nNewSteps: number): number {
    if (this.isIntersected(r)) {
      throw new H.WError(
        `indexesToAdjust: ${H.prettyFormat(this)} intersects with ${H.prettyFormat(r)}`,
        errorCode.WEBINIZER_ACTION_BUILDSTEP_INTERSECT
      );
    }
    if (r.iStart >= this.iEnd) {
      return 0;
    }
    return nNewSteps - (r.iEnd - r.iStart);
  }
}

export class BuildStepChangeManager {
  private _changes: BuildStepChangeAction[] = [];

  private _updateSteps(proj: IProject, region: BuildStepRegion, steps: IBuilderJson[]): boolean {
    const buildConfig = proj.config.getBuildConfigForTarget(proj.config.target);
    const builders = buildConfig.rawBuilders;
    if (builders && builders.length) {
      builders.splice(region.iStart, region.iEnd - region.iStart, ...steps);
      buildConfig.updateBuildConfig({ builders });
      return true;
    }
    return false;
  }

  async apply(action: BuildStepChangeAction): Promise<boolean> {
    const actualRegion = action.actualBuildStepRegion(this._changes);
    if (!actualRegion) {
      log.error("Build Step change conflicts for action", action);
      return false;
    }
    if (this._updateSteps(action.proj, actualRegion, action.newBuildSteps)) {
      this._changes.push(action);
      return true;
    }
    return false;
  }
}

export class BuildStepChangeAction implements IAction {
  static __type__ = "BuildStepChange";
  type = BuildStepChangeAction.__type__;
  proj: IProject;
  desc: string;
  region: BuildStepRegion;
  newBuildSteps: IBuilderJson[];
  nNewSteps = 0;
  /**
   * An action to change build steps
   * @param proj the project
   * @param desc action description
   * @param region the build step regions to change
   * @param newBuildSteps new build steps to change
   */
  constructor(
    proj: IProject,
    desc: string,
    region: BuildStepRegion,
    newBuildSteps: IBuilderJson[] | null
  ) {
    this.proj = proj;
    this.desc = desc;
    this.region = region;
    this.newBuildSteps = newBuildSteps || [];
    if (newBuildSteps) {
      this.nNewSteps = newBuildSteps.length;
    }
  }

  async apply(): Promise<boolean> {
    return await this.proj.buildStepChangeManager.apply(this);
  }

  toJson(): IJsonObject {
    return {
      __type__: BuildStepChangeAction.__type__,
      desc: this.desc,
      region: this.region.toJson(),
      newBuildSteps: this.newBuildSteps,
    };
  }

  static fromJson(proj: IProject, o: IJsonObject): BuildStepChangeAction {
    checkJsonType(BuildStepChangeAction.__type__, o);
    return new BuildStepChangeAction(
      proj,
      o.desc as string,
      BuildStepRegion.fromJson(o.region as IJsonObject),
      o.newBuildSteps as IBuilderJson[]
    );
  }

  actualBuildStepRegion(changes: BuildStepChangeAction[]): BuildStepRegion | null {
    let delta = 0;
    for (const c of changes) {
      try {
        delta += this.region.indexesToAdjust(c.region, c.nNewSteps);
      } catch (e) {
        log.error(
          "Build Steps change conflicts:",
          H.prettyFormat(this.region),
          H.prettyFormat(c.region)
        );
        return null;
      }
    }
    return new BuildStepRegion(this.region.iStart + delta, this.region.iEnd + delta);
  }
}

export default function onload() {
  ALL_ACTION_FACTORIES.register(BuildStepChangeAction.__type__, BuildStepChangeAction.fromJson);
}
