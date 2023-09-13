/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import path from "path";
import fs from "graceful-fs";
import writeFileAtomic from "write-file-atomic";
import dotProp from "dot-prop";
import * as H from "./helper";

const log = H.getLogger("disk-cache");

export default class DiskCache {
  private _path: string;
  private _data: H.Dict<unknown> = {};
  constructor(filePath: string) {
    this._path = filePath;
    this._load();
  }

  private _load() {
    try {
      this._data = JSON.parse(fs.readFileSync(this._path, "utf8"));
      //eslint-disable-next-line
    } catch (err: any) {
      if (err.code === "ENOENT") {
        this._data = {};
        return;
      }
      log.error(
        "Failed to load cache from file",
        this._path,
        "with error:\n",
        H.normalizeErrorOutput(err as Error)
      );
      throw err;
    }
  }

  private _save() {
    try {
      // this doesn't report error if already exists because recursive is set to true
      fs.mkdirSync(path.dirname(this._path), { mode: 0o0700, recursive: true });
      writeFileAtomic.sync(this._path, JSON.stringify(this._data, undefined, 2) + "\n", {
        mode: 0o0600,
      });
      //eslint-disable-next-line
    } catch (err: any) {
      log.error(
        "Failed to save cache to file",
        this._path,
        "with error:\n",
        H.normalizeErrorOutput(err as Error)
      );
      throw err;
    }
  }

  get path(): string {
    return this._path;
  }

  get data(): H.Dict<unknown> {
    return this._data;
  }

  set data(v: H.Dict<unknown>) {
    Object.assign(this._data, v);
    this._save();
  }

  get(k: string, defaultValue?: unknown): unknown {
    return dotProp.get(this._data, k, defaultValue);
  }

  set(k: string, v: unknown) {
    dotProp.set(this._data, k, v);
    this._save();
  }

  has(k: string): boolean {
    return dotProp.has(this._data, k);
  }

  delete(k: string): boolean {
    const r = dotProp.delete(this._data, k);
    this._save();
    return r;
  }

  clear() {
    this._data = {};
    this._save();
  }
}
