/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import {
  IAdviseRequest,
  IAdviseResult,
  IAdvisor,
  advisorFactoryFromType,
  Project as IProject,
  Recipe,
  ErrorAdviseRequest,
} from "webinizer";
import { expect } from "chai";
import path from "path";
import { backupFolderSync, deleteFolder, renameFolder } from "./utils";

const DEMO_ADVISOR_ASSETS_DIR = path.join(__dirname, "assets", "advisors");
async function advise(type: string, root: string, req: IAdviseRequest): Promise<IAdviseResult> {
  const advisor = advisorFactoryFromType(type)?.createAdvisor();
  const proj = new IProject(root);
  expect(advisor).to.not.be.null;
  return (advisor as IAdvisor).advise(proj, req, []);
}

describe("advisor", () => {
  before(() => {
    //Backup the "assets/advisors" folder
    backupFolderSync(DEMO_ADVISOR_ASSETS_DIR, path.join(__dirname, "assets", ".advisors"));
  });

  after(() => {
    //Delete the older "assets/advisors" and restore it from backup
    deleteFolder(DEMO_ADVISOR_ASSETS_DIR);
    renameFolder(path.join(__dirname, "assets", ".advisors"), DEMO_ADVISOR_ASSETS_DIR);
  });
  it("DemoAdvisorTest", async () => {
    const errMsg = "demo builder error";
    const req = new ErrorAdviseRequest("demo", errMsg, null, 0);
    const actionDesc = "Demo Advisor for Webinizer Extension Demo.";
    const advisorType = "DemoAdvisor";
    const projRoot = path.join(DEMO_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.equal(actionDesc);
  });
});
