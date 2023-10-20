import * as H from "../../../helper";
import errorCode from "../../../error_code";
import { EnvUpdateSet, BuildConfigType } from "..";
import { BaseBuildConfig, registerConfig } from "../config";
import { EnvType, IArg } from "webinizer";
import shlex from "shlex";

class ExportedFuncsConfig extends BaseBuildConfig {
  static __type__: BuildConfigType = "exportedFuncs";
  constructor(name: BuildConfigType, data: H.Dict<unknown>) {
    if (name === ExportedFuncsConfig.__type__) super(name, data);
  }

  updateFromEnvs(currentEnv: EnvType, envFlags: string): string {
    // impact from ldflags only
    if (currentEnv !== "ldflags") {
      throw new H.WError(
        `Wrong environment vairable flags ${currentEnv} to update ${this.name} from.`,
        errorCode.WEBINIZER_BUILD_CONFIG_GENERAL
      );
    }

    let setExportedFuncs = false;

    const args = shlex.split(envFlags);
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a.includes("-sEXPORTED_FUNCTIONS") && !setExportedFuncs) {
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
          args[i] = `-sEXPORTED_FUNCTIONS=${fns.join(",")}`;
          // remove the first "_"
          this.value = fns.map((fn) => fn.replace("_", "")).join(",");
          setExportedFuncs = true;
        }
      }
    }

    if (!setExportedFuncs) this.value = "";
    // return the updated envFlags to update envs field
    return shlex.join(args);
  }

  updateToEnvs(): EnvUpdateSet {
    console.log(`updateToEnvs from exportedFuncs`);
    const ldflagsToUpdate: IArg[] = [];
    const val = this.value as string;
    if (val && val.trim()) {
      console.log(`if - ${val}`);
      const uniqFns = [
        ...new Set(
          val
            .split(",")
            .map((f) => f.trim())
            .filter((f) => f)
        ),
      ];
      const fns = uniqFns.map((f) => "_" + f);
      this.value = uniqFns.join(",");
      ldflagsToUpdate.push({
        option: "-sEXPORTED_FUNCTIONS",
        value: `${fns.join(",")}`,
        type: "replace",
      });
    } else {
      console.log(`else - ${val}`);
      // if exportedFuncs is "", remove -sEXPORTED_FUNCTIONS arg
      ldflagsToUpdate.push({
        option: "-sEXPORTED_FUNCTIONS",
        value: null,
        type: "deleteAll",
      });
    }

    return { ldflags: ldflagsToUpdate } as EnvUpdateSet;
  }
}

// loading
export default function onload() {
  registerConfig(ExportedFuncsConfig.__type__, ExportedFuncsConfig);
}
