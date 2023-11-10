/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import Path from "path";
import errorCode from "./error_code";
import fs from "graceful-fs";
import * as C from "./constants";
import * as H from "./helper";

/**
 *  Delete projects softly, which means the projects will not be
 *  removed from disk, set the `project.config.deleted` flag as true
 *  instead
 *  if users upload or clone the project which has the same name
 *  again, will rename new project folder with {project__1 | 2 ...}
 *  to avoid multiple folders with the same name
 */

/**
 * This function is to resolve unexpected action like users
 * input the system file path
 *
 * @param projectPath: the path of the project, generally start with
 *                     "/native_projects/"
 * @returns true if the project path is valid
 */
function checkIfProjectPathValid(projectPath: string) {
  const projParsedPath = Path.parse(Path.normalize(projectPath)).dir;
  if (projParsedPath !== C.projectPool) {
    throw new H.WError(`Project path is invalid.`, errorCode.WEBINIZER_PROJ_PATH_INVALID);
  }
}

export function deleteProjectFromDisk(projectPath: string) {
  // the hard delete action is only allowed under the projects pool
  // directory.
  checkIfProjectPathValid(projectPath);

  if (!fs.existsSync(projectPath)) {
    throw new H.WError(`The directory doesn't exist.`, errorCode.WEBINIZER_DIR_NOEXT);
  }

  fs.rmSync(projectPath, { recursive: true });
}
