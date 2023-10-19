import chalk from "chalk";
import * as H from "../../helper";
import errorCode from "../../error_code";
import { BuildOptionType, EnvType, IArg, IProjectBuildOptions } from "webinizer";

const log = H.getLogger("option");

export interface IConfigOption {
  name: BuildOptionType;
  value: boolean;
  updateFromEnvs?(currentEnv: EnvType, envFlags: string): EnvUpdateSet;
  updateToEnvs?(): EnvUpdateSet;
}

export type EnvUpdateSet = Record<EnvType, IArg[]>;

export class BaseConfigOption implements IConfigOption {
  name: BuildOptionType;
  private _data: IProjectBuildOptions;
  constructor(name: BuildOptionType, data: IProjectBuildOptions) {
    this.name = name;
    this._data = data;
  }

  get data(): IProjectBuildOptions {
    return this._data;
  }

  get value(): boolean {
    return this.data[this.name] || false;
  }

  set value(v: boolean) {
    this.data[this.name] = v;
  }
}

const ALL_OPTIONS_MAP = new Map<BuildOptionType, typeof BaseConfigOption>();

export function registerOption(type: BuildOptionType, optionClass: typeof BaseConfigOption) {
  log.info(`* ${chalk.yellowBright(`<< Option >>`)} - registered ${chalk.cyanBright(type)}`);
  ALL_OPTIONS_MAP.set(type, optionClass);
}

export function optionFromType(type: BuildOptionType): typeof BaseConfigOption {
  const optionClass = ALL_OPTIONS_MAP.get(type);
  if (!optionClass)
    throw new H.WError(
      `Unknown config option type ${type}`,
      errorCode.WEBINIZER_CONFIG_OPTION_UNKNOWN
    );
  return optionClass;
}
