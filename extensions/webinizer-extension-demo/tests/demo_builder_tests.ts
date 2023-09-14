/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import * as webinizer from "webinizer";
import { expect } from "chai";
import path from "path";
import { backupFolderSync, deleteFolder, renameFolder } from "./utils";

const DEMO_BUILDER_ASSETS_DIR = path.join(__dirname, "assets", "builders");

async function build(root: string, target = "static"): Promise<boolean> {
  const proj = new webinizer.Project(root);
  const builder = proj.config.getBuildConfigForTarget(target).builders?.[0];
  expect(builder).to.not.be.null;
  return (builder as webinizer.IBuilder).build(new webinizer.AdviseManager(proj));
}

describe("builder", () => {
  before(() => {
    //Backup the "assets/builders" folder
    backupFolderSync(DEMO_BUILDER_ASSETS_DIR, path.join(__dirname, "assets", ".builders"));
  });

  after(() => {
    //Delete the older "assets/builders" and restore it from backup
    deleteFolder(DEMO_BUILDER_ASSETS_DIR);
    renameFolder(path.join(__dirname, "assets", ".builders"), DEMO_BUILDER_ASSETS_DIR);
  });
  it("DemoBuilderTest", async () => {
    const projRoot = path.join(DEMO_BUILDER_ASSETS_DIR, "DemoBuilder");
    const result = await build(projRoot);

    expect(result).to.equal(false);
  });
});
