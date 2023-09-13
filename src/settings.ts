/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

/**
 * Webinizer Settings
 * @module
 */
import path from "path";
import { homedir } from "os";
import DiskCache from "./disk_cache";
import { IToJson, IJsonObject } from "webinizer";
import { IExtensionSettings, IExtensionSettingsJson } from "./extension";
import * as H from "./helper";
import * as _ from "lodash";
import errorCode from "./error_code";
import * as npmSearch from "libnpmsearch";

const log = H.getLogger("settings");

export async function validateRegistryAddress(reg: string | undefined): Promise<void> {
  if (reg) {
    // validate only when registry is set
    if (!reg.startsWith("http://") && !reg.startsWith("https://")) {
      throw new H.WError(
        "Registry address must be full url, starting with 'http://' or 'https://'.",
        errorCode.WEBINIZER_REG_ADDR_INVALID
      );
    }

    // test registry connectivity by firing a search request to it.
    try {
      await npmSearch.default("test-registry-address", { registry: reg });
    } catch (e) {
      throw new H.WError(
        `Registry service provided by ${reg} is not available. Please set a correct registry address!`,
        errorCode.WEBINIZER_REG_ADDR_INVALID
      );
    }
  }
}

export interface ISettings extends IToJson {
  readonly registry?: string;
  registerFromExtensions(extName: string, extSettings: IExtensionSettings): void;
  updateSettings(jsonParts: H.Dict<unknown>): Promise<void>;
}

class SettingsImpl implements ISettings {
  static __type__ = "WebinizerSettings";
  private static _instance: SettingsImpl;
  private rawJson: DiskCache;
  private extensionSettings = new Map<string, IExtensionSettings>();

  private constructor() {
    this.rawJson = new DiskCache(path.join(homedir(), ".webinizer", "settings.json"));
    if (!this.rawJson.has("__type__")) this.rawJson.set("__type__", SettingsImpl.__type__);
    // clean up extensions settings on each initialization to avoid manual removal of the extensions.
    if (this.rawJson.has("extensions")) this.rawJson.set("extensions", {});
  }

  static getInstance(): SettingsImpl {
    if (!SettingsImpl._instance) {
      SettingsImpl._instance = new SettingsImpl();
    }
    return SettingsImpl._instance;
  }

  get registry(): string | undefined {
    return this.rawJson.get("registry") as string;
  }

  async updateRegistry(v: string | undefined) {
    await validateRegistryAddress(v);
    this.rawJson.set("registry", v);
  }

  toJson(): IJsonObject {
    return this.rawJson.data as IJsonObject;
  }

  registerFromExtensions(extName: string, extSettings: IExtensionSettings) {
    log.info(`... register settings for extension ${extName}`);
    this.extensionSettings.set(extName, extSettings);
    this.rawJson.set(`extensions.${extName}`, this.extSettingToJson(extSettings));
  }

  async updateSettings(jsonParts: H.Dict<unknown>): Promise<void> {
    const jsonKeys = Object.keys(jsonParts);
    if (jsonKeys.includes("registry")) {
      await this.updateRegistry(jsonParts.registry as string);
    }
    if (jsonKeys.includes("extensions")) {
      this.updateExtSettings(jsonParts.extensions as H.Dict<IExtensionSettingsJson>);
    }
  }

  private extSettingToJson({ desc, status }: IExtensionSettings): IExtensionSettingsJson {
    return { desc, status };
  }

  private updateExtSettings(extParts: H.Dict<IExtensionSettingsJson>) {
    const exts = Object.keys(extParts);
    for (const ext of exts) {
      if (this.extensionSettings.has(ext)) {
        const extSettingsToUpdate: IExtensionSettingsJson = extParts[ext];
        log.info(
          `... update settings for extension ${ext} as ${JSON.stringify(
            extSettingsToUpdate,
            undefined,
            2
          )}`
        );
        // update the settings.json
        this.rawJson.set(`extensions.${ext}`, extSettingsToUpdate);
        // update the extensionSettings map and run callback to update the properties
        // in the actual extension metadata.
        const settings = this.extensionSettings.get(ext);
        _.extend(settings, extSettingsToUpdate);
        settings?.updateStatus(extSettingsToUpdate.status);
      } else {
        // unknown extension, throw
        throw new H.WError(
          `Unknown extension ${ext} for Webinizer.`,
          errorCode.WEBINIZER_EXT_UNKNOWN
        );
      }
    }
  }
}

export const Settings: ISettings = SettingsImpl.getInstance();
