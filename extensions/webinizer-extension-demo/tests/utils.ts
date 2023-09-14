/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import fs from "graceful-fs";

/**
 * Backup a folder
 * @param srcDir The folder directory to be backuped
 * @param destDir The destination directory
 */
export function backupFolderSync(srcDir: string, destDir: string) {
  try {
    fs.cpSync(srcDir, destDir, { recursive: true });
  } catch (error) {
    throw new Error(`An error occurred while copying folder '${srcDir}':\n${error}`);
  }
}

/**
 * Delete a folder
 * @param dir The folder directory to be deleted
 */
export function deleteFolder(dir: string) {
  try {
    fs.rmSync(dir, { recursive: true });
  } catch (error) {
    throw new Error(`An error occurred while deleting folder '${dir}':\n${error}`);
  }
}

/**
 * Rename a folder
 * @param oldPath The old path of the folder
 * @param newPath The new path of the folder
 */
export function renameFolder(oldPath: string, newPath: string) {
  try {
    fs.renameSync(oldPath, newPath);
  } catch (error) {
    throw new Error(`An error occurred while moving folder '${oldPath}':\n${error}`);
  }
}
