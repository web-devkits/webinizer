/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import fs from "graceful-fs";
import * as H from "./helper";
import path from "path";
import writeFileAtomic from "write-file-atomic";
import { EXTENSION_SRC_HOME } from "./constants";
import errorCode from "./error_code";
import { Settings } from "./settings";
import * as prettier from "prettier";

export interface IExtensionAction {
  __type__: string;
  desc: string;
}

export interface IExtensionAdvisor {
  __type__: string;
  desc: string;
  tags: string[];
}

export interface IExtensionAnalyzer {
  __type__: string;
  desc: string;
}

export interface IExtensionBuilder {
  __type__: string;
  desc: string;
}
export interface IExtMetaInPkgJson {
  status: "enable" | "disable";
  actions?: IExtensionAction[];
  advisors?: IExtensionAdvisor[];
  analyzers?: IExtensionAnalyzer[];
  builders?: IExtensionBuilder[];
}
export interface IExtensionMeta {
  name: string;
  version: string;
  description: string;
  webinizerExtMeta: IExtMetaInPkgJson;
}

export interface IExtensionSettingsJson {
  desc: string;
  status: "enable" | "disable";
}

export interface IExtensionSettings extends IExtensionSettingsJson {
  updateStatus(status: "enable" | "disable"): void;
}

const log = H.getLogger("extension");

function loadExtMeta(name: string): IExtensionMeta | null {
  const extPath = path.join(EXTENSION_SRC_HOME, name, "package.json");
  try {
    const pkgJson = JSON.parse(fs.readFileSync(extPath, "utf8"));
    return pkgJson as IExtensionMeta;
    //eslint-disable-next-line
  } catch (err: any) {
    let errMsg;
    if (err.code === "ENOENT") {
      errMsg = `Extension metadata file ${extPath} does not exist.`;
      log.error(errMsg);
      throw new H.WError(errMsg, errorCode.WEBINIZER_EXT_META_NOEXT);
    }
    errMsg =
      `Failed to load extension metadata from file ${extPath} due to error:\n` +
      H.normalizeErrorOutput(err as Error);
    log.error(errMsg);
    throw new H.WError(errMsg, errorCode.WEBINIZER_EXT_META_LOAD_FAIL);
  }
}

async function loadExtensionByName(name: string) {
  /**
   * Skip the load for node_modules folder. This is a workaround for exntensions to load
   * the webinizer module from a global import.
   */
  if (name === "node_modules") return;

  const extMeta = loadExtMeta(name);
  if (extMeta !== null && extMeta.webinizerExtMeta !== null) {
    if (extMeta.webinizerExtMeta.status === "enable") {
      let extension;
      const extIndexPath =
        process.env.npm_lifecycle_event === "test"
          ? path.join(EXTENSION_SRC_HOME, name, "src", "index.ts")
          : path.join(EXTENSION_SRC_HOME, name, "dist", "index.js");
      if (fs.existsSync(extIndexPath)) {
        extension = await import(extIndexPath);
      }
      if (extension && "default" in extension) {
        await extension.default();
      }
    }
    Settings.registerFromExtensions(extMeta.name, {
      desc: extMeta.description,
      status: extMeta.webinizerExtMeta.status,
      updateStatus: (status: "enable" | "disable") => {
        log.info(`... update status for extension ${extMeta.name} as ${status}`);
        const updatedExtMeta = Object.assign({}, extMeta.webinizerExtMeta, { status });
        const updatedPkgJson = Object.assign({}, extMeta, { webinizerExtMeta: updatedExtMeta });
        const formatted = prettier.format(JSON.stringify(updatedPkgJson), {
          parser: "json",
        });
        writeFileAtomic.sync(path.join(EXTENSION_SRC_HOME, name, "package.json"), formatted, {
          mode: 0o0600,
        });
      },
    });
  }
}

export async function loadAllExtensions() {
  try {
    const extensions = fs.readdirSync(EXTENSION_SRC_HOME);
    for (const ext of extensions) {
      const extPath = path.join(EXTENSION_SRC_HOME, ext);
      try {
        if (fs.statSync(extPath).isDirectory()) {
          await loadExtensionByName(ext);
        }
        //eslint-disable-next-line
      } catch (error: any) {
        if (
          error.code === errorCode.WEBINIZER_EXT_META_NOEXT ||
          error.code === errorCode.WEBINIZER_EXT_META_LOAD_FAIL
        ) {
          throw error as H.WError;
        } else {
          const errorMsg =
            `Failed to load extension from directory ${extPath} due to error:\n` +
            H.normalizeErrorOutput(error as Error);
          log.error(errorMsg);
          throw new H.WError(errorMsg, errorCode.WEBINIZER_EXT_DIR_LOAD_FAIL);
        }
      }
    }
    //eslint-disable-next-line
  } catch (err: any) {
    if (
      err.code === errorCode.WEBINIZER_EXT_META_NOEXT ||
      err.code === errorCode.WEBINIZER_EXT_META_LOAD_FAIL ||
      err.code === errorCode.WEBINIZER_EXT_DIR_LOAD_FAIL
    ) {
      throw err as H.WError;
    } else {
      let errMsg;
      if (err.code === "ENOENT") {
        errMsg = `Extension Home Directory "${EXTENSION_SRC_HOME}" does not exist.`;
        log.error(errMsg);
        throw new H.WError(errMsg, errorCode.WEBINIZER_EXT_HOME_DIR_NOEXT);
      } else {
        errMsg =
          `Failed to read extension home directory ${EXTENSION_SRC_HOME} due to error:\n` +
          H.normalizeErrorOutput(err as Error);
        log.error(errMsg);
        throw new H.WError(errMsg, errorCode.WEBINIZER_EXT_HOME_DIR_LOAD_FAIL);
      }
    }
  }
}
