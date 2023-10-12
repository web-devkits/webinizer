/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ShowSuggestionAction, SuggestionExample } from "../src/actions/show_suggestion";
import { GetUserInputAction } from "../src/actions/get_user_input";
import { ShowDepRecipeAction } from "../src/actions/show_dep_recipe";
import { ConfigEnvChangeAction } from "../src/actions/config_env_change";
import { ConfigOptionChangeAction } from "../src/actions/config_option_change";
import { BuilderArgsChangeAction } from "../src/actions/args_change";
import { WEBINIZER_TEST_HOME } from "../src/constants";
import { Project } from "../src/project";
import { BuildStepChangeAction, BuildStepRegion } from "../src/actions/build_step_change";
import { FileChangeAction, FileChangeManager, FileRegion } from "../src/actions/file_change";
import fs from "graceful-fs";
import { backupFolderSync, deleteFolder, renameFolder } from "../src/helper";
import path from "path";
import { IAction, IBuilder } from "webinizer";

const TEST_ACTION_ASSETS_DIR = `${WEBINIZER_TEST_HOME}/assets/actions`;

describe("action", () => {
  before(() => {
    //Backup the "assets/actions" folder
    backupFolderSync(TEST_ACTION_ASSETS_DIR, `${WEBINIZER_TEST_HOME}/assets/.actions`);
  });

  after(() => {
    //Delete the older "assets/actions" and restore it from backup
    deleteFolder(TEST_ACTION_ASSETS_DIR);
    renameFolder(`${WEBINIZER_TEST_HOME}/assets/.actions`, TEST_ACTION_ASSETS_DIR);
  });

  it("BuilderArgsChangeActionTest", async () => {
    const proj = new Project(path.join(TEST_ACTION_ASSETS_DIR, "BuilderArgsChangeAction"));
    const action = new BuilderArgsChangeAction(
      proj,
      "",
      [{ option: "-msimd128", value: null, type: "merge" }],
      0,
      true
    );
    const result = await (action as IAction).apply();

    expect(result).to.equal(true);
    expect(
      (proj.config.getBuildConfigForTarget("static").builders as IBuilder[])[0].args[0]
    ).to.equal("-msimd128");
  });

  it("BuildStepChangeActionTest", async () => {
    const proj = new Project(path.join(TEST_ACTION_ASSETS_DIR, "BuildStepChangeAction"));
    const region = new BuildStepRegion(1);
    const newBuildSteps = [
      {
        __type__: "CMakeBuilder",
        id: 1,
        desc: "cmake",
        command: "emcmake cmake",
        args: "",
        rootBuildFilePath: "${projectRoot}",
      },
    ];
    const action = new BuildStepChangeAction(proj, "", region, newBuildSteps);
    const result = await (action as IAction).apply();

    expect(result).to.equal(true);
    expect((proj.config.getBuildConfigForTarget("static").builders as IBuilder[])[1].type).to.equal(
      "CMakeBuilder"
    );
  });

  it("ConfigEnvChangeActionTest", async () => {
    const proj = new Project(path.join(TEST_ACTION_ASSETS_DIR, "ConfigEnvChangeAction"));
    const action = new ConfigEnvChangeAction(proj, "", {
      cflags: [{ option: "-msimd128", value: null, type: "delete" }],
    });
    const result = await (action as IAction).apply();

    expect(result).to.equal(true);
    expect(proj.config.getBuildConfigForTarget("static").getEnv("cflags")).to.not.include(
      "-msimd128"
    );
    expect(proj.config.getOverallEnv("cflags")).to.not.include("-msimd128");
  });

  it("ConfigOptionChangeActionTest", async () => {
    const proj = new Project(path.join(TEST_ACTION_ASSETS_DIR, "ConfigOptionChangeAction"));
    const action = new ConfigOptionChangeAction(proj, "", { needMainLoop: false });
    const result = await (action as IAction).apply();

    expect(result).to.equal(true);
    expect(proj.config.getBuildConfigForTarget("static").getOption("needMainLoop")).to.equal(false);
  });

  it("FileChangeActionTest", async () => {
    const region = new FileRegion(
      path.join(TEST_ACTION_ASSETS_DIR, "FileChangeAction", "testfile"),
      0,
      0
    );
    const newContent = "Test line 1\nTest line 2";
    const action = new FileChangeAction(new FileChangeManager(), "", region, newContent);
    const result = await (action as IAction).apply();

    expect(result).to.equal(true);
    expect(fs.readFileSync(region.file, "utf-8")).to.include(newContent);
  });

  it("GetUserInputActionTest", async () => {
    const action = new GetUserInputAction();
    const result = await (action as IAction).apply();

    expect(result).to.equal(false);
  });

  it("ShowDepRecipeActionTest", async () => {
    const action = new ShowDepRecipeAction("Unit test for ShowDepRecipeAction", ["Dep1", "Dep2"]);
    const result = await (action as IAction).apply();

    expect(result).to.equal(true);
  });

  it("ShowSuggestionActionTest", async () => {
    const action = new ShowSuggestionAction(
      "error",
      "Unit test for ShowSuggestionAction",
      new SuggestionExample("ShowSuggestionAction Test", "Test ShowSuggestionAction"),
      null
    );
    const result = await (action as IAction).apply();

    expect(result).to.equal(true);
  });
});
