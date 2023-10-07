/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

/**
 * Log utility
 *
 * @module
 *
 * @example
 * ```typescript
 * import logger from "./logger";
 * log = logger.get("mycategory");
 * log.debug("debug message", x);
 * log.info("default", x);
 * log.warn("warn", x, y, z);
 * log.error("error", x, y);
 * log.fatal("fatal", x, y);
 * ```
 */

import chalk from "chalk";
import Moment from "moment";
import process from "process";
import fs from "graceful-fs";
import path from "path";
import writeFileAtomic from "write-file-atomic";
import { homedir } from "os";

// Dict<T> and isObjectEmpty(...) are also defined and exported in helper.ts
// However, helper.ts will import logger.ts so we copied them here.
interface Dict<T> {
  [k: string]: T;
}
function isObjectEmpty(o: object): boolean {
  return Object.keys(o).length === 0;
}

// levels
const levelNames = ["debug", "info", "warn", "error", "fatal"] as const;
type logLevelType = (typeof levelNames)[number];

// The default level which controls the output. Each Logger could specify its own to replace this
// default is "info"
let defaultLevelValue = 1;
// Globally we could config the categories to show. It's the allowed categories subtract all
// categories forbidden. Note empty categoriesAllowed below actually means all are allowed

let categoriesAllowed: Dict<boolean> = {}; // empty actually means all are allowed
let categoriesForbidden: Dict<boolean> = {}; // empty means none is forbidden

const formatters = {
  debug: {
    time: chalk.gray,
    level: (x: string) => chalk.bgGray(chalk.white(x)),
    category: chalk.greenBright,
  },
  info: {
    time: chalk.gray,
    level: (x: string) => chalk.bgBlue(chalk.white(x)),
    category: chalk.greenBright,
  },
  warn: {
    time: chalk.gray,
    level: (x: string) => chalk.bgMagenta(chalk.white(x)),
    category: chalk.greenBright,
  },
  error: {
    time: chalk.gray,
    level: (x: string) => chalk.bgRed(chalk.white(x)),
    category: chalk.greenBright,
  },
  fatal: {
    time: chalk.gray,
    level: (x: string) => chalk.bgRedBright(chalk.whiteBright(x)),
    category: chalk.greenBright,
  },
};

/**
 * Log Writer
 */
class GlobalLogWriter {
  private _file: string;
  private _content: string;
  private static _instance: GlobalLogWriter;

  private constructor() {
    const date = Moment().format();
    this._file = path.join(homedir(), ".webinizer", "logs", `webinizer-debug-log-${date}.log`);
    this._content = `Webinizer debug log at ${date}\n`;
    this.save();
  }

  static getInstance(): GlobalLogWriter {
    if (!GlobalLogWriter._instance) {
      GlobalLogWriter._instance = new GlobalLogWriter();
    }
    return GlobalLogWriter._instance;
  }

  updateLog(data: string) {
    this._content += data;
    this.save();
  }

  save() {
    try {
      // this doesn't report error if already exists because recursive is set to true
      fs.mkdirSync(path.dirname(this._file), { mode: 0o0700, recursive: true });
      writeFileAtomic.sync(this._file, this._content, {
        mode: 0o0600,
      });
      // eslint-disable-next-line
    } catch (err: any) {
      // webinizer logger is not initialized yet, using console instead.
      console.log(
        `Failed to save ${this._content} to file`,
        this._file,
        "due to error:",
        err.message
      );
      throw err;
    }
  }
}

// the unique global log writer instance
const logWriter = GlobalLogWriter.getInstance();

/**
 * Logger
 */
class Logger {
  private _category: string;
  private _enabled: boolean;

  /** If this is -1, it uses defaultLevelValue, otherwise use this one to control output or not */
  private _levelValue = -1;

  /**
   * Actual class for outputting logs.
   * @param category Category name
   * @param enabled false to turn it off
   */
  constructor(category: string, enabled: boolean) {
    this._category = category;
    this._enabled = enabled;
  }

  private _willOutput(levelValue: number): boolean {
    // always show >= error
    if (levelValue >= 3) {
      return true;
    }
    const level = this._levelValue < 0 ? defaultLevelValue : this._levelValue;
    if (!this._enabled || levelValue < level || this._category in categoriesForbidden) {
      return false;
    }
    return isObjectEmpty(categoriesAllowed) || this._category in categoriesAllowed;
  }

