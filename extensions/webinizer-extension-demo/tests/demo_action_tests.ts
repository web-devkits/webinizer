/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import * as webinizer from "webinizer";
import { expect } from "chai";
import path from "path";
import { backupFolderSync, deleteFolder, renameFolder } from "./utils";
import { DemoAction } from "../src/actions/demo_action";

const DEMO_ACTION_ASSETS_DIR = path.join(__dirname, "assets", "actions");

describe("action", () => {
  before(() => {
    //Backup the "assets/actions" folder
    backupFolderSync(DEMO_ACTION_ASSETS_DIR, path.join(__dirname, "assets", ".actions"));
  });

  after(() => {
    //Delete the older "assets/actions" and restore it from backup
    deleteFolder(DEMO_ACTION_ASSETS_DIR);
    renameFolder(path.join(__dirname, "assets", ".actions"), DEMO_ACTION_ASSETS_DIR);
  });

  it("DemoActionTest", async () => {
    const action = new DemoAction("Demo Action Test");
    const result = await (action as webinizer.IAction).apply();

    expect(result).to.equal(false);
  });
});
