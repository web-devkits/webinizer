/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

/**
 * Commonly shared constants
 */

import path from "path";

// define source file extensions based on emcc implementation
export const C_ENDINGS = [".c", ".i"];
export const CXX_ENDINGS = [
  ".cpp",
  ".cxx",
  ".cc",
  ".c++",
  ".CPP",
  ".CXX",
  ".C",
  ".CC",
  ".C++",
  ".ii",
];
export const HEADER_ENDINGS = [".h", ".hxx", ".hpp", ".hh", ".H", ".HXX", ".HPP", ".HH"];

// build directory for webinizer output
export const buildDir = "webinizer_build";

// dependent packages directory
export const dependencyDir = "webinizer_deps";

// root directory for project pool
export const projectPool = "/projects";

export const ALLOWED_UPLOADED_FILE_TYPE = ["application/x-zip-compressed"];

export const UPLOAD_PROJECT_REPO_PATH = "/webinizer/uploaded_proj";

export const WEBINIZER_HOME = "/webinizer/webinizer";
export const WEBINIZER_SRC_HOME = path.join(WEBINIZER_HOME, "src");
export const WEBINIZER_DIST_HOME =
  process.env.npm_lifecycle_event === "test"
    ? path.join(WEBINIZER_HOME, "src")
    : path.join(WEBINIZER_HOME, "dist");
export const WEBINIZER_TEST_HOME = path.join(WEBINIZER_HOME, "tests");

const builderPath = path.join(WEBINIZER_DIST_HOME, "builders");
const advisorPath = path.join(WEBINIZER_DIST_HOME, "advisors");
const actionPath = path.join(WEBINIZER_DIST_HOME, "actions");
const adviseRequestPath = path.join(WEBINIZER_DIST_HOME, "advise_requests");
const optionPath = path.join(WEBINIZER_DIST_HOME, "project_caches", "options");
export const moduleDirectories = [
  builderPath,
  advisorPath,
  actionPath,
  adviseRequestPath,
  optionPath,
];

export const EXTENSION_SRC_HOME = path.join(WEBINIZER_HOME, "extensions");
