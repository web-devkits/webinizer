import { BaseBuildOption, registerOption } from "../option";
import { EnvUpdateSet } from "..";
import { IArg, BuildOptionType, IProjectBuildOptions, EnvType } from "webinizer";

class ModularizeOption extends BaseBuildOption {
  static __type__: BuildOptionType = "needModularize";
  constructor(name: BuildOptionType, data: IProjectBuildOptions) {
    if (name === ModularizeOption.__type__) super(name, data);
  }

  updateFromEnvs(currentEnv: EnvType, envFlags: string): EnvUpdateSet {
    const currentEnvFlagsToUpdate: IArg[] = [];

    if (currentEnv === "ldflags") {
      // modularize option impacts only linker flags
      if (envFlags.includes("-sMODULARIZE=1") && !this.value) {
        this.value = true;
      } else if (
        (!envFlags.includes("-sMODULARIZE=1") || envFlags.includes("-sMODULARIZE=0")) &&
        this.value
      ) {
        this.value = false;
        currentEnvFlagsToUpdate.push({ option: "-sMODULARIZE", value: null, type: "deleteAll" });
      }
    }

    return {
      [currentEnv]: currentEnvFlagsToUpdate,
    } as EnvUpdateSet;
  }

  updateToEnvs(): EnvUpdateSet {
    const ldflagsToUpdate: IArg[] = [];
    if (this.value) {
      ldflagsToUpdate.push({
        option: "-sMODULARIZE",
        value: "1",
        type: "replace",
      });
    } else {
      ldflagsToUpdate.push({
        option: "-sMODULARIZE",
        value: null,
        type: "deleteAll",
      });
    }

    return { ldflags: ldflagsToUpdate } as EnvUpdateSet;
  }
}

// loading
export default function onload() {
  registerOption(ModularizeOption.__type__, ModularizeOption);
}
