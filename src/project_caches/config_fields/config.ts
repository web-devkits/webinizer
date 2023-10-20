import chalk from "chalk";
import * as H from "../../helper";
import errorCode from "../../error_code";
// import { EnvUpdateSet } from "./option";
// import { EnvType } from "webinizer";
import { BuildConfigType, IBuildConfig } from ".";

const log = H.getLogger("config");

// export type BuildConfigType = "preloadFiles" | "exportedFuncs" | "exportedRuntimeMethods";

// export interface IBuildConfig {
//   name: BuildConfigType;
//   value: string | string[];
//   updateFromEnvs?(currentEnv: EnvType, envFlags: string): string;
//   updateToEnvs?(): EnvUpdateSet;
// }

export class BaseBuildConfig implements IBuildConfig {
  name: BuildConfigType;
  private _data: H.Dict<unknown>;
  constructor(name: BuildConfigType, data: H.Dict<unknown>) {
    this.name = name;
    this._data = data;
  }

  get data(): H.Dict<unknown> {
    return this._data;
  }

  get value(): string | string[] {
    const val = this.data[this.name];
    return Array.isArray(val) ? (val as string[]) : (val as string);
  }

  set value(v: string | string[]) {
    this.data[this.name] = v;
  }
}

const ALL_CONFIGS_MAP = new Map<BuildConfigType, typeof BaseBuildConfig>();

export function registerConfig(type: BuildConfigType, configClass: typeof BaseBuildConfig) {
  log.info(`* ${chalk.yellowBright(`<< Config >>`)} - registered ${chalk.cyanBright(type)}`);
  ALL_CONFIGS_MAP.set(type, configClass);
}

export function configFromType(type: BuildConfigType): typeof BaseBuildConfig {
  const configClass = ALL_CONFIGS_MAP.get(type);
  if (!configClass)
    throw new H.WError(
      `Unknown build config type ${type}`,
      errorCode.WEBINIZER_BUILD_CONFIG_UNKNOWN
    );
  return configClass;
}
