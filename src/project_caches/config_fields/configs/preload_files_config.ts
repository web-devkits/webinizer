/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import * as H from "../../../helper";
import errorCode from "../../../error_code";
import { EnvUpdateSet, BuildConfigType } from "..";
import { BaseBuildConfig, registerConfig } from "../config";
import { EnvType, IArg } from "webinizer";
import shlex from "shlex";
import * as _ from "lodash";

class PreloadFilesConfig extends BaseBuildConfig {
  static __type__: BuildConfigType = "preloadFiles";
  constructor(name: BuildConfigType, data: H.Dict<unknown>) {
    if (name === PreloadFilesConfig.__type__) super(name, data);
  }

  updateFromEnvs(currentEnv: EnvType, envFlags: string): string {
    // impact from ldflags only
    if (currentEnv !== "ldflags") {
      throw new H.WError(
        `Wrong environment vairable flags ${currentEnv} to update ${this.name} from.`,
        errorCode.WEBINIZER_BUILD_CONFIG_GENERAL
      );
    }

    const localFiles: string[] = [];
    const args = shlex.split(envFlags);
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a.includes("--preload-file")) {
        // store local file path and mapped path in virtual FS together
        const rawFile = a.split("--preload-file").pop()?.trim();
        const filePath = _.trim(rawFile, '"');
        if (filePath && !localFiles.includes(filePath)) {
          localFiles.push(filePath);
          if (rawFile && (!rawFile.startsWith('"') || !rawFile.endsWith('"'))) {
            // add " " to wrap the filePath to escape possible spaces. These " will be
            // replaced with ' at build time.
            args[i] = `--preload-file "${filePath}"`;
          }
        } else {
          args[i] = "";
        }
      }
    }
    this.value = localFiles;
    // return the (updated and filtered) envFlags to update envs field
    return shlex.join(args.filter((o) => o));
  }

  updateToEnvs(): EnvUpdateSet {
    const ldflagsToUpdate: IArg[] = [];
    const val = _.cloneDeep(this.value) as string[];

    if (val && val.length) {
      // check for possible duplicates
      const dedupeVal = [...new Set(val)];
      // remove all previous preload files ("deleteAll") and then add the new ones
      ldflagsToUpdate.push(
        ...([
          { option: "--preload-file", value: null, type: "deleteAll" },
          ...dedupeVal.map((f) => {
            // preload file is mapped to root of virtual FS (@/) if mapping directory is not defined
            const opt = f.includes("@/") ? `--preload-file "${f}"` : `--preload-file "${f}@/"`;
            return { option: opt, value: null, type: "replace" };
          }),
        ] as IArg[])
      );
      this.value = dedupeVal;
    } else {
      // if preloadFiles is [], remove all --preload-file args
      ldflagsToUpdate.push({
        option: "--preload-file",
        value: null,
        type: "deleteAll",
      });
    }

    return { ldflags: ldflagsToUpdate } as EnvUpdateSet;
  }
}

// loading
export default function onload() {
  registerConfig(PreloadFilesConfig.__type__, PreloadFilesConfig);
}
