/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import { registerAdvisorFactory } from "../advisor";
import { Recipe } from "../recipe";
import { ErrorAdviseRequest } from "../advise_requests/common_requests";
import { ConfigEnvChangeAction } from "../actions/config_env_change";
import {
  IArg,
  IAdviseRequest,
  IAdviseResult,
  IAdvisorFactory,
  IAdvisor,
  Project as IProject,
} from "webinizer";

class InitialMemoryAdvisorFactory implements IAdvisorFactory {
  name = "InitialMemoryAdvisorFactory";
  desc = "Use this factory class to create InitialMemoryAdvisor instance";

  createAdvisor(): IAdvisor {
    return new InitialMemoryAdvisor();
  }
}

class InitialMemoryAdvisor implements IAdvisor {
  static __type__ = "InitialMemoryAdvisor";
  type = InitialMemoryAdvisor.__type__;
  desc = "Advise issues related to initial memory";

  private getNeededMemorySize(errStr: string): number {
    const lines = errStr.split("\n");
    const sizeReg = /initial memory too small, (?<size>.*) bytes needed/;

    for (let i = lines.length - 1; i > 0; i--) {
      const m = lines[i].match(sizeReg);
      if (m && m.groups) {
        const required_size = m.groups.size.trim();
        return Math.pow(2, Math.ceil(Math.log2(Number(required_size))));
      }
    }
    return NaN;
  }

  private async _fixInitMemoryTooSmallErr(
    proj: IProject,
    req: ErrorAdviseRequest
  ): Promise<IAdviseResult> {
    const needed_size = this.getNeededMemorySize(req.error);
    // if we didn't get the needed_size from error log, set the size to maximum one 2GB
    const set_size = needed_size ? needed_size : Number(2147483648);
    const action = new ConfigEnvChangeAction(
      proj,
      `The initial amount of memory to use is too \`small\` for your application, we need to set it to \`${set_size}\` byte and allow memory growth at runtime.`,
      {
        ldflags: [
          { option: "-sINITIAL_MEMORY", value: `${set_size}`, type: "replace" },
          { option: "-sALLOW_MEMORY_GROWTH", value: "1", type: "replace" },
        ] as IArg[],
      }
    );

    return {
      handled: true,
      recipe: new Recipe(proj, "Recipe for initial memory size issue", this, req, action),
    };
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  async advise(
    proj: IProject,
    req: IAdviseRequest,
    requestList: ReadonlyArray<IAdviseRequest> // one can only return newRequestQueue to change it
  ): Promise<IAdviseResult> {
    if (req instanceof ErrorAdviseRequest) {
      const errorReq = req as ErrorAdviseRequest;
      if (errorReq.error.includes("initial memory too small")) {
        return this._fixInitMemoryTooSmallErr(proj, errorReq);
      }
    }
    return {
      handled: false,
    };
  }
}

// loading
export default function onload() {
  registerAdvisorFactory(InitialMemoryAdvisor.__type__, new InitialMemoryAdvisorFactory());
}
