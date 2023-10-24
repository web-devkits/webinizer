/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import { BaseBuildOption, registerOption } from "../option";
import { EnvUpdateSet } from "..";
import { IArg, BuildOptionType, IProjectBuildOptions, EnvType } from "webinizer";

class PThreadOption extends BaseBuildOption {
  static __type__: BuildOptionType = "needPthread";

  constructor(name: BuildOptionType, data: IProjectBuildOptions) {
    if (name === PThreadOption.__type__) super(name, data);
  }

  updateFromEnvs(currentEnv: EnvType, envFlags: string): EnvUpdateSet {
    const otherEnv: EnvType = currentEnv === "cflags" ? "ldflags" : "cflags";
    const currentEnvFlagsToUpdate: IArg[] = [];
    const otherEnvFlagsToUpdate: IArg[] = [];
    if (currentEnv === "cflags") {
      // pthread option related update
      if (envFlags.includes("-sUSE_PTHREADS=1") && !this.value) {
        this.value = true;
        otherEnvFlagsToUpdate.push(
          ...([
            {
              option: "-sUSE_PTHREADS",
              value: "1",
              type: "replace",
            },
            {
              option: "-sPROXY_TO_PTHREAD",
              value: "1",
              type: "replace",
            },
          ] as IArg[])
        );
      } else if (
        (!envFlags.includes("-sUSE_PTHREADS=1") || envFlags.includes("-sUSE_PTHREADS=0")) &&
        this.value
      ) {
        this.value = false;
        currentEnvFlagsToUpdate.push({
          option: "-sUSE_PTHREADS",
          value: null,
          type: "deleteAll",
        });
        otherEnvFlagsToUpdate.push(
          ...([
            {
              option: "-sUSE_PTHREADS",
              value: null,
              type: "deleteAll",
            },
            {
              option: "-sPROXY_TO_PTHREAD",
              value: null,
              type: "deleteAll",
            },
          ] as IArg[])
        );
      }
    } else {
      // ldflags
      if (
        (envFlags.includes("-sUSE_PTHREADS=1") || envFlags.includes("-sPROXY_TO_PTHREAD=1")) &&
        !this.value
      ) {
        this.value = true;
        currentEnvFlagsToUpdate.push(
          ...([
            {
              option: "-sUSE_PTHREADS",
              value: "1",
              type: "replace",
            },
            {
              option: "-sPROXY_TO_PTHREAD",
              value: "1",
              type: "replace",
            },
          ] as IArg[])
        );
        otherEnvFlagsToUpdate.push({
          option: "-sUSE_PTHREADS",
          value: "1",
          type: "replace",
        });
      } else if (
        (!envFlags.includes("-sUSE_PTHREADS=1") ||
          !envFlags.includes("-sPROXY_TO_PTHREAD=1") ||
          envFlags.includes("-sUSE_PTHREADS=0") ||
          envFlags.includes("-sPROXY_TO_PTHREAD=0")) &&
        this.value
      ) {
        this.value = false;
        currentEnvFlagsToUpdate.push(
          ...([
            {
              option: "-sUSE_PTHREADS",
              value: null,
              type: "deleteAll",
            },
            {
              option: "-sPROXY_TO_PTHREAD",
              value: null,
              type: "deleteAll",
            },
          ] as IArg[])
        );

        otherEnvFlagsToUpdate.push({
          option: "-sUSE_PTHREADS",
          value: null,
          type: "deleteAll",
        });
      }
    }

    return {
      [currentEnv]: currentEnvFlagsToUpdate,
      [otherEnv]: otherEnvFlagsToUpdate,
    } as EnvUpdateSet;
  }

  updateToEnvs(): EnvUpdateSet {
    const cflagsToUpdate: IArg[] = [];
    const ldflagsToUpdate: IArg[] = [];
    if (this.value) {
      cflagsToUpdate.push({ option: "-sUSE_PTHREADS", value: "1", type: "replace" });
      ldflagsToUpdate.push(
        ...([
          { option: "-sUSE_PTHREADS", value: "1", type: "replace" },
          {
            option: "-sPROXY_TO_PTHREAD",
            value: "1",
            type: "replace",
          },
        ] as IArg[])
      );
    } else {
      cflagsToUpdate.push({
        option: "-sUSE_PTHREADS",
        value: null,
        type: "deleteAll",
      });
      ldflagsToUpdate.push(
        ...([
          {
            option: "-sUSE_PTHREADS",
            value: null,
            type: "deleteAll",
          },
          {
            option: "-sPROXY_TO_PTHREAD",
            value: null,
            type: "deleteAll",
          },
        ] as IArg[])
      );
    }
    return { cflags: cflagsToUpdate, ldflags: ldflagsToUpdate };
  }
}

// loading
export default function onload() {
  registerOption(PThreadOption.__type__, PThreadOption);
}
