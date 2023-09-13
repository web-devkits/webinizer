/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import ProjectCacheFile from "./project_cache_file";
import { Project } from "../project";
import { Recipe } from "../recipe";

export default class ProjectRecipe extends ProjectCacheFile {
  static __type__ = "ProjectRecipe";

  constructor(proj: Project, filePath: string) {
    super(proj, filePath, ProjectRecipe.__type__);
  }

  saveRecipes(res: Recipe[]) {
    this.data = { recipes: res.map((r) => r.toJson()) };
  }

  clear() {
    this.data = { recipes: [] };
  }
}
