/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import { Project } from "../project";
import * as H from "../helper";
import errorCode from "../error_code";
import writeFileAtomic from "write-file-atomic";
import * as _ from "lodash";
import path from "path";
import { Settings } from "../settings";

const log = H.getLogger("package_publish");

// publish project to registry
export default async function publish(proj: Project) {
  if (!Settings.registry) {
    log.warn(`No registry is set in Webinizer settings!`);
    throw new H.WError(
      "No registry is set in Webinizer settings.",
      errorCode.WEBINIZER_REG_UNDEFINED
    );
  }
  // 1. convert config.json and save to package.json
  await proj.config.convertToRegMetaForPublish();

  // 2. validate package.json format before publish to ensure required fields exist
  proj.meta.validateMetaSchema(_.cloneDeep(proj.meta.data));

  // 3. git add all changes and commit
  // Add `package.json` into commit tree by default
  // Use `git add -u` to handle updated and deleted files only
  const commit = await H.runCommand(
    `git add package.json && git add -u && git commit -m '${proj.config.version}'`,
    {
      cwd: proj.root,
      silent: true,
    }
  );
  if (commit.code !== 0) {
    log.warn(`Commit changes for version ${proj.config.version} failed.\n`, commit.error);
    throw new H.WError(
      `Commit changes for version ${proj.config.version} failed due to error ${commit.error}`,
      errorCode.WEBINIZER_REG_PUBLISH_FAIL
    );
  } else log.info(`Committed changes for version ${proj.config.version}.`);

  // 4. prepare .npmignore to exclude files for publishing (based on git untracked files list)
  const untracked = await H.runCommand("git ls-files --others --exclude-standard", {
    cwd: proj.root,
    silent: true,
  });
  if (untracked.code === 0) {
    const untrackedList = untracked.all
      .split("\n")
      .filter((line) => {
        if (!line.trim()) return false;
        // if the project uses default icon, just ignore all uploaded
        // icons under .webinizer/icons folder, otherwise ignore other
        // uploaded icons and just kept the one used by the project.
        if (proj.config.img?.isUploaded) {
          const img = path.join(".webinizer/icons/", proj.config.img.name);
          if (img === line) return false;
        }
        return true;
      })
      .map((line) => "/" + line.trim()); // add "/" to the beginning to specify files/dirs relative to .npmignore

    // add .webinizer/config.json to ignore list
    if (!untrackedList.includes("/.webinizer/config.json")) {
      untrackedList.push("/.webinizer/config.json");
    }

    // create .npmignore file
    writeFileAtomic.sync(path.join(proj.root, ".npmignore"), untrackedList.join("\n") + "\n", {
      mode: 0o0600,
    });
  }

  // 5. publish
  const publish = await H.runCommand(`npm publish --registry ${Settings.registry}`, {
    cwd: proj.root,
  });
  if (publish.code !== 0) {
    log.warn(`Publish ${proj.config.name?.toLowerCase()} failed.\n`, publish.error);
    // reset last commit if publish failed
    await H.runCommand("git reset HEAD^", { cwd: proj.root, silent: true });
    throw new H.WError(
      `Publish ${proj.config.name?.toLowerCase()} failed due to error ${publish.error}`,
      errorCode.WEBINIZER_REG_PUBLISH_FAIL
    );
  }
}
