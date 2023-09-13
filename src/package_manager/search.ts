/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import * as H from "../helper";
import * as npmSearch from "libnpmsearch";
import * as _ from "lodash";
import { Settings } from "../settings";
import errorCode from "../error_code";

const log = H.getLogger("package_search");

/**
 * The direct search result from the registry, for compatible with
 * Verdaccio search.
 */
interface IRegistrySearchResult extends npmSearch.Result {
  "dist-tags"?: { latest: string };
}

/**
 * The simplified search result passed to UI.
 */
export interface IPackageSearchResult {
  name: string;
  version?: string;
  description?: string;
}

/**
 * Search with keywords in registry
 * @param text keywords to search
 * @param options search options
 * @returns search result array
 */
export async function search(
  text: string,
  options?: npmSearch.Options
): Promise<IPackageSearchResult[]> {
  if (!Settings.registry) {
    log.warn(`No registry is set in webinizer settings!`);
    throw new H.WError(
      "No registry is set in webinizer settings.",
      errorCode.WEBINIZER_REG_UNDEFINED
    );
  }
  const searchOpts = getRegistryBaseOptions();
  if (options) {
    _.extend(searchOpts, options);
  }
  const searchResults = (await npmSearch.default(text, searchOpts)) as IRegistrySearchResult[];
  return searchResults.map((item) => {
    return {
      name: item.name,
      version: item.version
        ? item.version
        : item["dist-tags"]?.latest /* a workaround for Verdaccio */,
      description: item.description,
    };
  });
}

function getRegistryBaseOptions(): npmSearch.Options {
  return {
    registry: Settings.registry,
  };
}
