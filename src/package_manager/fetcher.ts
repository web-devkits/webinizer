/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

/**
 * Package Fetcher
 * @module
 */

import pacote from "pacote";
import * as _ from "lodash";
import fs from "graceful-fs";
import writeFileAtomic from "write-file-atomic";
import path from "path";
import * as H from "../helper";
import errorCode from "../error_code";
import { Project } from "../project";
import { IPackageSpec } from "./resolver";
import { Settings } from "../settings";
import npa from "npm-package-arg";

const log = H.getLogger("package_fetcher");

// A wrapper over pacote implementation
export type IRegistryOptions = pacote.Options;
export type IPackageManifest = pacote.AbbreviatedManifest & pacote.ManifestResult;
export type IPackagePackument = pacote.AbbreviatedPackument & pacote.PackumentResult;

class BaseFetcher {
  spec: string;
  options: IRegistryOptions | undefined;
  registryValidity = true;
  constructor(spec: string, options?: IRegistryOptions) {
    this.spec = spec;
    if (options) this.options = { ...options };
    // registry validation for fetcher for registry
    const result = npa(this.spec);
    switch (result.type) {
      case "version":
      case "range":
      case "tag":
      case "alias":
        if (!Settings.registry) this.registryValidity = false;
        break;
      default: // no registry check required
    }
  }

  async getManifest(): Promise<IPackageManifest> {
    this.checkRegistryValidity();
    try {
      const fetchOpts = this.getRegistryBaseOptions();
      if (this.options) {
        _.extend(fetchOpts, this.options);
      }
      log.info(`getManifest with spec:`, this.spec);
      const manifest = await pacote.manifest(this.spec, fetchOpts);
      return manifest;
      //eslint-disable-next-line
    } catch (error: any) {
      if (error.code === "E404") {
        log.error(`No package found for ${this.spec}`);
        throw new H.WError(
          `No package found for ${this.spec}`,
          errorCode.WEBINIZER_REG_PKG_INVALID
        );
      }
      if (error.code === "ETARGET" && error.type === "version") {
        log.error(`No matching version ${error.wanted} found for ${this.spec}`);
        throw new H.WError(
          `No matching version ${error.wanted} found for ${this.spec}`,
          errorCode.WEBINIZER_REG_VER_INVALID
        );
      }
      throw error;
    }
  }

  async getPackument(): Promise<IPackagePackument> {
    this.checkRegistryValidity();
    try {
      const fetchOpts = this.getRegistryBaseOptions();
      if (this.options) {
        _.extend(fetchOpts, this.options);
      }
      log.info(`getPackument with spec:`, this.spec);
      const packument = await pacote.packument(this.spec, fetchOpts);
      return packument;
      //eslint-disable-next-line
    } catch (error: any) {
      if (error.code === "E404") {
        log.error(`No package found for ${this.spec}`);
        throw new H.WError(
          `No package found for ${this.spec}`,
          errorCode.WEBINIZER_REG_PKG_INVALID
        );
      }
      throw error;
    }
  }

  async fetchPackage(dest: string) {
    this.checkRegistryValidity();
    try {
      const fetchOpts = this.getRegistryBaseOptions();
      if (this.options) {
        _.extend(fetchOpts, this.options);
      }
      const fetched = await pacote.extract(this.spec, dest, fetchOpts);
      log.info(`Fetch package ${this.spec} from ${fetched.resolved} successfully at ${dest}`);
      //eslint-disable-next-line
    } catch (error: any) {
      log.error(`Fetch package ${this.spec} fail due to error`, error as Error);
      throw error;
    }
  }

  getRegistryBaseOptions(): IRegistryOptions {
    if (this.registryValidity)
      return {
        registry: Settings.registry,
      };
    return {};
  }

  checkRegistryValidity() {
    if (!this.registryValidity) {
      log.warn(`No registry is set in Webinizer settings!`);
      throw new H.WError(
        "No registry is set in Webinizer settings.",
        errorCode.WEBINIZER_REG_UNDEFINED
      );
    }
  }
}

// subclass DirFetcher - handle local dependency
class DirFetcher extends BaseFetcher {
  constructor(spec: string, options?: IRegistryOptions) {
    super(spec, options);
  }

