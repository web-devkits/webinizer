import { BaseBuildOption, registerOption } from "../option";
import { EnvUpdateSet } from "..";
import { IArg, BuildOptionType, IProjectBuildOptions, EnvType } from "webinizer";

class CppExceptionOption extends BaseBuildOption {
  static __type__: BuildOptionType = "needCppException";
  constructor(name: BuildOptionType, data: IProjectBuildOptions) {
    if (name === CppExceptionOption.__type__) super(name, data);
  }

  updateFromEnvs(currentEnv: EnvType, envFlags: string): EnvUpdateSet {
    const otherEnv: EnvType = currentEnv === "cflags" ? "ldflags" : "cflags";
    const otherEnvFlagsToUpdate: IArg[] = [];

    if (envFlags.includes("-fwasm-exceptions") && !this.value) {
      this.value = true;
      otherEnvFlagsToUpdate.push({ option: "-fwasm-exceptions", value: null, type: "replace" });
    } else if (!envFlags.includes("-fwasm-exceptions") && this.value) {
      this.value = false;
      otherEnvFlagsToUpdate.push({ option: "-fwasm-exceptions", value: null, type: "deleteAll" });
    }

    return {
      [otherEnv]: otherEnvFlagsToUpdate,
    } as EnvUpdateSet;
  }

  updateToEnvs(): EnvUpdateSet {
    const cflagsToUpdate: IArg[] = [];
    const ldflagsToUpdate: IArg[] = [];
    if (this.value) {
      const arg: IArg = { option: "-fwasm-exceptions", value: null, type: "replace" };
      cflagsToUpdate.push(arg);
      ldflagsToUpdate.push(arg);
    } else {
      const arg: IArg = { option: "-fwasm-exceptions", value: null, type: "delete" };
      cflagsToUpdate.push(arg);
      ldflagsToUpdate.push(arg);
    }
    return { cflags: cflagsToUpdate, ldflags: ldflagsToUpdate };
  }
}

// loading
export default function onload() {
  registerOption(CppExceptionOption.__type__, CppExceptionOption);
}
