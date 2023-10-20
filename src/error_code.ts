/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

/**
 * Webinizer Specific Error Code
 * @module
 */
const enum errorCode {
  /* Webinizer init */
  WEBINIZER_INIT_MODULE_DIR_LOAD_FAIL = "WEBINIZER_INIT_MODULE_DIR_LOAD_FAIL", //Module directory loading failed while webinizer initialization.
  WEBINIZER_INIT_MODULE_LOAD_FAIL = "WEBINIZER_INIT_MODULE_LOAD_FAIL", // Module file loading failed while webinizer initialization.
  WEBINIZER_INIT_MODULE_DIR_NOEXT = "WEBINIZER_INIT_MODULE_DIR_NOEXT", // Module dirctory does not exist while webinizer initialization.
  WEBINIZER_INIT_TOOLCHAIN_CHECK_FAIL = "WEBINIZER_INIT_TOOLCHAIN_CHECK_FAIL", // Required toolchain is not properly configured.

  /* Extension */
  WEBINIZER_EXT_HOME_DIR_LOAD_FAIL = "WEBINIZER_EXT_HOME_DIR_LOAD_FAIL", // Load extension home directory failed.
  WEBINIZER_EXT_DIR_LOAD_FAIL = "WEBINIZER_EXT_DIR_LOAD_FAIL", // Load extension directory failed.
  WEBINIZER_EXT_META_LOAD_FAIL = "WEBINIZER_EXT_META_LOAD_FAIL", // Load extension meta file failed.
  WEBINIZER_EXT_HOME_DIR_NOEXT = "WEBINIZER_EXT_HOME_DIR_NOEXT", // Extesion home directory does not exist.
  WEBINIZER_EXT_DIR_NOEXT = "WEBINIZER_EXT_DIR_NOEXT", // Extesion directory does not exist.
  WEBINIZER_EXT_META_NOEXT = "WEBINIZER_EXT_META_NOEXT", // Extension meta file does not exist.
  WEBINIZER_EXT_UNKNOWN = "WEBINIZER_EXT_UNKNOWN", // Unknown extension.

  /* Project Root */
  WEBINIZER_ROOT_EMPTY = "WEBINIZER_ROOT_EMPTY", // Project root is empty.
  WEBINIZER_ROOT_NOEXT = "WEBINIZER_ROOT_NOEXT", // Project root doesn't exist.
  WEBINIZER_ROOT_EXT = "WEBINIZER_ROOT_EXT", // Project root exists.
  /* File */
  WEBINIZER_FILE_UNSUPPORTED_ENCODING = "WEBINIZER_FILE_UNSUPPORTED_ENCODING", // The file is either binary or uses an unsupported text encoding.
  WEBINIZER_FILE_OUTSIDE_ROOT = "WEBINIZER_FILE_OUTSIDE_ROOT", // The file is outside the project root and cannot be accessed.
  WEBINIZER_FILE_READONLY = "WEBINIZER_FILE_READONLY", // The file is readonly.
  WEBINIZER_FILE_UNKNOWN_SYMBOLIC = "WEBINIZER_FILE_UNKNOWN_SYMBOLIC", // The file is symbolic link to an unknown file.
  WEBINIZER_FILE_EXT = "WEBINIZER_FILE_EXT", // The file already exists.
  WEBINIZER_FILE_NOEXT = "WEBINIZER_FILE_NOEXT", // The file doesn't exist.
  /* Directory */
  WEBINIZER_DIR_OUTSIDE_ROOT = "WEBINIZER_DIR_OUTSIDE_ROOT", // The directory is outside the project root and cannot be accessed.
  WEBINIZER_DIR_EXT = "WEBINIZER_DIR_EXT", // The directory already exists.
  WEBINIZER_DIR_NOEXT = "WEBINIZER_DIR_NOEXT", // The directory doesn't exist.
  WEBINIZER_DIR_COPY_FAIL = "WEBINIZER_DIR_COPY_FAIL", // Failed to copy a directory.
  WEBINIZER_DIR_DEL_FAIL = "WEBINIZER_DIR_DEL_FAIL", // Failed to delete a directory.
  WEBINIZER_DIR_MV_FAIL = "WEBINIZER_DIR_MV_FAIL", // Failed to rename a directory.
  /* Builder */
  WEBINIZER_BUILDER_UNDEFINED = "WEBINIZER_BUILDER_UNDEFINED", // No builders are defined yet for building.
  WEBINIZER_BUILDER_UNKNOWN = "WEBINIZER_BUILDER_UNKNOWN", // Unknown builder type.
  /* Advisor */
  WEBINIZER_ADVISOR_UNKNOWN = "WEBINIZER_ADVISOR_UNKNOWN", // Unknown advisor type.
  /* Advisor Pipeline */
  WEBINIZER_ADVISOR_PIPELINE_FILE_NOEXT = "WEBINIZER_ADVISOR_PIPELINE_FILE_NOEXT", // "advisor_pipelines.json" file does not exist.
  WEBINIZER_ADVISOR_PIPELINE_FILE_LOAD_FAIL = "WEBINIZER_ADVISOR_PIPELINE_FILE_LOAD_FAIL", // "advisor_pipelines.json" file loading failed.
  /* Actions */
  WEBINIZER_ACTION_FILE_INTERSECT = "WEBINIZER_ACTION_FILE_INTERSECT", // Lines are intersected in file change actions.
  WEBINIZER_ACTION_BUILDSTEP_INTERSECT = "WEBINIZER_ACTION_BUILDSTEP_INTERSECT", // Build step indexes are intersected in build step change actions.
  /* Build Config Fields */
  WEBINIZER_BUILD_OPTION_UNKNOWN = "WEBINIZER_BUILD_OPTION_UNKNOWN", // Unknown build option type.
  WEBINIZER_BUILD_CONFIG_UNKNOWN = "WEBINIZER_BUILD_CONFIG_UNKNOWN", // Unknown build config type.
  WEBINIZER_BUILD_CONFIG_GENERAL = "WEBINIZER_BUILD_CONFIG_GENERAL", // General errors from build config operations.
  /* Json Factory */
  WEBINIZER_JSONFACTORY_DUP_REG = "WEBINIZER_JSONFACTORY_DUP_REG", // Factory type has already registered.
  WEBINIZER_JSONFACTORY_DESERIALIZE_FAIL = "WEBINIZER_JSONFACTORY_DESERIALIZE_FAIL", // Fail to deserialize from Json object.
  /* Build Process */
  WEBINIZER_PROCESS_MULTI_BUILD = "WEBINIZER_PROCESS_MULTI_BUILD", // Multiple build at the same time is not allowed for the same project.
  WEBINIZER_PROCESS_UPDATE_UNDER_BUILD = "WEBINIZER_PROCESS_UPDATE_UNDER_BUILD", // Can't update configs and files when the project is under build.
  WEBINIZER_PROJ_INIT_FAIL = "WEBINIZER_PROJ_INIT_FAIL", //Initialize the project with git failed
  WEBINIZER_PROJ_GIT_CLONE_FAIL = "WEBINIZER_PROJ_GIT_CLONE_FAIL", //Clone the project with git failed
  WEBINIZER_PROJ_GIT_REPO_PATH_INVALID = "WEBINIZER_PROJ_GIT_REPO_PATH_INVALID", //The repo's path is invalid
  WEBINIZER_PROJ_PATH_INVALID = "WEBINIZER_PROJ_PATH_INVALID", //The path is invalid
  WEBINIZER_PROJ_PACKAGE_INVALID = " WEBINIZER_PROJ_PACKAGE_INVALID", // The upload project package does not meet requirement
  WEBINIZER_PROJ_TARGET_NOEXT = "WEBINIZER_PROJ_TARGET_NOEXT", // The project build target doesn't exist
  /* Metadata */
  WEBINIZER_META_UNDEFINED = "WEBINIZER_META_UNDEFINED", // Metadata file package.json is not defined
  WEBINIZER_META_PARSE_FAILED = "WEBINIZER_META_PARSE_FAILED", // Failed to parse the metadata json file
  WEBINIZER_META_FIELD_UNDEFINED = "WEBINIZER_META_FIELD_UNDEFINED", // Required metadata field is undefined
  WEBINIZER_META_SCHEMA_VALIDATION_FAILED = "WEBINIZER_META_SCHEMA_VALIDATION_FAILED", // Metadata failed to pass the schema validation
  /* Registry */
  WEBINIZER_REG_PKG_INVALID = "WEBINIZER_REG_PKG_INVALID", // The requested package is not found
  WEBINIZER_REG_VER_INVALID = "WEBINIZER_REG_VER_INVALID", // The requested package version is invalid
  WEBINIZER_REG_PUBLISH_FAIL = "WEBINIZER_REG_PUBLISH_FAIL", // Publish package failed
  WEBINIZER_REG_PACK_FAIL = "WEBINIZER_REG_PACK_FAIL", // Pack package failed
  WEBINIZER_REG_UNDEFINED = "WEBINIZER_REG_UNDEFINED", // Registry is not defined
  WEBINIZER_REG_ADDR_INVALID = "WEBINIZER_REG_ADDR_INVALID", // Registry address is invalid
  /* Package Manager */
  WEBINIZER_PM_VER_INVALID = "WEBINIZER_PM_VER_INVALID", // No valid version found for a package
  WEBINIZER_PM_VER_CONFLICT = "WEBINIZER_PM_VER_CONFLICT", // Resolving dependencie fail due to package version conflict
  WEBINIZER_PM_CIRCULAR_DEP = "WEBINIZER_PM_CIRCULAR_DEP", // Circular dependency is not allowed
  WEBINIZER_PM_PORT_CONFLICT = "WEBINIZER_PM_PORT_CONFLICT", // Different ports of the same native library is not allowed
  /* Default */
  WEBINIZER_DEFAULT = "WEBINIZER_DEFAULT", // Default error code.
}

export default errorCode;
