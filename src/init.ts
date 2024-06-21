/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import path from "path";
import fs from "graceful-fs";
import * as H from "./helper";
import { loadAllExtensions } from "./extension";
import errorCode from "./error_code";
import { moduleDirectories } from "./constants";

const log = H.getLogger("initialization");

async function loadAndExecuteModule(p: string) {
  const m = await import(p);
  if (m && "default" in m) {
    await m.default();
  }
}

async function checkToolchainReadiness() {
  // check whether emscripten is configured in path or not
  const emccVer = await H.runCommand("emcc --version", { silent: true });
  if (emccVer.code !== 0) {
    log.error(
      "Emscripten is not configured in PATH. Please run the 'source ./emsdk_env.sh' command from the emsdk folder before initializing Webinizer."
    );
    throw new H.WError(
      "Emscripten is not configured in PATH.",
      errorCode.WEBINIZER_INIT_TOOLCHAIN_CHECK_FAIL
    );
  }
}

export async function loadAllModulesInDirectory(dir: string) {
  try {
    const modules = fs.readdirSync(dir);

    for (const m of modules) {
      if (m.endsWith(".js") || m.endsWith(".ts")) {
        const modulePath = path.join(dir, m);
        try {
          if (fs.statSync(modulePath).isFile()) {
            await loadAndExecuteModule(modulePath);
          }
          //eslint-disable-next-line
        } catch (error: any) {
          const errorMsg =
            `Failed to load module from path ${modulePath} due to error:\n` +
            H.normalizeErrorOutput(error as Error);
          log.error(errorMsg);
          throw new H.WError(errorMsg, errorCode.WEBINIZER_INIT_MODULE_LOAD_FAIL);
        }
      }
    }
    //eslint-disable-next-line
  } catch (err: any) {
    let errMsg;
    if (err.code === "ENOENT") {
      errMsg = `Module Directory "${dir}" does not exist.`;
      log.error(errMsg);
      throw new H.WError(errMsg, errorCode.WEBINIZER_INIT_MODULE_DIR_NOEXT);
    } else {
      if (err.code === errorCode.WEBINIZER_INIT_MODULE_LOAD_FAIL) {
        throw err as H.WError;
      } else {
        errMsg =
          `Failed to load modules from directory ${dir} due to error:\n` +
          H.normalizeErrorOutput(err as Error);
        log.error(errMsg);
        throw new H.WError(errMsg, errorCode.WEBINIZER_INIT_MODULE_DIR_LOAD_FAIL);
      }
    }
  }

  return;
}

export async function init() {
  await checkToolchainReadiness();
  for (const md of moduleDirectories) {
    await loadAllModulesInDirectory(md);
  }

  await loadAllExtensions();
}
