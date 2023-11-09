/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import * as H from "../helper";
import { ALL_ACTION_FACTORIES } from "../action";
import { checkJsonType } from "../json_factory";
import fs from "graceful-fs";
import writeFileAtomic from "write-file-atomic";
import errorCode from "../error_code";
import { IAction, IJsonObject, IToJson, Project as IProject, IFileChangeManager } from "webinizer";

const log = H.getLogger("file_change");

export class FileLocation implements IToJson {
  file: string;
  line: number;
  col: number;
  constructor(file: string, line: number, col: number) {
    this.file = file;
    this.line = line;
    this.col = col;
  }
  static fromJson(o: IJsonObject): FileLocation {
    checkJsonType("FileLocation", o);
    return new FileLocation(o.file as string, o.line as number, o.col as number);
  }

  toJson(): IJsonObject {
    return {
      __type__: "FileLocation",
      file: this.file,
      line: this.line,
      col: this.col,
    };
  }

  toFileRegion(): FileRegion {
    return new FileRegion(this.file, this.line);
  }
}

// TODO: currently the granualarity is line, maybe in the future we could further improve it to be
// character based so to avoid conflicts
export class FileRegion implements IToJson {
  file: string; // path
  lineStart: number;
  lineEnd: number;

  static fromJson(o: IJsonObject): FileRegion {
    checkJsonType("FileRegion", o);
    return new FileRegion(o.file as string, o.lineStart as number, o.lineEnd as number);
  }
  toJson(): IJsonObject {
    return {
      __type__: "FileRegion",
      file: this.file,
      lineStart: this.lineStart,
      lineEnd: this.lineEnd,
    };
  }
  /**
   * Represent a region of lines in the file. [LineStart, LineEnd), 0 indexed
   * @param file path to the file
   * @param lineStart start of the region, 0 indexed
   * @param lineEnd end of the region
   */
  constructor(file: string, lineStart: number, lineEnd = lineStart + 1) {
    H.assert(lineEnd >= lineStart && lineStart >= 0, "Invalid line numbers!");
    this.file = file;
    this.lineStart = lineStart;
    this.lineEnd = lineEnd;
  }
  isIntersected(r: FileRegion): boolean {
    if (r.file !== this.file) {
      return false;
    }
    // if lineStart or lineEnd in previous recorded FileRegion - intersect
    return (
      (r.lineStart <= this.lineStart && this.lineStart < r.lineEnd) ||
      (r.lineStart < this.lineEnd && this.lineEnd <= r.lineEnd)
    );
  }

  /**
   * Lines change change if some region in this file is changed
   * @param r The region changed
   * @param nNewLines Number of lines after changed that region
   * @returns number of lines to change
   */
  linesToAdjust(r: FileRegion, nNewLines: number): number {
    if (this.isIntersected(r)) {
      throw new H.WError(
        `linesToAdjust: ${H.prettyFormat(this)} intersects with ${H.prettyFormat(r)}`,
        errorCode.WEBINIZER_ACTION_FILE_INTERSECT
      );
    }
    if (r.file !== this.file || r.lineStart >= this.lineEnd) {
      return 0;
    }
    return nNewLines - (r.lineEnd - r.lineStart);
  }
}

// Multiple FileChangeActions may change to one file, so we need one manager to coordinate all of
// them to ensure all histories in this one session is all tracked and managed
export class FileChangeManager {
  _changes: { [key: string]: FileChangeAction[] } = {};

  private _updateFile(region: FileRegion, content: string | null): void {
    const lines = fs.readFileSync(region.file, "utf-8").split("\n");

    lines.splice(
      region.lineStart - 1,
      region.lineEnd - region.lineStart,
      ...(content !== null ? [content] : [])
    );

    writeFileAtomic.sync(region.file, lines.join("\n"), "utf-8");
  }

  async apply(action: FileChangeAction): Promise<boolean> {
    const file = action.region.file;
    if (!(file in this._changes)) {
      this._changes[file] = [];
    }
    const actualRegion = action.actualFileRegion(this._changes[file]);
    if (!actualRegion) {
      log.error("File change conflicts for action", action);
      return false;
    }
    this._changes[file].push(action);
    this._updateFile(actualRegion, action.newContent);
    return true;
  }
}

export class FileChangeAction implements IAction {
  static __type__ = "FileChange";
  type = FileChangeAction.__type__;
  manager: IFileChangeManager;
  desc: string;
  region: FileRegion;
  newContent: string | null;
  nLinesNewContent = 0;
  /**
   * An action to change the content of files
   * @param manager the manager to handle all changes
   * @param desc action description
   * @param region area to change
   * @param content new content. It means delete if this is null
   */
  constructor(
    manager: IFileChangeManager,
    desc: string,
    region: FileRegion,
    content: string | null
  ) {
    this.manager = manager;
    this.desc = desc;
    this.region = region;
    this.newContent = content;
    if (content !== null) {
      this.nLinesNewContent = content.split("\n").length;
    }
  }
  async apply(): Promise<boolean> {
    return await this.manager.apply(this);
  }

  toJson(): IJsonObject {
    return {
      __type__: FileChangeAction.__type__,
      desc: this.desc,
      region: this.region.toJson(),
      newContent: this.newContent,
    };
  }

  static fromJson(proj: IProject, o: IJsonObject): FileChangeAction {
    checkJsonType(FileChangeAction.__type__, o);
    return new FileChangeAction(
      proj.fileChangeManager,
      o.desc as string,
      FileRegion.fromJson(o.region as IJsonObject),
      o.newContent as string
    );
  }
  /**
   * Actual region if the target file already changed by other actions
   * @param changes A list of FileChangActions happen in advance
   * @returns returns null if there is a conflict, otherwise the adjusted FileRegion. Conflict
   * example: change line [10, 20] but there is somebody already changed line [15, 16] in this
   * region
   */
  actualFileRegion(changes: FileChangeAction[]): FileRegion | null {
    let delta = 0;
    for (const c of changes) {
      try {
        delta += this.region.linesToAdjust(c.region, c.nLinesNewContent);
      } catch (e) {
        log.error("File change conflicts:", H.prettyFormat(this.region), H.prettyFormat(c.region));
        return null;
      }
    }
    return new FileRegion(
      this.region.file,
      this.region.lineStart + delta,
      this.region.lineEnd + delta
    );
  }
}

export default function onload() {
  ALL_ACTION_FACTORIES.register(FileChangeAction.__type__, FileChangeAction.fromJson);
}
