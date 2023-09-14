/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { AdviseManager } from "../src/advisor";
import { Project } from "../src/project";
import { WEBINIZER_TEST_HOME } from "../src/constants";
import fs from "graceful-fs";
import path from "path";
import { backupFolderSync, deleteFolder, renameFolder } from "../src/helper";
import { IBuilder } from "webinizer";

const TEST_BUILDER_ASSETS_DIR = `${WEBINIZER_TEST_HOME}/assets/builders`;

async function build(root: string, target = "static"): Promise<boolean> {
  const proj = new Project(root);
  const builder = proj.config.getBuildConfigForTarget(target).builders?.[0];
  expect(builder).to.not.be.null;
  return (builder as IBuilder).build(new AdviseManager(proj));
}

describe("builder", () => {
  before(() => {
    //Backup the "assets/builders" folder
    backupFolderSync(TEST_BUILDER_ASSETS_DIR, `${WEBINIZER_TEST_HOME}/assets/.builders`);
  });

  after(() => {
    //Delete the older "assets/builders" and restore it from backup
    deleteFolder(TEST_BUILDER_ASSETS_DIR);
    renameFolder(`${WEBINIZER_TEST_HOME}/assets/.builders`, TEST_BUILDER_ASSETS_DIR);
  });

  it("CMakeBuilderTest", async () => {
    const projRoot = path.join(TEST_BUILDER_ASSETS_DIR, "CMakeBuilder");
    const result = await build(projRoot);

    expect(result).to.equal(true);
    expect(fs.existsSync(path.join(projRoot, "Makefile"))).to.equal(true);
  });

  it("ConfigureBuilderTest", async () => {
    const projRoot = path.join(TEST_BUILDER_ASSETS_DIR, "ConfigureBuilder");
    const result = await build(projRoot);

    expect(result).to.equal(true);
    expect(fs.existsSync(path.join(projRoot, "Makefile"))).to.equal(true);
  });

  it("EmccBuilderTest", async () => {
    const projRoot = path.join(TEST_BUILDER_ASSETS_DIR, "EmccBuilder");
    const result = await build(projRoot);

    expect(result).to.equal(true);
    expect(fs.existsSync(path.join(projRoot, "main.js"))).to.equal(true);
  });

  it("MakeBuilderTest", async () => {
    const projRoot = path.join(TEST_BUILDER_ASSETS_DIR, "MakeBuilder");
    const result = await build(projRoot);

    expect(result).to.equal(true);
    expect(fs.existsSync(path.join(projRoot, "main"))).to.equal(true);
  });

  it("NativeBuilderTest", async () => {
    const projRoot = path.join(TEST_BUILDER_ASSETS_DIR, "NativeBuilder");
    const result = await build(projRoot);

    expect(result).to.equal(true);
    expect(fs.existsSync(path.join(projRoot, "main"))).to.equal(true);
  });
});
