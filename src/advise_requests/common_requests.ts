/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import { FileLocation } from "../actions/file_change";
import { ALL_ADVISE_REQUESTS_FACTORIES } from "../advisor";
import { checkJsonType } from "../json_factory";
import { IJsonObject, IAdviseRequest, Project as IProject } from "webinizer";

export class ErrorAdviseRequest implements IAdviseRequest {
  static __type__ = "ErrorAdviseRequest";
  tags: string[];
  error: string;
  location: FileLocation | null;
  builderID: number;
  constructor(
    tags: string | string[],
    error: string,
    location: FileLocation | null,
    builderID: number
  ) {
    if (!Array.isArray(tags)) {
      tags = [tags];
    }
    this.tags = tags;
    this.error = error;
    this.location = location;
    this.builderID = builderID;
  }
  toJson(): IJsonObject {
    return {
      __type__: ErrorAdviseRequest.__type__,
      tags: this.tags,
      error: this.error,
      location: this.location ? this.location.toJson() : null,
      builder: this.builderID,
    };
  }
  static fromJson(proj: IProject, o: IJsonObject): ErrorAdviseRequest {
    checkJsonType(ErrorAdviseRequest.__type__, o);
    return new ErrorAdviseRequest(
      o.tags as string[],
      o.error as string,
      o.location ? FileLocation.fromJson(o.location as IJsonObject) : null,
      o.builder as number
    );
  }
}

// This is a plain AdviseRequest which means itself is a kind of Json so easy to fromJson() and
// toJson()
export class PlainAdviseRequest implements IAdviseRequest {
  static __type__ = "PlainAdviseRequest";
  tags: string[];
  plainData: unknown; // the plain data
  constructor(tags: string | string[], plainData: unknown) {
    if (!Array.isArray(tags)) {
      tags = [tags];
    }
    this.tags = tags;
    this.plainData = plainData;
  }
  toJson(): IJsonObject {
    return {
      __type__: PlainAdviseRequest.__type__,
      tags: this.tags,
      plainData: this.plainData,
    };
  }
  static fromJson(proj: IProject, o: IJsonObject): PlainAdviseRequest {
    checkJsonType(PlainAdviseRequest.__type__, o);
    return new PlainAdviseRequest(o.tags as string[], o.plainData);
  }
}

export default function onload() {
  ALL_ADVISE_REQUESTS_FACTORIES.register(ErrorAdviseRequest.__type__, ErrorAdviseRequest.fromJson);
  ALL_ADVISE_REQUESTS_FACTORIES.register(PlainAdviseRequest.__type__, PlainAdviseRequest.fromJson);
}
