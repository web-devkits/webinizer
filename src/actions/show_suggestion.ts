/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import * as H from "../helper";
import { ALL_ACTION_FACTORIES } from "../action";
import { checkJsonType } from "../json_factory";
import { FileRegion } from "./file_change";
import { IAction, IJsonObject, IToJson, Project as IProject } from "webinizer";

const log = H.getLogger("show_suggestion");

// "option": suggestions generated based on user options
// "error": suggestions generated based on error requests
export type SuggestionInitiator = "option" | "error";

export class SuggestionExample implements IToJson {
  before: string; //before modification
  after: string; // after modification
  constructor(before: string, after: string) {
    this.before = before;
    this.after = after;
  }

  static fromJson(o: IJsonObject): SuggestionExample {
    checkJsonType("SuggestionExample", o);
    return new SuggestionExample(o.before as string, o.after as string);
  }

  toJson(): IJsonObject {
    return {
      __type__: "SuggestionExample",
      before: this.before,
      after: this.after,
    };
  }
}

export class ShowSuggestionAction implements IAction {
  static __type__ = "ShowSuggestion";
  type = ShowSuggestionAction.__type__;
  initiator: SuggestionInitiator;
  desc: string;
  suggestion: SuggestionExample | null;
  region: FileRegion | null;
  /**
   * An action to show suggestion to user
   * @param init the initiator of the suggestion
   * @param desc action description
   * @param suggestion the suggestion example
   * @param region the file region related with the suggestion
   */
  constructor(
    init: SuggestionInitiator,
    desc: string,
    suggestion: SuggestionExample | null,
    region: FileRegion | null
  ) {
    this.initiator = init;
    this.desc = desc;
    this.suggestion = suggestion;
    this.region = region;
  }

  async apply(): Promise<boolean> {
    // display suggestion message for debugging
    log.info(
      `${this.region ? this.region.file + ":" + this.region.lineStart : "General:"} ${this.desc}`
    );
    if (this.suggestion) {
      log.info(`Example\nBefore:\n${this.suggestion.before}\nAfter:\n${this.suggestion.after}`);
    }
    return true;
  }

  toJson(): IJsonObject {
    return {
      __type__: this.type,
      initiator: this.initiator,
      desc: this.desc,
      suggestion: this.suggestion ? this.suggestion.toJson() : null,
      region: this.region ? this.region.toJson() : null,
    };
  }

  static fromJson(proj: IProject, o: IJsonObject): ShowSuggestionAction {
    checkJsonType(ShowSuggestionAction.__type__, o);
    return new ShowSuggestionAction(
      o.initiator as SuggestionInitiator,
      o.desc as string,
      o.suggestion ? SuggestionExample.fromJson(o.suggestion as IJsonObject) : null,
      o.region ? FileRegion.fromJson(o.region as IJsonObject) : null
    );
  }
}

export default function onload() {
  ALL_ACTION_FACTORIES.register(ShowSuggestionAction.__type__, ShowSuggestionAction.fromJson);
}
