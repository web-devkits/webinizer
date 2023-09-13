/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

/**
 * Commonly shared functions, types etc.
 *
 * @module
 * @example
 * ```typescript
 * import * as H from "./helper";
 * const log = H.getLogger("test");
 * ```
 */
import { ChildProcess } from "child_process";

import glob from "glob";
import * as shell from "shelljs";
import * as _ from "lodash";
import fs from "graceful-fs";

import { format as _prettyFormat } from "pretty-format";

import logger from "./logger";
import errorCode from "./error_code";

export const prettyFormat = _prettyFormat;
// re-export logger functions as part of helper
export const getLogger = logger.get;
export const getGlobalLogWriter = logger.getGlobalLogWriter;
export const setDefaultLogLevel = logger.setDefaultLevel;
export const onlyLogCategories = logger.onlyAllowCategories;
export const forbidLogCategories = logger.forbidCategories;
export interface Dict<T> {
  [k: string]: T;
}

const _log = logger.get("helper");
export function assert(check: boolean, ...msgs: any[]) {
  if (!check) {
    _log.customOutput(4 /* fatal */, 2, ...msgs);
  }
}

export function messageBlock(title: string, msg: string, char = "-", width = 80): string {
  const titleBar = char.repeat(
    Math.max(0, Math.floor((width - title.length - 2) / 2 / char.length))
  );
  const bottomBar = char.repeat(Math.floor(width / char.length));

  return `\n${titleBar} ${title} ${titleBar}\n${msg}\n${bottomBar}`;
}

export class XError extends Error {
  type = "unknown";
  constructor(type: string, message: string) {
    super(message);
    this.type = type;
  }
}

// WebinizerError: errors with webinizer specific code
export class WError extends Error {
  constructor(message: string, code: errorCode) {
    super(message);
    this.name = code;
  }
}

/**
 * Serialize `Error`
 * @param err `Error` to be serialized
 * @returns Stringified Error with below struct
 * ```ts
 * {
 *   name: string; // webinizer error code or default name of `Error` class
 *   message: string; // error message
 * }
 * ```
 */
export function serializeError(err: Error): { name: string; message: string } {
  return { name: err.name, message: err.message };
}

/**
 * Normalize `Error` output
 * @param err `Error` to be normalized
 * @returns `error stack` or `error name: error message`
 */
export function normalizeErrorOutput(err: Error): string {
  return err.stack || `${err.name}: ${err.message}`;
}

/**
 * Check whether ctor (usually a class) implements T. Compiler throws error if not
 * @param ctor The class to check
 * @example
 * ```typescript
 * interface XConstructor {
 *   staticMethod(): number;
 * }
 * class BadX {
 *   staticMethod() { return "123"; }
 * }
 * // compiler ERROR: it fails to convert BadX to XConstructor
 * staticImplements<XConstructor>(BadX);
 * ```
 */
export function staticImplements<T>(ctor: T) {} //eslint-disable-line

export function isObjectEmpty(o: object): boolean {
  return Object.keys(o).length === 0;
}

export const voidFunc = () => {
  return;
};

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* eslint-disable  @typescript-eslint/no-explicit-any */
interface IDeferred<T> {
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
  promise: () => Promise<T>;
}

/**
 * Mimic jQuery defer or Angual $q.defer.
 *
 * @example
 * ```typescript
 * function numberPromise(): Promise<number> {
 *   const d = defer<number>();
 *   setTimeout(() => {
 *     d.resolve(100);
 *   }, 100);
 *   return d.promise();
 * }
 *
 * async function test() {
 *   console.log(await numberPromise());  // should print 5
 * }
 * ```
 * @returns A deferred object
 */
