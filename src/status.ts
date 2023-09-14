/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import * as H from "./helper";
import { createHmac } from "crypto";
import fs from "graceful-fs";
import path from "path";

const log = H.getLogger("build_status");

/**
 * Build status type
 * ```
 * "building" - project is under building w/o recipes
 * "building_with_recipes" - project is under building w/ recipes
 * "idle_success" - project is idle after successful build
 * "idle_fail" - project is idle after failure build
 * "idle_default" - the initial idle status without any build
 * ```
 */
export type StatusType =
  | "building"
  | "building_with_recipes"
  | "idle_success"
  | "idle_fail"
  | "idle_default";

interface IChangeHash {
  configHash: string; // The hash code of the project config file
  codeChangeHash: string; // The hash code of the source code change
  untrackFileHash: string; // The hash code of the git untracked files
  commitHash: string; // The hash code of the latest git commit
}

/**
 * Build Status
 * @summary The singleton class that manages build status of all projects.
 */
class BuildStatus {
  private _buildStatus: Map<string, StatusType>;
  private _changeHash: Map<string, IChangeHash>;
  private static _instance: BuildStatus;

  private constructor() {
    this._buildStatus = new Map<string, StatusType>();
    this._changeHash = new Map<string, IChangeHash>();
  }

  static getInstance(): BuildStatus {
    if (!BuildStatus._instance) {
      BuildStatus._instance = new BuildStatus();
    }
    return BuildStatus._instance;
  }

  clearStatus() {
    this._buildStatus.clear();
    this._changeHash.clear();
  }

  private _hashcode(src: string): string {
    return createHmac("sha256", src).digest("hex");
  }

  private async _calculateChangeHash(root: string): Promise<IChangeHash> {
    let configHash = "";
    let codeChangeHash = "";
    let untrackFileHash = "";
    let commitHash = "";

    //Get config file hash
    const configPath = path.join(root, ".webinizer", "config.json");
    if (fs.existsSync(configPath)) {
      configHash = this._hashcode(fs.readFileSync(configPath, "utf-8"));
    }

    //Get source code change hash
    const ret1 = await H.runCommand("git diff", { cwd: root, silent: true });
    if (ret1.code === 0) {
      codeChangeHash = this._hashcode(ret1.output);
    }

    //Get the untrack file hash
    const ret2 = await H.runCommand("git status", { cwd: root, silent: true });
    if (ret2.code === 0) {
      const regMatchArr = ret2.output.match(/Untracked files:(.|\s)*\n\n/);
      if (regMatchArr !== null) {
        untrackFileHash = this._hashcode(regMatchArr[0]);
      }
    }

    //Get the latest commit hash
    const ret3 = await H.runCommand("git rev-parse HEAD", { cwd: root, silent: true });
    if (ret3.code === 0) {
      commitHash = ret3.output.trim();
    }

    return {
      configHash: configHash,
      codeChangeHash: codeChangeHash,
      untrackFileHash: untrackFileHash,
      commitHash: commitHash,
    };
  }

  private _isChangeHashEqual(
    value1: IChangeHash | undefined,
    value2: IChangeHash | undefined
  ): boolean {
    if (value1 === undefined && value2 === undefined) return true;
    if (value1 === undefined && value2 !== undefined) return false;
    if (value1 !== undefined && value2 === undefined) return false;
    if (
      (value1 as IChangeHash).commitHash === (value2 as IChangeHash).commitHash &&
      (value1 as IChangeHash).untrackFileHash === (value2 as IChangeHash).untrackFileHash &&
      (value1 as IChangeHash).configHash === (value2 as IChangeHash).configHash &&
      (value1 as IChangeHash).codeChangeHash === (value2 as IChangeHash).codeChangeHash
    )
      return true;

    return false;
  }

  async getBuildStatus(k: string): Promise<StatusType> {
    log.info(`... get status of project ${k}`);

    //When the build status is "idle_success" or "idle_fail", compare
    //the current change hash with the one store in the _changeHash Map.
    //If they are not equal, change the build status of the project as
    //"idle_default".
    if (this._buildStatus.get(k) === "idle_success" || this._buildStatus.get(k) === "idle_fail") {
      const currentChangeHash = await this._calculateChangeHash(k);
      if (!this._isChangeHashEqual(this.getChangeHash(k), currentChangeHash)) {
        this._buildStatus.set(k, "idle_default");
      }
    }

    return this._buildStatus.get(k) || "idle_default";
  }

  setBuildStatus(k: string, v: StatusType) {
    log.info(`... set status of project ${k} to ${v}`);
    this._buildStatus.set(k, v);
  }

  getChangeHash(k: string): IChangeHash | undefined {
    log.info(`... get change hash of project ${k}`);
    return this._changeHash.get(k);
  }

  async setChangeHash(k: string) {
    log.info(`... set change hash of project ${k}`);
    this._changeHash.set(k, await this._calculateChangeHash(k));
  }
}

export const buildStatus = BuildStatus.getInstance();
