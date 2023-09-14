/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

/**
 * Package Metadata - represent package.json
 * @module
 */

import Ajv, { ValidateFunction } from "ajv";
import fs from "graceful-fs";
import DiskCache from "./disk_cache";
import * as H from "./helper";
import { Project } from "./project";
import {
  buildTargetMetaSchema,
  webinizerFieldMetaSchema,
  metaSchema,
} from "./schemas/metadata_schema";
import errorCode from "./error_code";

const log = H.getLogger("package_metadata");

// major difference with class ProjectCacheFile is that it doesn't have __type__
export default class PackageMeta extends DiskCache {
  private _proj: Project;
  constructor(proj: Project, filePath: string) {
    super(filePath);
    this._proj = proj;
  }

  get proj(): Project {
    return this._proj;
  }

  validateMetaSchema(metaData: H.Dict<unknown>) {
    const ajv = new Ajv();

    let validate: ValidateFunction<{ [x: string]: unknown }> | undefined = undefined;

    if (this.proj.config && fs.existsSync(this.proj.config.path) && this.proj.config.isLibrary) {
      // use schema defined for library
      validate = ajv
        .addSchema(Object.assign({}, buildTargetMetaSchema, { $ref: "#/definitions/library" }))
        .addSchema(Object.assign({}, webinizerFieldMetaSchema, { $ref: "#/definitions/library" }))
        .compile(metaSchema);
    } else {
      // use standard schema
      validate = ajv
        .addSchema(buildTargetMetaSchema)
        .addSchema(webinizerFieldMetaSchema)
        .compile(metaSchema);
    }

    const valid = validate(metaData);
    if (!valid) {
      log.info(
        `Errors happened in metadata validation for project ${this.proj.config.name}@${this.proj.config.version}:\n`,
        validate.errors
      );
      throw new H.WError(
        `Errors happened in metadata validation for project ${this.proj.config.name}@${
          this.proj.config.version
        }:\n${ajv.errorsText(validate.errors)}`,
        errorCode.WEBINIZER_META_SCHEMA_VALIDATION_FAILED
      );
    } else log.info("Metadata validation passed!");
  }

  async updateMetaAndConfig(metaData: H.Dict<unknown>) {
    const diffContent = H.getObjDifference(this.data, metaData);
    // update metadata
    this.clear();
    this.data = metaData;
    // update config based on metadata update
    await this.proj.config.convertFromRegMeta(diffContent);
  }

  backup() {
    if (fs.existsSync(this.path) && !fs.existsSync(`${this.path}.bak`)) {
      fs.copyFileSync(this.path, `${this.path}.bak`);
      // chmod for the temp file to be read-only
      fs.chmodSync(`${this.path}.bak`, 0o0400);
    }
  }

  restoreFromBackupFile() {
    if (fs.existsSync(`${this.path}.bak`)) {
      this.clear();
      this.data = JSON.parse(fs.readFileSync(`${this.path}.bak`, "utf8"));
      this.cleanBackupFile();
    }
  }

  cleanBackupFile() {
    fs.rmSync(`${this.path}.bak`, { force: true });
  }
}