export function defer<T>(): IDeferred<T> {
  let res: (value: T | PromiseLike<T>) => void = voidFunc,
    rej: (reason?: any) => void = voidFunc;
  const promise = new Promise<T>((resolve, reject) => {
    res = resolve;
    rej = reject;
  });
  return {
    resolve: res,
    reject: rej,
    promise: () => promise,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface ICommandResult {
  code: number; // returned code
  output: string; // output in stdout
  error: string; // output in stderr
  all: string; // all output (stdout + stderr)
}
/**
 * A promise wrapper for async version of `shelljs.exec`. By default even if we captured all of the
 * outputs, they are shown in the console as well, unless `{ silent: true }` is set into options.
 * @param cmd Command to run.
 * @param options Same options as `child_process.exec()`, e.g., cwd, env, silent, timeout, etc.
 * @param onOut Callback function when there is any output in stdout.
 * @param onErr Callback function when there is any output in stderr.
 * @returns Promise resolved with {code, output, error, all}.
 */
export function runCommand(
  cmd: string,
  options = {},
  onOut?: (data: string) => void,
  onErr?: (data: string) => void
): Promise<ICommandResult> {
  return new Promise<ICommandResult>((resolve) => {
    const logWriter = getGlobalLogWriter();
    const outStrings: string[] = [];
    const errStrings: string[] = [];
    const allStrings: string[] = [];
    // force to be async so always returns a ChildProcess
    const p = shell.exec(
      cmd,
      Object.assign(Object.assign({}, options), { async: true })
    ) as ChildProcess;

    if (p.stdout) {
      p.stdout.on("data", (data: Buffer) => {
        const strData = data.toString(); // Buffer -> String
        outStrings.push(strData);
        allStrings.push(strData);
        if (logWriter) {
          logWriter.updateLog(strData);
        }
        if (onOut) {
          onOut(strData);
        }
      });
    }
    if (p.stderr) {
      p.stderr.on("data", (data: Buffer) => {
        const strData = data.toString();
        errStrings.push(strData);
        allStrings.push(strData);
        if (logWriter) {
          logWriter.updateLog(strData);
        }
        if (onErr) {
          onErr(strData);
        }
      });
    }

    p.on("close", (code: number) => {
      resolve({
        code: code,
        output: outStrings.join(""),
        error: errStrings.join(""),
        all: allStrings.join(""),
      });
    });
  });
}

////////////////////////////////////////////////////////////
// Common Interfaces Here
////////////////////////////////////////////////////////////
/**
 * Find files/dir matching a pattern in a directory
 * @param pattern The pattern to find, follows [`glob()`](@link https://www.npmjs.com/package/glob)
 * @param rootDir Find patterns in this directory
 * @param excludeDirs Array of directories to exclude from match
 * @param fileOnly Exclude directories or not
 * @param ignoreCase Case sensitive or not
 * @param sortMatches Sort the matches alphabetically or not
 */
export function matchFilePath(
  pattern: string,
  rootDir: string,
  excludeDirs: string[] = [],
  fileOnly = true,
  ignoreCase = false,
  sortMatches = false
): string[] {
  return glob.sync(pattern, {
    cwd: rootDir,
    ignore: excludeDirs.map((d) => `${d}/**`), // convert dir to ignore pattern
    nodir: fileOnly,
    nocase: ignoreCase,
    nosort: !sortMatches,
  });
}

export interface IPattern {
  pattern: string; // Pattern for search
  rootDir: string; // Find patterns in this directory
  file: string; // File path relative to baseDir
  line: number; // Line number with pattern match
  content: string; // Content for matched line
}

/**
 * Find specific petterns in files using `grep`
 * @param s Pattern for search
 * @param dir Base directory for search
 * @param excludeDirs Excluded directories for search
 * @returns Array of matched files
 */
export async function findPatternInFiles(
  s: string,
  dir: string,
  excludeDirs?: string[]
): Promise<IPattern[]> {
  const patterns: IPattern[] = [];
  const cmd =
    excludeDirs && excludeDirs.length
      ? `grep -rn ${excludeDirs.map((d) => `--exclude-dir=${d}`).join(" ")} "${s}"`
      : `grep -rn "${s}"`;
  const responses = await runCommand(cmd, { cwd: dir, silent: true });

  for (const res of responses.output.split("\n")) {
    if (res && !res.startsWith("Binary file")) {
      const resBody = res.split(":");
      patterns.push({
        pattern: s,
        rootDir: dir,
        file: resBody[0],
        line: Number(resBody[1]),
        content: resBody[2],
      });
    }
  }
  return patterns;
}

/**
 * Find differences from newObj to origObj
 * @param  origObj Original object
 * @param  newObj  New object with potential changes
 * @returns Differences from newObj to origObj，deleted entries are not shown
 */
export function getObjDifferenceInternal(
  origObj: Dict<unknown>,
  newObj: Dict<unknown>
): Dict<unknown> {
  function changes(newObj: Dict<unknown>, origObj: Dict<unknown>): Dict<unknown> {
    if (!_.isObject(origObj) || isObjectEmpty(origObj)) return _.cloneDeep(newObj);
    if (!_.isObject(newObj) || isObjectEmpty(newObj)) return {};
    let arrayIndexCounter = 0;
    return _.transform(newObj, (result: Dict<unknown>, value: unknown, key: string) => {
      if (!_.isEqual(value, origObj[key])) {
        const resultKey = Array.isArray(origObj) ? String(arrayIndexCounter++) : key;
        result[resultKey] =
          _.isObject(value) && _.isObject(origObj[key])
            ? changes(value as Dict<unknown>, origObj[key] as Dict<unknown>)
            : value;
      }
    });
  }
  return changes(newObj, origObj);
}

/**
 * Merge differences from bi-directional diffs
 * @param newToOld new to old diffs
 * @param oldToNew old to new diffs
 * @returns Merged diffs from newToOld and oldToNew, deleted entries will be set as `null`
 */
export function mergeDiffs(newToOld: Dict<unknown>, oldToNew: Dict<unknown>): Dict<unknown> {
  function changes(oldToNew: Dict<unknown>, newToOld: Dict<unknown>): Dict<unknown> {
    if (!_.isObject(oldToNew) || isObjectEmpty(oldToNew)) return _.cloneDeep(newToOld);
    let arrayIndexCounter = 0;
    return _.transform(
      oldToNew,
      (result: Dict<unknown>, value: unknown, key: string) => {
        // newToOld and oldToNew should not have equal key-value pair
        const resultKey = Array.isArray(newToOld) ? String(arrayIndexCounter++) : key;
        if (Object.keys(newToOld).includes(key)) {
          result[resultKey] =
            _.isObject(value) && _.isObject(newToOld[key])
              ? changes(value as Dict<unknown>, newToOld[key] as Dict<unknown>)
              : newToOld[key];
        } else {
          // set value to the resultKey as null as this is deleted in the newObj (not a key in newToOld)
          result[resultKey] = null;
        }
      },
      // set the initial value of accumulator as the same of newToOld
      _.cloneDeep(newToOld)
    );
  }
  return changes(oldToNew, newToOld);
}

/**
 * Find complete differences (add, update, delete) between two objects
 * @param  origObj Original object
 * @param  newObj  New object with potential changes
 * @returns Differences from newObj to origObj, deleted entries will be set as `null`
 */
export function getObjDifference(origObj: Dict<unknown>, newObj: Dict<unknown>): Dict<unknown> {
  const newToOld = getObjDifferenceInternal(origObj, newObj);
  const oldToNew = getObjDifferenceInternal(newObj, origObj);
  return mergeDiffs(newToOld, oldToNew);
}

/**
 * Table text align type
 */
type TableAlignStyle = "middle" | "left" | "right";

/**
 * Convert to a Markdown format table
 * @param header Array of header string (first row)
 * @param content  Array of each content row with order
 * @param style Array of the the text align style of each column, `middle` by default
 * @returns The table string in Markdown format
 */
export function constructMarkdownTable(
  header: string[],
  content: string[][],
  style?: TableAlignStyle[]
): string {
  const styleMap = {
    middle: `| :--------------: `,
    left: `| :-------------- `,
    right: `| --------------: `,
  } as { [k in TableAlignStyle]: string };
  const tableWidth = header.length;
  /* table border */
  let tableBorder = "";
  if (!style) {
    // if no style defined for each column, use `middle` as default
    tableBorder = styleMap["middle"].repeat(tableWidth) + "|";
  } else {
    if (style.length === tableWidth) {
      // apply each style to each column accordingly
      style.forEach((s) => {
        tableBorder += styleMap[s];
      });
      tableBorder += "|";
    } else {
      // use the last style for the rest columns
      style.forEach((s) => {
        tableBorder += styleMap[s];
      });
      tableBorder += styleMap[style[style.length - 1]].repeat(tableWidth - style.length) + "|";
    }
  }
  /* table header */
  let headerRow = "";
  header.forEach((h) => {
    headerRow += `| **${h}** `;
  });
  headerRow += "|";
  /* table content */
  let tableContent = "";
  content.forEach((line) => {
    if (line.length === tableWidth) {
      tableContent +=
        line
          .map((words) => {
            return `| ${words} `;
          })
          .join("") + "|\n";
    }
  });
  return `${headerRow}\n${tableBorder}\n${tableContent}\n`;
}

/**
 * Backup a folder
 * @param srcDir The folder directory to be backuped
 * @param destDir The destination directory
 */
export function backupFolderSync(srcDir: string, destDir: string) {
  try {
    fs.cpSync(srcDir, destDir, { recursive: true });
    _log.info(`Copy folder from ${srcDir} to ${destDir} successfully.`);
  } catch (error) {
    _log.error(`An error occurred while copying folder '${srcDir}':`, error);
    throw new WError(
      `An error occurred while copying folder '${srcDir}':\n${error}`,
      errorCode.WEBINIZER_DIR_COPY_FAIL
    );
  }
}

/**
 * Delete a folder
 * @param dir The folder directory to be deleted
 */
export function deleteFolder(dir: string) {
  try {
    fs.rmSync(dir, { recursive: true });
    _log.info(`Delete folder '${dir}' successfully.`);
  } catch (error) {
    _log.error(`An error occurred while deleting folder '${dir}':`, error);
    throw new WError(
      `An error occurred while deleting folder '${dir}:\n${error}'`,
      errorCode.WEBINIZER_DIR_DEL_FAIL
    );
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
    _log.info(`Folder '${oldPath}' is renamed as '${newPath}' successfully.`);
  } catch (error) {
    _log.error(`An error occurred while renaming folder '${oldPath}':`, error);
    throw new WError(
      `An error occurred while moving folder '${oldPath}':\n${error}`,
      errorCode.WEBINIZER_DIR_MV_FAIL
    );
  }
}
