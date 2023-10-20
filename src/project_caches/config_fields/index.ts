/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import { BuildOptionType, IArg, EnvType } from "webinizer";

export type EnvUpdateSet = Record<EnvType, IArg[]>;

export interface IBuildOption {
  name: BuildOptionType;
  value: boolean;
  updateFromEnvs?(currentEnv: EnvType, envFlags: string): EnvUpdateSet;
  updateToEnvs?(): EnvUpdateSet;
}

export type BuildConfigType = "preloadFiles" | "exportedFuncs" | "exportedRuntimeMethods";

export interface IBuildConfig {
  name: BuildConfigType;
  value: string | string[];
  updateFromEnvs?(currentEnv: EnvType, envFlags: string): string;
  updateToEnvs?(): EnvUpdateSet;
}

export { BaseBuildOption, optionFromType } from "./option";
export { BaseBuildConfig, configFromType } from "./config";