  // if nSliceStack >= 0, print the stack as well - but slice the first nSliceStack lines
  customOutput(levelValue: number, nSliceStack: number, ...args: any[]): void {
    if (!this._willOutput(levelValue)) {
      return;
    }
    const level = levelNames[levelValue];
    const formatter = formatters[level];

    let customLogger = console.log;
    // check if global log writer is defined
    if (logWriter) {
      customLogger = function (...d) {
        const output =
          d
            .map((o) => {
              return typeof o === "object" ? JSON.stringify(o, null, 1) : o;
            })
            .join(" ") + "\n";
        process.stdout.write(output);
        logWriter.updateLog(output);
      };
    }
    // check if callback function is appended in the last
    if (args.length && typeof args[args.length - 1] === "function") {
      type cb = (data: string) => void;
      const dumpOutput = args.pop() as cb;
      customLogger = function (...d) {
        const output =
          d
            .map((o) => {
              return typeof o === "object" ? JSON.stringify(o, null, 1) : o;
            })
            .join(" ") + "\n";
        process.stdout.write(output);
        dumpOutput(output);
        if (logWriter) {
          logWriter.updateLog(output);
        }
      };
    }
    customLogger(
      formatter.time(Moment().format("hh:mm:ss")),
      formatter.level(level.padEnd(5)),
      formatter.category(this._category),
      ...args
    );
    if (nSliceStack >= 0) {
      const stacks = (new Error().stack || "")
        .split("\n")
        .slice(nSliceStack)
        .map((x: string) => {
          return "      " + x.trim();
        });
      if (stacks) {
        stacks[0] = stacks[0].trim();
      }
      customLogger(formatter.level("  >>>"), stacks.join("\n"));
    }
  }

  debug(...args: any[]): void {
    this.customOutput(0, -1, ...args);
  }

  info(...args: any[]): void {
    this.customOutput(1, -1, ...args);
  }

  warn(...args: any[]): void {
    this.customOutput(2, -1, ...args);
  }

  error(...args: any[]): void {
    this.customOutput(3, 2, ...args);
  }

  fatal(...args: any[]): void {
    this.customOutput(4, 2, ...args);
    process.exit(1);
  }

  /**
   * Set the level to control the output. For example, if it is set to "info", then debug(...) will
   * not output anything.
   *
   * If we invoked setLevel() without any value, it will reset the level of this specific logger,
   * and will use the one at system level, which is controlled by `setDefaultLevel()` of
   * {@link logger} to decide whether to output or not.
   *
   * @param level The new level. If it is omitted, this Logger will use system level control.
   * @returns The old level
   */
  setLevel(level?: logLevelType): logLevelType {
    const oldLevel = levelNames[this._levelValue];
    if (level === undefined) {
      this._levelValue = -1;
    } else {
      this._levelValue = levelNames.indexOf(level);
    }
    return oldLevel;
  }
}

/**
 * logger interface
 */
const logger = {
  /**
   * Default level to control output a log or not. Each Logger could use setLevel() to specifically
   * control the level by itself.
   * @param level New default level
   * @returns Old default level
   */
  setDefaultLevel(level: logLevelType): logLevelType {
    const oldLevel = levelNames[defaultLevelValue];
    defaultLevelValue = levelNames.indexOf(level);
    return oldLevel;
  },

  /**
   * Get the global log writer
   * @returns The global log writer
   */
  getGlobalLogWriter(): GlobalLogWriter {
    return logWriter;
  },

  /**
   * Create a Logger. It's called get() for convention, but it's actually mean create(). That means,
   * if you call it with the same category twice, it create two separated Logger for you, instead of
   * a shared one.
   * @param category this classifies the log and itself will show and highlight in console
   * @param enabled set it false will disable it at all
   * @returns A Logger that you could info(), ...
   */
  get(category: string, enabled = true): Logger {
    return new Logger(category, enabled);
  },

  /**
   * Only allow some categories to show. Set it to [] means to clear this, i.e. allowing all to show
   * @param cats Categories allowed to show, like a filter. [] means allowing all.
   * @returns Old categories
   */
  onlyAllowCategories(cats: string[]): string[] {
    const old = Array.from(Object.keys(categoriesAllowed));
    categoriesAllowed = cats.reduce((acc, v) => {
      return { ...acc, [v]: true };
    }, {});
    return old;
  },

  /**
   * Categories in this list aren't allowed to show
   * @param cats Categories not allowed to show
   * @returns Old categories
   */
  forbidCategories(cats: string[]): string[] {
    const old = Array.from(Object.keys(categoriesForbidden));
    categoriesForbidden = cats.reduce((acc, v) => {
      return { ...acc, [v]: true };
    }, {});
    return old;
  },
};

export default logger;
