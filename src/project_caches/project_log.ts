/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import ProjectCacheFile from "./project_cache_file";
import { Project } from "../project";
import { IProjectLog } from "webinizer";

export default class ProjectLog extends ProjectCacheFile implements IProjectLog {
  static __type__ = "ProjectLog";
  private _content = ""; // log content

  constructor(proj: Project, filePath: string) {
    super(proj, filePath, ProjectLog.__type__);
  }

  getContent(): string {
    return this.data.content as string;
  }

  update(content: string) {
    this._content += content;
    this.data = { content: this._content };
  }

  clear() {
    this._content = "";
    this.data = { content: "" };
  }
}
