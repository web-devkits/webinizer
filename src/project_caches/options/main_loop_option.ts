import { BaseConfigOption, registerOption } from "./option";
import { BuildOptionType, IProjectBuildOptions } from "webinizer";

class MainLoopOption extends BaseConfigOption {
  static __type__: BuildOptionType = "needMainLoop";
  constructor(name: BuildOptionType, data: IProjectBuildOptions) {
    if (name === MainLoopOption.__type__) super(name, data);
  }
}

// loading
export default function onload() {
  registerOption(MainLoopOption.__type__, MainLoopOption);
}