  // ensure package.json and config.json are always synced up-to-date
  async preparePackageJson() {
    // `spec` is path to a local directory
    const proj = new Project(this.spec, false);
    if (fs.existsSync(proj.config.path)) {
      await proj.config.convertToRegMetaForPublish();
    }
    if (fs.existsSync(proj.meta.path)) {
      // validate metadata schema
      proj.meta.validateMetaSchema(_.cloneDeep(proj.meta.data));
      await H.runCommand(`git add package.json && git add -u`, {
        cwd: proj.root,
        silent: true,
      });
    } else {
      throw new H.WError("No metadata defined for package.", errorCode.WEBINIZER_META_UNDEFINED);
    }
  }

  async getManifest(): Promise<IPackageManifest> {
    await this.preparePackageJson();
    return super.getManifest();
  }

  async getPackument(): Promise<IPackagePackument> {
    await this.preparePackageJson();
    return super.getPackument();
  }

  async fetchPackage(dest: string) {
    try {
      await this.preparePackageJson();

      // prepare .npmignore to exclude files for packing (based on git untracked files list)
      const untracked = await H.runCommand("git ls-files --others --exclude-standard", {
        cwd: this.spec,
        silent: true,
      });
      if (untracked.code === 0) {
        const untrackedList = untracked.all
          .split("\n")
          .filter((line) => line.trim())
          .map((line) => "/" + line.trim()); // add "/" to the beginning to specify files/dirs relative to .npmignore
        // add .webinizer/config.json to ignore list
        if (!untrackedList.includes("/.webinizer/config.json")) {
          untrackedList.push("/.webinizer/config.json");
        }
        // create .npmignore file
        writeFileAtomic.sync(path.join(this.spec, ".npmignore"), untrackedList.join("\n") + "\n", {
          mode: 0o0600,
        });
      }

      // pack the package
      const pack = await H.runCommand("npm pack --json", { cwd: this.spec, silent: true });
      if (pack.code !== 0) {
        log.warn(`Failed to pack package ${this.spec} due to error`, pack.error);
        throw new H.WError(
          `Failed to pack package ${this.spec} due to error ${pack.error}`,
          errorCode.WEBINIZER_REG_PACK_FAIL
        );
      }

      const packageFilename = JSON.parse(pack.output)[0].filename;
      try {
        const fetched = await pacote.extract(path.join(this.spec, packageFilename), dest);
        log.info(`Fetch package ${this.spec} from ${fetched.resolved} successfully at ${dest}`);
        // remove package.tgz file after extract successfully
        fs.rmSync(path.join(this.spec, packageFilename));
      } catch (error) {
        log.error(`Errors happend when extracting ${packageFilename} to ${dest}`, error as Error);
        // if errors happened, remove both package.tgz and possibly the package folder.
        fs.rmSync(path.join(this.spec, packageFilename), { force: true });
        fs.rmSync(dest, { recursive: true, force: true });
        throw error as Error;
      }
      //eslint-disable-next-line
    } catch (error: any) {
      log.error(`Fetch package ${this.spec} fail due to error`, error as Error);
      throw error;
    }
  }
}

export function getPackageFetcher(
  { name, reference, version }: IPackageSpec,
  options?: IRegistryOptions
): BaseFetcher | DirFetcher {
  if (reference.startsWith("file:")) {
    const filePath = reference.replace("file:", "");
    if (fs.existsSync(filePath)) {
      const fileStat = fs.statSync(filePath);
      if (fileStat.isDirectory()) {
        return new DirFetcher(filePath, options);
      }
      if (fileStat.isFile()) {
        const isFileName = /[.](?:tgz|tar.gz|tar)$/i;
        if (isFileName.test(filePath)) return new BaseFetcher(filePath, options);
      }
    }
    throw new H.WError(
      `Invalid local package path ${reference}`,
      errorCode.WEBINIZER_REG_PKG_INVALID
    );
  }
  if (version) {
    return new BaseFetcher(`${name}@${version}`, options);
  } else {
    return new BaseFetcher(`${name}@${reference}`, options);
  }
}
