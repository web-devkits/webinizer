/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import path from "path";
import fs from "graceful-fs";
import writeFileAtomic from "write-file-atomic";
import * as H from "../helper";
import { Project } from "../project";
import { IJsonObject, IToJson } from "webinizer";

const log = H.getLogger("project_cache_file");

export default abstract class ProjectCacheFile implements IToJson {
  private _proj: Project;
  private _path: string;
  private _data: IJsonObject;
  private _type: string;

  constructor(proj: Project, filePath: string, type: string) {
    this._proj = proj;
    this._path = filePath;
    this._type = type;
    this._data = { __type__: type };
    if (fs.existsSync(this._path)) {
      this.load();
    }
  }

  get proj(): Project {
    return this._proj;
  }

  get path(): string {
    return this._path;
  }

  get data(): IJsonObject {
    return this._data;
  }

  set data(v: H.Dict<unknown>) {
    Object.assign(this._data, v);
    this.save();
  }

  reset() {
    this._data = { __type__: this._type };
    this.save();
  }

  toJson(): IJsonObject {
    return this._data;
  }

  load() {
    try {
      const data = JSON.parse(fs.readFileSync(this._path, "utf8")) as IJsonObject;
      H.assert(data.__type__ === this.data.__type__);
      this._data = data;
      //eslint-disable-next-line
    } catch (err: any) {
      if (err.code === "ENOENT") {
        log.error(`Tried to load ${this.data.__type__} from an nonexist file:`, this._path);
        return;
      }
      log.error(
        `Failed to load ${this.data.__type__} from file`,
        this._path,
        "due to error:\n",
        H.normalizeErrorOutput(err as Error)
      );
      throw err;
    }
  }

  save() {
    try {
      // this doesn't report error if already exists because recursive is set to true
      fs.mkdirSync(path.dirname(this._path), { mode: 0o0700, recursive: true });
      writeFileAtomic.sync(this._path, JSON.stringify(this._data, undefined, 2) + "\n", {
        mode: 0o0600,
      });
      //eslint-disable-next-line
    } catch (err: any) {
      log.error(
        `Failed to save ${this.data.__type__} to file`,
        this._path,
        "due to error:\n",
        H.normalizeErrorOutput(err as Error)
      );
      throw err;
    }
  }
}
