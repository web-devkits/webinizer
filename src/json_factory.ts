/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import chalk from "chalk";
import * as H from "./helper";
import errorCode from "./error_code";
import { IJsonObject, IFromJson, FromJsonMethod, Project as IProject } from "webinizer";

const log = H.getLogger("factory");

export function checkJsonType(type: string, o: IJsonObject) {
  H.assert(type === o.__type__, `Json expects ${type} but got ${o.__type__}`);
}

// By default, the Factory only contains fromJson(), but if one need to add more
// items into it, you could explicitly pass in X as well.
export class JsonFactories<
  T,
  X extends IFromJson<T> | FromJsonMethod<T> = IFromJson<T> | FromJsonMethod<T>
> implements IFromJson<T>
{
  name: string;
  private _map = new Map<string, X>();
  constructor(name: string) {
    this.name = name;
  }
  fromJson(proj: IProject, o: IJsonObject, index: number): T | null {
    const f = this._map.get(o.__type__);
    if (f) {
      // eslint-disable-next-line
      if (typeof (f as any).fromJson === "function") {
        return (f as IFromJson<T>).fromJson(proj, o, index);
      } else {
        return (f as FromJsonMethod<T>)(proj, o, index);
      }
    }
    return null;
  }
  register(type: string, method_or_factory: X) {
    if (this._map.has(type)) {
      throw new H.WError(
        `Factory for type ${type} has already been registered.`,
        errorCode.WEBINIZER_JSONFACTORY_DUP_REG
      );
    }
    this._map.set(type, method_or_factory);
    const head = `<< ${this.name} >>`;
    log.info(`* ${chalk.yellowBright(head)} - registered ${chalk.cyanBright(type)}`);
  }
  factoriesMap(): Map<string, X> {
    return this._map;
  }

  // build an array of objects. Throw Error if any of the json failed to deserialize
  fromJsonArray(proj: IProject, arr: IJsonObject[]): T[] {
    return arr.map((json, index) => {
      const o = this.fromJson(proj, json, index);
      if (o) {
        return o;
      }
      throw new H.WError(
        `fromJson() returns null for ${JSON.stringify(o, null, 1)}.`,
        errorCode.WEBINIZER_JSONFACTORY_DESERIALIZE_FAIL
      );
    });
  }
}
