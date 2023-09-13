/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import path from "path";
import fs from "graceful-fs";
import ProjectCacheFile from "./project_cache_file";
import { Project } from "../project";
import { buildDirTree } from "../dtree";
import * as H from "../helper";
import * as C from "../constants";

interface IResultFile {
  path: string;
  name: string;
  type: "file" | "directory";
  size: number;
  date: Date;
}

interface ITargetResult {
  target: string;
  type: "executable" | "library";
  result: IResultFile[];
}

interface IResultTimestamp {
  tStart: Date;
  tEnd: Date;
  tDur: number;
}

export default class ProjectResult extends ProjectCacheFile {
  static __type__ = "ProjectResult";

  constructor(proj: Project, filePath: string) {
    super(proj, filePath, ProjectResult.__type__);
  }

  get files(): ITargetResult[] {
    return this.data.files as ITargetResult[];
  }

  get timestamps(): IResultTimestamp {
    return this.data.timestamps as IResultTimestamp;
  }

  set timestamps(t: IResultTimestamp) {
    this.data = { timestamps: t };
  }

  genFileStats(filePath: string): IResultFile {
    const fileStat = fs.statSync(filePath);
    let fileType = "file";
    if (fileStat.isDirectory()) fileType = "directory";
    return {
      path: filePath,
      name: path.basename(filePath),
      type: fileType,
      size: fileStat.size,
      date: fileStat.mtime,
    } as IResultFile;
  }

  isWithinBuildTime(date: Date): boolean {
    const start = new Date(this.timestamps.tStart);
    const end = new Date(this.timestamps.tEnd);
    if (start && end && start.getTime() <= date.getTime() && date.getTime() <= end.getTime())
      return true;
    return false;
  }

  async genBuildResults() {
    // FIXME. this method will NOT work if we enforce the compiler to target JS (not WebAssembly) with option -sWASM=0
    // as .wasm file will not be generated

    // detect executables output based on generated .wasm file, but ignore matched files from dependency directory
    const wasmFiles = H.matchFilePath("**/*.wasm", this.proj.root, [C.dependencyDir]);
    const targetResults: ITargetResult[] = [];
    if (wasmFiles.length > 0) {
      // sort by file size from large to small, usually the file with largest size should be the
      // main target of the project
      wasmFiles.sort((a, b) => {
        const sizeA = fs.statSync(path.join(this.proj.root, a)).size;
        const sizeB = fs.statSync(path.join(this.proj.root, b)).size;
        if (sizeA < sizeB) return 1;
        else if (sizeA > sizeB) return -1;
        return 0;
      });
      for (const f of wasmFiles) {
        const targetName = path.basename(f, ".wasm");
        // possible files generated for one target:
        // taregt.js, target (JS file w/o extension), target.wasm, target.data, target.worker.js, target.html
        // target.{js,html}.symbols - generate if specify option --emit-symbol-map
        // target.wasm.map - generate source map file if specify option -gsource-map
        const exts = [
          ".js",
          "",
          ".wasm",
          ".data",
          ".worker.js",
          ".html",
          ".js.symbols",
          ".html.symbols",
          ".wasm.map",
        ];
        const buildFiles: IResultFile[] = [];
        for (const ext of exts) {
          let filePath = path.join(this.proj.root, f.replace(".wasm", ext));
          if (fs.existsSync(filePath)) {
            // keep filePath and do nothing
          } else if (
            fs.existsSync(
              path.join(
                this.proj.constant.projectDist,
                "bin",
                path.basename(f.replace(".wasm", ext))
              )
            )
          ) {
            // check file in webinizer_build/bin path
            filePath = path.join(
              this.proj.constant.projectDist,
              "bin",
              path.basename(f.replace(".wasm", ext))
            );
          } else {
            // file doesn't exist
            filePath = "";
          }
          if (filePath) {
            if (ext === "") {
              // ensure target file is JS file rather than native binary file
              const re = await H.runCommand(`file -b ${filePath}`, { silent: true });
              if (re.code === 0 && re.all.includes("ASCII text, with very long lines")) {
                // check if there is .js file exists (maybe from last build) and compare the modified date
                if (buildFiles.map((b) => b.name).includes(targetName + ".js")) {
                  const idx = buildFiles.map((b) => b.name).indexOf(targetName + ".js");
                  const stat = this.genFileStats(filePath);
                  if (this.isWithinBuildTime(stat.date) && stat.date > buildFiles[idx].date) {
                    // replace the stats of .js file
                    fs.renameSync(`${filePath}`, `${filePath + ".js"}`);
                    buildFiles[idx] = {
                      path: stat.path + ".js",
                      name: stat.name + ".js",
                      type: stat.type,
                      size: stat.size,
                      date: stat.date,
                    };
                  }
                } else {
                  // add .js extension to file
                  fs.renameSync(`${filePath}`, `${filePath + ".js"}`);
                  const stat = this.genFileStats(filePath + ".js");
                  if (this.isWithinBuildTime(stat.date)) buildFiles.push(stat);
                }
              }
            } else {
              const stat = this.genFileStats(filePath);
              if (this.isWithinBuildTime(stat.date)) buildFiles.push(stat);
            }
          }
        }
        // for same target name in different location (i.e., from different build),
        // only save the one with latest modified .wasm file
        if (targetResults.map((t) => t.target).includes(targetName)) {
          const idx = targetResults.map((t) => t.target).indexOf(targetName);
          for (const f of targetResults[idx].result) {
            if (f.name === targetName + ".wasm") {
              for (const b of buildFiles) {
                if (b.name === f.name) {
                  if (b.date > f.date)
                    targetResults[idx] = {
                      target: targetName,
                      type: "executable",
                      result: buildFiles,
                    };
                  break;
                }
              }
              break;
            }
          }
        } else {
          targetResults.push({ target: targetName, type: "executable", result: buildFiles });
        }
      }
    }

    // detect library files
    if (this.proj.config.isLibrary) {
      const libFiles: IResultFile[] = [];
      // detect from the default install directory
      if (fs.existsSync(this.proj.constant.projectDist)) {
        // typical install path for library and header files
        const libDirs = ["include", "lib"];
        libDirs.forEach((d) => {
          const dir = path.join(this.proj.constant.projectDist, d);
          if (fs.existsSync(dir)) {
            // scan first level files only
            const libTree = buildDirTree(dir);
            if (libTree.children && Array.isArray(libTree.children)) {
              libTree.children.forEach((child) => {
                const stat = this.genFileStats(child.path);
                if (this.isWithinBuildTime(stat.date)) libFiles.push(stat);
              });
            }
          }
        });
      }
      if (!libFiles.length) {
        // if no library files are detected in the default install path, search for .a/.so files in the project root
        const libExts = [".a", ".so"];
        for (const ext of libExts) {
          // ignore matched files from dependency directory
          H.matchFilePath(`**/*${ext}`, this.proj.root, [C.dependencyDir]).forEach((f) => {
            const stat = this.genFileStats(path.join(this.proj.root, f));
            if (this.isWithinBuildTime(stat.date)) libFiles.push(stat);
          });
        }
      }
      if (libFiles.length) {
        targetResults.push({
          target: this.proj.config.name ? this.proj.config.name : path.basename(this.proj.root),
          type: "library",
          result: libFiles,
        });
      }
    }

    this.data = { files: targetResults };
  }

  clear() {
    this.data = { files: [], timestamps: {} };
  }
}
