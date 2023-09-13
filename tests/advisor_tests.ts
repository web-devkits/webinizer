/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { advisorFactoryFromType } from "../src/advisor";
import { Project } from "../src/project";
import { ErrorAdviseRequest, PlainAdviseRequest } from "../src/advise_requests/common_requests";
import { Recipe } from "../src/recipe";
import { WEBINIZER_TEST_HOME } from "../src/constants";
import { FileLocation } from "../src/actions/file_change";
import { backupFolderSync, deleteFolder, renameFolder } from "../src/helper";
import path from "path";
import { IAdviseRequest, IAdviseResult, IAdvisor } from "webinizer";

const TEST_ADVISOR_ASSETS_DIR = `${WEBINIZER_TEST_HOME}/assets/advisors`;

async function advise(type: string, root: string, req: IAdviseRequest): Promise<IAdviseResult> {
  const advisor = advisorFactoryFromType(type)?.createAdvisor();
  const proj = new Project(root);
  expect(advisor).to.not.be.null;
  return (advisor as IAdvisor).advise(proj, req, []);
}

describe("advisor", () => {
  before(() => {
    //Backup the "assets/advisors" folder
    backupFolderSync(TEST_ADVISOR_ASSETS_DIR, `${WEBINIZER_TEST_HOME}/assets/.advisors`);
  });

  after(() => {
    //Delete the older "assets/advisors" and restore it from backup
    deleteFolder(TEST_ADVISOR_ASSETS_DIR);
    renameFolder(`${WEBINIZER_TEST_HOME}/assets/.advisors`, TEST_ADVISOR_ASSETS_DIR);
  });

  it("BuildNativeToolAdvisorTest", async () => {
    const errMsg = `./tinfo/MKcaptab.sh: 55: ./make_hash: Permission denied \n make[1]: Leaving directory '${WEBINIZER_TEST_HOME}/assets/advisors/BuildNativeToolAdvisor/'`;
    const req = new ErrorAdviseRequest("make", errMsg, null, 0);
    const actionDesc = `The build process needs to build some tools to generate some intermedium files. These tools should be \`native\` binaries. You need to adopt native compiler/tool-chain (such as \`gcc\`) to build these tools. Otherwise, emscripten-built tools cannot work and will interrupt the build process.`;
    const advisorType = "BuildNativeToolAdvisor";
    const projRoot = path.join(TEST_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.equal(actionDesc);
  });

  it("BuildPathValidateAdvisorTest", async () => {
    const req = new PlainAdviseRequest("pre-build", "");
    const actionDesc = "Below are the `invalid` paths we detected in project configuration:";
    const advisorType = "BuildPathValidateAdvisor";
    const projRoot = path.join(TEST_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.include(actionDesc);
  });

  it("BuildStepValidateAdvisorTest", async () => {
    const req = new PlainAdviseRequest("pre-build", "");
    const actionDesc = "Add a `make clean` step before `make` to ensure a clean build environment.";
    const advisorType = "BuildStepValidateAdvisor";
    const projRoot = path.join(TEST_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.include(actionDesc);
  });

  it("BuildTargetSpecifyAdvisorTest", async () => {
    const req = new ErrorAdviseRequest("cfg_args", "", null, 0);
    const actionDesc =
      "Please specify the build target as `32-bit` architecture while configuring the build, i.e., `x86_32`, `i686`, etc.";
    const advisorType = "BuildTargetSpecifyAdvisor";
    const projRoot = path.join(TEST_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.equal(actionDesc);
  });

  it("CCompilerAdvisorTest", async () => {
    const req = new ErrorAdviseRequest(
      "cfg_args",
      "C compiler test failed. gcc is unable to create an executable file",
      null,
      0
    );
    const actionDesc = `You're using \`gcc\` instead of \`emcc\`, which is a drop-in replacement for a standard compiler (like gcc or clang) to compile to WebAssembly. Please check if the build system has it hardcoded (i.e., cc_default="gcc"), or requires you to pass an option to specify \`emcc\` instead.`;
    const advisorType = "CCompilerAdvisor";
    const projRoot = path.join(TEST_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.equal(actionDesc);
  });

  it("CppExceptionAdvisorTest", async () => {
    const req = new PlainAdviseRequest("pre-build", "");
    const actionDesc =
      "We detected C++ exception used in codebase, but it's disabled in project configuration for building phase, which will disable exception catching. We recommend to enable `C++ exception` option if you want this feature.";
    const advisorType = "CppExceptionAdvisor";
    const projRoot = path.join(TEST_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.include(actionDesc);
  });

  it("DepBuildAdvisorTest", async () => {
    const req = new PlainAdviseRequest("dep-build", "DepBuildAdvisor Test");
    const actionDesc =
      "Recipes are generated for below dependent projects. Please go to the corresponding page of each dependent project for more details.";
    const advisorType = "DepBuildAdvisor";
    const projRoot = path.join(TEST_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.include(actionDesc);
  });

  it("DepCheckAdvisorTest", async () => {
    const req = new PlainAdviseRequest("pre-build", "");
    const actionDesc = "We detect that your project depends on below requiured packages:";
    const advisorType = "DepCheckAdvisor";
    const projRoot = path.join(TEST_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.include(actionDesc);
  });

  it("ErrorsNotHandledAdvisorTest", async () => {
    const req = new ErrorAdviseRequest("default", "", null, 0);
    const actionDesc =
      "This error is `not` handled by Webinizer, please try to resolve it manually";
    const advisorType = "ErrorsNotHandledAdvisor";
    const projRoot = path.join(TEST_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.include(actionDesc);
  });

  it("ExportNameAdvisorTest1", async () => {
    const req = new ErrorAdviseRequest("cfg_args", "", null, 0);
    const actionDesc =
      "Enable `Pthreads + MODULARIZE` currently require you to set `-sEXPORT_NAME=Something` to `Something != Module`.";
    const advisorType = "ExportNameAdvisor";
    const projRoot = path.join(TEST_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.include(actionDesc);
  });

  it("ExportNameAdvisorTest2", async () => {
    const req = new PlainAdviseRequest("pre-build", "");
    const actionDesc =
      "Enable `Pthreads + MODULARIZE` currently require you to set `-sEXPORT_NAME=Something` to `Something != Module`.";
    const advisorType = "ExportNameAdvisor";
    const projRoot = path.join(TEST_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.include(actionDesc);
  });

  it("FpmathAdvisorTest", async () => {
    const req = new ErrorAdviseRequest("cfg_args", "", null, 0);
    const actionDesc = "Please remove all related '-mfpmath' compiler flags in your project.";
    const advisorType = "FpmathAdvisor";
    const projRoot = path.join(TEST_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.equal(actionDesc);
  });

  it("HeaderMissingAdvisorTest", async () => {
    const errMsg = "fatal error: 'a.h' file not found\n";
    const req = new ErrorAdviseRequest("make", errMsg, null, 0);
    const actionDesc = "A header file is missing. There might be several reasons:";
    const advisorType = "HeaderMissingAdvisor";
    const projRoot = path.join(TEST_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.include(actionDesc);
  });

  it("InitialMemoryAdvisorTest", async () => {
    const errMsg = "initial memory too small";
    const req = new ErrorAdviseRequest("cfg_args", errMsg, null, 0);
    const actionDesc = "The initial amount of memory to use is too `small` for your application";
    const advisorType = "InitialMemoryAdvisor";
    const projRoot = path.join(TEST_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.include(actionDesc);
  });

  it("InlineAsmAdvisorTest", async () => {
    const errMsg = "in asm";
    const req = new ErrorAdviseRequest("cfg_args", errMsg, null, 0);
    const actionDesc =
      "Code with architecture-specific inline assembly (like an `asm()` containing x86 code) is not portable.";
    const advisorType = "InlineAsmAdvisor";
    const projRoot = path.join(TEST_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.include(actionDesc);
  });

  it("MainLoopAdvisorTest", async () => {
    const req = new PlainAdviseRequest("pre-build", "");
    const actionDesc = `Main loop implementation using Emscripten API is not detected. If you are using infinite loop in your application (i.e., for rendering / animation, etc.), please follow the example below to use [\`emscripten_set_main_loop()\`](https://emscripten.org/docs/api_reference/emscripten.h.html#c.emscripten_set_main_loop) API to modify. Otherwise, please click \`IGNORE\` to dismiss this recipe.`;
    const advisorType = "MainLoopAdvisor";
    const projRoot = path.join(TEST_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.include(actionDesc);
  });

  it("MakeTargetAdvisorTest", async () => {
    const errMsg = `make[3]: Entering directory '${WEBINIZER_TEST_HOME}/assets/advisors/MakeTargetAdvisor/docs'\nmake[3]: *** [gnuplot.gih] Error 126\n`;
    const req = new ErrorAdviseRequest("make", errMsg, null, 0);
    const actionDesc = `Please specify a build directory or target to avoid such unnecessary builds`;
    const advisorType = "MakeTargetAdvisor";
    const projRoot = path.join(TEST_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.include(actionDesc);
  });

  it("PThreadAdvisorTest", async () => {
    const req = new PlainAdviseRequest("pre-build", "");
    const actionDesc =
      "We detected pthread usage in codebase, but it's disabled in project configuration for building phase. We recommend to enable `Pthread` option if you want this feature.";
    const advisorType = "PThreadAdvisor";
    const projRoot = path.join(TEST_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.include(actionDesc);
  });

  it("RanlibAdvisorTest", async () => {
    const req = new ErrorAdviseRequest(
      "cfg_args",
      "wasm-ld: error: archive has no index; run ranlib to add one",
      null,
      0
    );
    const actionDesc = `You're using the system \`ranlib\` instead of \`emranlib\` (which calls llvm-ranlib).Please check if the build system has it hardcoded (i.e., ranlib_default="ranlib"), or requires you to pass an option to use \`emranlib\` instead.`;
    const advisorType = "RanlibAdvisor";
    const projRoot = path.join(TEST_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.equal(actionDesc);
  });

  it("SDLAdvisorTest1", async () => {
    const errMsg = 'not providing "FindSDL2.cmake"';
    const req = new ErrorAdviseRequest(
      "cmake",
      errMsg,
      new FileLocation("CMakeLists.txt", 0, 0),
      0
    );
    const actionDesc0 = `Remove \`find_package()\` statement for SDL2 from \`CMakeLists.txt\` at line`;
    const actionDesc1 = `Add related compiler and linker flags to use Emscripten ported \`SDL2\` library.`;
    const advisorType = "SDLAdvisor";
    const projRoot = path.join(TEST_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.include(actionDesc0);
    expect((result.recipe as Recipe).actions[1].desc).to.include(actionDesc1);
  });

  it("SDLAdvisorTest2", async () => {
    const errMsg = "Could NOT find SDL2_ttf";
    const req = new ErrorAdviseRequest(
      "cmake",
      errMsg,
      new FileLocation("CMakeLists.txt", 0, 0),
      0
    );
    const actionDesc0 = `Remove \`find_package()\` statement for \`SDL2_ttf\` from \`CMakeLists.txt\` at line`;
    const actionDesc1 = `Add related compiler and linker flags to use Emscripten ported \`SDL2_ttf\` library and preload \`font files\` if any.`;
    const advisorType = "SDLAdvisor";
    const projRoot = path.join(TEST_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.include(actionDesc0);
    expect((result.recipe as Recipe).actions[1].desc).to.include(actionDesc1);
  });

  it("SDLAdvisorTest3", async () => {
    const errMsg =
      "error: undefined symbol: SDL_acos (referenced by top-level compiled C/C++ code)";
    const req = new ErrorAdviseRequest(
      "cmake",
      errMsg,
      new FileLocation("CMakeLists.txt", 0, 0),
      0
    );
    const actionDesc = `Add related compiler and linker flags to use Emscripten ported \`SDL2\` library.`;
    const advisorType = "SDLAdvisor";
    const projRoot = path.join(TEST_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.include(actionDesc);
  });

  it("SDLAdvisorTest4", async () => {
    const errMsg =
      "error: undefined symbol: FT_Done_Face (referenced by top-level compiled C/C++ code)";
    const req = new ErrorAdviseRequest(
      "cmake",
      errMsg,
      new FileLocation("CMakeLists.txt", 0, 0),
      0
    );
    const actionDesc = `Add related compiler and linker flags to use Emscripten ported \`SDL2_ttf\` library and preload \`font files\` if any.`;
    const advisorType = "SDLAdvisor";
    const projRoot = path.join(TEST_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.include(actionDesc);
  });

  it("SimdAdvisorTest", async () => {
    const req = new ErrorAdviseRequest("cfg_args", "", null, 0);
    const actionDesc =
      "If you want to port `SIMD` code targeting WebAssembly, we should enable the `SIMD support` option.";
    const advisorType = "SimdAdvisor";
    const projRoot = path.join(TEST_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.include(actionDesc);
  });

  it("StripAdvisorTest", async () => {
    const errMsg = "strip: file format not recognized\n";
    const req = new ErrorAdviseRequest("cfg_args", errMsg, null, 0);
    const actionDesc =
      "Native tools such as `GNU strip` are not aware of the WebAssembly object format and cannot create archive indexes. Please disable strip if possible.";
    const advisorType = "StripAdvisor";
    const projRoot = path.join(TEST_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.include(actionDesc);
  });

  it("TemplateLiteralValidateAdvisorTest", async () => {
    const req = new PlainAdviseRequest("pre-build", "");
    const actionDesc =
      "Below are the `invalid` template literals we detected in project configuration:";
    const advisorType = "TemplateLiteralValidateAdvisor";
    const projRoot = path.join(TEST_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.include(actionDesc);
  });

  it("TestTargetErrorAdvisorTest", async () => {
    const errMsg = `emmake: error:\nLeaving directory: ${WEBINIZER_TEST_HOME}/assets/advisors/TestTargetErrorAdvisor/test`;
    const req = new ErrorAdviseRequest("make", errMsg, null, 0);
    const actionDesc =
      "Most test related targets are aimed to build&execute with native compiler/environment";
    const advisorType = "TestTargetErrorAdvisor";
    const projRoot = path.join(TEST_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.include(actionDesc);
  });

  it("X86AsmAdvisorTest", async () => {
    const errMsg = "nasm/yasm not found or too old.";
    const req = new ErrorAdviseRequest("cfg_args", errMsg, null, 0);
    const actionDesc = `Emscripten does \`not\` support \`x86 SIMD assembly\`, all code should be written to use SIMD intrinsic functions or compiler vector extensions. Otherwise it would need to be replaced with portable C or C++.\nSometimes a codebase will have both portable code and optional architectures-specific assembly as an optimization, so you might find an option to disable it (i.e., \`--disable-x86asm\`, \`--disable-asm\`).`;
    const advisorType = "X86AsmAdvisor";
    const projRoot = path.join(TEST_ADVISOR_ASSETS_DIR, advisorType);
    const result = await advise(advisorType, projRoot, req);

    expect(result.handled).to.equal(true);
    expect((result.recipe as Recipe).actions[0].desc).to.include(actionDesc);
  });
});
