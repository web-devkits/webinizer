/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

/**
 * Webinizer Extension APIs
 */

export { loadAllModulesInDirectory, init } from "./init";

export { getLogger } from "./helper";

export { checkJsonType } from "./json_factory";

/**
 * Project
 */
export { Project } from "./project";

/**
 * Advisors
 */
export { AdviseManager, registerAdvisorFactory, advisorFactoryFromType } from "./advisor";

/**
 * Advise Request
 */
export { ErrorAdviseRequest, PlainAdviseRequest } from "./advise_requests/common_requests";

/**
 * Builders
 */
export { ALL_BUILDER_FACTORIES } from "./builder";

/**
 * Actions
 */
export { ALL_ACTION_FACTORIES } from "./action";
export { BuildStepChangeAction, BuildStepRegion } from "./actions/build_step_change";
export { FileChangeAction, FileLocation, FileRegion } from "./actions/file_change";
export { BuilderArgsChangeAction } from "./actions/args_change";
export { ConfigEnvChangeAction } from "./actions/config_env_change";
export { ConfigOptionChangeAction } from "./actions/config_option_change";
export { ShowSuggestionAction, SuggestionExample } from "./actions/show_suggestion";

/**
 * Recipe
 */
export { Recipe } from "./recipe";
