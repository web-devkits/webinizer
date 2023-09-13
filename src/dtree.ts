/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

/**
 * Directory Tree Utility
 *
 * @module
 */

import directoryTree from "directory-tree";
import path from "path";
import fs from "graceful-fs";
import { WError } from "./helper";
import errorCode from "./error_code";

export interface IDtreeNode {
  path: string;
  name: string;
  type: string;
  children?: IDtreeNode[];
}
export interface IDtreeOptions {
  exclude?: RegExp | RegExp[];
  depth?: number;
  attributes?: (keyof fs.Stats | "type" | "extension")[];
}
export interface IDtreeJson {
  tree: IDtreeNode;
}

const defaultOptions = {
  exclude: [/\/\.webinizer/, /\.webinizer_.*\.(json|log)$/, /\/\.vscode/, /\/\.git/],
  depth: 1,
  attributes: ["type"] /* show entry type */,
} as IDtreeOptions;

export function updateDirTree(dirPath: string, dirTree: IDtreeNode, total: IDtreeNode) {
  if (
    !total.path ||
    (total.path === dirPath && total.type === "directory" && total.type === dirTree.type)
  ) {
    Object.assign(total, dirTree);
    return;
  }
  if (total.children) {
    const children = total.children;
    for (let i = 0; i < children.length; i++) {
      // eslint-disable-next-line
      updateDirTree(dirPath, dirTree, children[i]);
    }
  }
}

export function hasPath(dirPath: string, total: IDtreeNode): boolean {
  if (total.path === dirPath && total.type === "directory" && total.children) return true;
  if (total.children) {
    const children = total.children;
    for (const c of children) {
      // eslint-disable-next-line
      if (hasPath(dirPath, c)) return true;
    }
  }
  return false;
}

export function normalizePath(dirPath: string): string {
  const dir = path.normalize(dirPath.trim());
  if (dir.endsWith("/")) {
    return dir.slice(0, -1);
  }
  return dir;
}

export function buildDirTree(dirPath: string, options = defaultOptions): IDtreeNode {
  if (fs.existsSync(dirPath)) {
    const dir = normalizePath(fs.statSync(dirPath).isFile() ? path.dirname(dirPath) : dirPath);
    // we generate it once per level instead of recursively
    const tree = directoryTree(dir, options);
    return {
      path: tree.path,
      name: tree.name,
      type: tree.type as string,
      children: tree.children as IDtreeNode[],
    };
  } else {
    throw new WError(`Directory ${dirPath} doesn't exist.`, errorCode.WEBINIZER_DIR_NOEXT);
  }
}
