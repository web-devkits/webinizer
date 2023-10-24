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

class ExportedRuntimeMethodsConfig extends BaseBuildConfig {
  static __type__: BuildConfigType = "exportedRuntimeMethods";
  constructor(name: BuildConfigType, data: H.Dict<unknown>) {
    if (name === ExportedRuntimeMethodsConfig.__type__) super(name, data);
  }

  updateFromEnvs(currentEnv: EnvType, envFlags: string): string {
    // impact from ldflags only
    if (currentEnv !== "ldflags") {
      throw new H.WError(
        `Wrong environment vairable flags ${currentEnv} to update ${this.name} from.`,
        errorCode.WEBINIZER_BUILD_CONFIG_GENERAL
      );
    }

    let setExportedRuntimeMethods = false;
    const args = shlex.split(envFlags);
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a.includes("-sEXPORTED_RUNTIME_METHODS") && !setExportedRuntimeMethods) {
        const f = a.split("=").pop()?.trim();
        if (f) {
          const fns = [
            ...new Set(
              f
                .split(",")
                .map((fn) => fn.trim())
                .filter((fn) => fn)
            ),
          ];
          args[i] = `-sEXPORTED_RUNTIME_METHODS=${fns.join(",")}`;
          this.value = fns.join(",");
          setExportedRuntimeMethods = true;
        }
      }
    }
    if (!setExportedRuntimeMethods) this.value = "";
    // return the (updated) envFlags to update envs field
    return shlex.join(args);
  }
  updateToEnvs(): EnvUpdateSet {
    const ldflagsToUpdate: IArg[] = [];
    const val = this.value as string;
    if (val && val.trim()) {
      const uniqFns = [
        ...new Set(
          val
            .split(",")
            .map((f) => f.trim())
            .filter((f) => f)
        ),
      ];
      this.value = uniqFns.join(",");
      ldflagsToUpdate.push({
        option: "-sEXPORTED_RUNTIME_METHODS",
        value: `${uniqFns.join(",")}`,
        type: "replace",
      });
    } else {
      // if exportedRuntimeMethods is "", remove -sEXPORTED_RUNTIME_METHODS arg
      ldflagsToUpdate.push({
        option: "-sEXPORTED_RUNTIME_METHODS",
        value: null,
        type: "deleteAll",
      });
    }

    return { ldflags: ldflagsToUpdate } as EnvUpdateSet;
  }
}

// loading
export default function onload() {
  registerConfig(ExportedRuntimeMethodsConfig.__type__, ExportedRuntimeMethodsConfig);
}
