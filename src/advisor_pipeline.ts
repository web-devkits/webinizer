/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

/**
 * AdvisorPipeline
 * @module
 */
import { advisorFactoryFromType } from "./advisor";
import * as H from "./helper";
import fs from "graceful-fs";
import path from "path";
import { WEBINIZER_SRC_HOME } from "./constants";
import errorCode from "./error_code";
import { IAdvisor, IJsonObject, IToJson } from "webinizer";

const log = H.getLogger("advisor_pipeline");

interface IAdvisorPipelineConfigItem {
  tag: string;
  advisors: IJsonObject[];
}

export interface IAdvisorPipeline {
  tag: string;
  advisors: IAdvisor[];
}

class AdvisorPipelineConfig implements IToJson {
  static __type__ = "AdvisorPipelineConfig";
  private _filePath = path.join(WEBINIZER_SRC_HOME, "advisor_pipelines.json");
  private _data: IJsonObject;

  constructor() {
    this._data = { __type__: AdvisorPipelineConfig.__type__ };
    if (fs.existsSync(this._filePath)) {
      this.load();
    }
  }

  toJson(): IJsonObject {
    return this._data;
  }

  get data(): IJsonObject {
    return this._data;
  }

  get pipelines(): IAdvisorPipelineConfigItem[] | undefined {
    return this.data.pipelines as IAdvisorPipelineConfigItem[];
  }

  get filePath(): string {
    return this._filePath;
  }

  private load() {
    try {
      const data = JSON.parse(fs.readFileSync(this._filePath, "utf8")) as IJsonObject;
      H.assert(data.__type__ === this.data.__type__);
      this._data = data;
      //eslint-disable-next-line
    } catch (err: any) {
      let errMsg;
      if (err.code === "ENOENT") {
        errMsg = `Tried to load ${this.data.__type__} from an nonexist file: ${this.filePath}`;
        log.error(errMsg);
        throw new H.WError(errMsg, errorCode.WEBINIZER_ADVISOR_PIPELINE_FILE_NOEXT);
      } else {
        errMsg =
          `Failed to load ${this.data.__type__} from file ${this.filePath} due to error:\n` +
          H.normalizeErrorOutput(err as Error);
        log.error(errMsg);
        throw new H.WError(errMsg, errorCode.WEBINIZER_ADVISOR_PIPELINE_FILE_LOAD_FAIL);
      }
    }
  }
}

class AdvisorPipelineFactory {
  private _config: AdvisorPipelineConfig;
  private static _instance: AdvisorPipelineFactory;

  private constructor() {
    this._config = new AdvisorPipelineConfig();
  }

  static getInstance(): AdvisorPipelineFactory {
    if (!AdvisorPipelineFactory._instance) {
      AdvisorPipelineFactory._instance = new AdvisorPipelineFactory();
    }
    return AdvisorPipelineFactory._instance;
  }

  private getPipelineItemFromTag(tag: string): IAdvisorPipelineConfigItem | null {
    if (this._config.pipelines !== undefined && this._config.pipelines.length > 0) {
      for (const item of this._config.pipelines) {
        if (item.tag === tag) {
          return item;
        }
      }
    }
    return null;
  }

  createAdvisorPipeline(tags: string | string[]): IAdvisorPipeline[] {
    const pipelines: IAdvisorPipeline[] = [];
    if (!Array.isArray(tags)) {
      tags = [tags];
    }

    for (const t of tags) {
      const pipelineItem = this.getPipelineItemFromTag(t);
      if (
        pipelineItem !== null &&
        pipelineItem.advisors != null &&
        pipelineItem.advisors.length > 0
      ) {
        const advisors: IAdvisor[] = [];
        for (const advisorItem of pipelineItem.advisors) {
          const factory = advisorFactoryFromType(advisorItem.__type__);
          if (factory != null) {
            advisorItem.args
              ? advisors.push(factory.createAdvisor(advisorItem.args as string))
              : advisors.push(factory.createAdvisor());
          }
        }
        pipelines.push({ tag: t, advisors: advisors });
      }
    }

    return pipelines;
  }
}

export const advisorPipelineFactory = AdvisorPipelineFactory.getInstance();
