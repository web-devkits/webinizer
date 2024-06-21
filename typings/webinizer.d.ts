/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

declare module "webinizer" {
  /**
   * Initialize all the modules and extensions of webinizer.
   */
  export function init(): Promise<void>;

  /**
   * Initialize modules from directories.
   * @param dir The directory for modules to load from.
   */
  export function loadAllModulesInDirectory(dir: string): Promise<void>;

  /**
   * Create the logger object.
   *
   * @example
   * ```ts
   * const log = getLogger("demo");
   * log.info("This is a test for logger.");
   * ```
   *
   * @param category The name of the logger.
   * @returns The logging utilities.
   */
  export function getLogger(category: string): ILogger;

  /**
   * The logging utilities with different logging levels, a replacement for `console`.
   */
  export interface ILogger {
    debug(...args: any[]): void;
    /**
     * Log with the info level. Use this for basic logging.
     */
    info(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
  }

  /**
   * An object that manages project configurations and build process.
   */
  export class Project {
    /**
     * The absolute path to the project root.
     */
    readonly root: string;
    /**
     * The project config object.
     */
    readonly config: IProjectConfig;
    /**
     * The project log object.
     */
    readonly log: IProjectLog;
    /**
     * The file change manager object to manage all {@link FileChangeAction}.
     */
    readonly fileChangeManager: IFileChangeManager;
    /**
     * The build step change manager object to manage all {@link BuildStepChangeAction}.
     */
    readonly buildStepChangeManager: IBuildStepChangeManager;
    /**
     * Whether the project is a root project (`true`) or a dependency (`false`).
     */
    readonly isRootProject: boolean;
    /**
     * The available template literals constants.
     */
    readonly constant: Record<ProjectConstType, string>;

    /**
     * Create the `Project` object.
     * @param root The absolute path to the project root.
     * @param isRoot Whether the project is a root project (`true`) or a dependency (`false`).
     */
    constructor(root: string, isRoot?: boolean);

    /**
     * Get available template literals and corresponding value.
     * @param withMarkdown Whether format the output string in markdown format or not. The default value is false.
     * @returns The array of each template literal, in the format of `${projectRoot} = /path/tp/project/root`.
     */
    getTemplateLiterals(withMarkdown?: boolean): string[];
    /**
     * Get the actual value of a string containing template literals.
     * @param s The string that contains template literal.
     * @returns The string of actual value.
     */
    evalTemplateLiterals(s: string): string;
    /**
     * Validate the template literals in a string.
     * @param s The string that contains template literal.
     * @returns The array of invalid template literal.
     */
    validateTemplateLiterals(s: string): string[];

    /**
     * Backup the config files.
     */
    backupConfigFiles(): void;
    /**
     * Restore the config files.
     */
    restoreConfigsFromBackupFiles(): void;
    /**
     * Cleanup the backup config files.
     */
    cleanBackupFiles(): void;

    /**
     * Build the project.
     * @param res Recipes to apply to the build.
     * @returns Recipes generated in the build.
     */
    build(res: Recipe[] | null): Promise<Recipe[]>;
  }

  /**
   * The available template literals used in project configuration.
   *
   * - `projectDist`: represents the project distribution directory.
   * - `projectRoot`: represents the absolute project root path.
   * - `projectPool`: represents the project pool directory.
   */
  export type ProjectConstType = "projectDist" | "projectRoot" | "projectPool";

  /**
   * An object represents the project build log.
   */
  export interface IProjectLog extends IToJson {
    /**
     * Get the log content.
     * @returns The log content.
     */
    getContent(): string;
    /**
     * Update the log content.
     * @param content The content to be updated to the log file.
     */
    update(content: string): void;
  }

  /**
   * An object represents the project configs.
   */
  export interface IProjectConfig extends IToJson {
    /**
     * The absolute path to the config file.
     */
    readonly path: string;
    /**
     * A reference to the {@link Project} object.
     */
    readonly proj: Project;
    /**
     * The project name.
     */
    readonly name: string | undefined;
    /**
     * The project version.
     */
    readonly version: string | undefined;
    /**
     * The project description.
     */
    readonly desc: string | undefined;
    /**
     * The project icon.
     */
    readonly img: IProjectIcon | undefined;
    /**
     * The project keywords.
     */
    readonly keywords: string[] | undefined;
    /**
     * The project homepage address.
     */
    readonly homepage: string | undefined;
    /**
     * The project's issue tracker address.
     */
    readonly bugs: string | undefined;
    /**
     * The project license.
     */
    readonly license: string | undefined;
    /**
     * The project author.
     */
    readonly author: IProjectPerson | undefined;
    /**
     * The project repository address.
     */
    readonly repository: IProjectRepository | undefined;
    /**
     * The build target for the project. Currently we only support value `static` and `shared`.
     *
     * - `static` build target means to build your project with static linking. All dependent libraries will be built into
     *   Wasm archive files (.a), and then linked to the main project to get a standalone Wasm module with no external
     *   dependencies.
     *
     * - `shared` build target means to build your project with dynamic linking. All dependent libraries will be built into
     *   Wasm binary files (.wasm/.so) as side modules (using flag -sSIDE_MODULE), whose exports will be dynamically imported
     *   into the context of main project's Wasm module (using flag -sMAIN_MODULE) by JavaScript glue code.
     */
    readonly target: string | undefined;
    /**
     * Whether the project is a library or not (an application).
     */
    readonly isLibrary: boolean | undefined;
    /**
     * The overall environment variables (compiler flags and linker flags) aggregated from this project and its dependent project(s).
     */
    readonly overallEnvs: ProjectEnv | undefined;
    /**
     * The project raw dependencies, in the format of `{ foo: "^1.0.0" }`, represents the
     * `dependencies` field in the config.
     */
    readonly rawDependencies: { [k: string]: string } | undefined;
    /**
     * The packages that depends on this project, in the format of `{ foo: "^1.0.0" }`,
     * which denotes the opposite of `dependencies` field in the config.
     */
    readonly requiredBy: { [k: string]: string } | undefined;

    /**
     * Get a specific overall environment variable.
     * @param key The environment variable name.
     * @returns The value of this environment variable.
     */
    getOverallEnv(key: EnvType): string;
    /**
     * Get the `ProjectBuildConfig` object for a specific build target.
     * @param target The build target.
     * @returns The `ProjectBuildConfig` object for the target.
     */
    getBuildConfigForTarget(target: string | undefined): IProjectBuildConfig;

    /**
     * Update the overall environment variables value from the environment variables update of this project.
     * @param envs The environment variables of this project.
     */
    updateOverallEnvsFromSelf(envs: ProjectEnv | undefined): void;
    /**
     * Update the overall environment variables value from the dependent project(s).
     */
    updateOverallEnvsFromDeps(): Promise<void>;
    /**
     * Update the config file.
     * @param jsonParts The to be updated config fields and corresponding values.
     */
    updateRawJson(jsonParts: { [k: string]: unknown }): Promise<void>;

    /**
     * Conver the config file to the metadata file.
     */
    convertToRegMetaFromConfig(): void;
    /**
     * Convert the config file to the metadata file for publish. More fields are converted in this method
     * compared to those of {@link convertToRegMetaFromConfig}, such as `toolchain`, etc.
     */
    convertToRegMetaForPublish(): Promise<void>;
    /**
     * Convert the metadata file to the config file.
     * @param diffContent The metadata fields to be converted. The default value is the whole metadata fields
     * in `package.json`.
     */
    convertFromRegMeta(diffContent?: { [k: string]: unknown }): Promise<void>;
  }

  /**
   * The environment variables type.
   *
   * - `cflags` - the compiler flags.
   * - `ldflags` - the linker flags.
   */
  export type EnvType = "cflags" | "ldflags";
  /**
   * An object represents the project environment variables.
   */
  export type ProjectEnv = Record<EnvType, string>;

  /**
   * The package configuration properties.
   */
  export type PkgConfigType = "prefix" | EnvType;
  /**
   * An object represents the package configurations of a library project. Explainations for each property are:
   *
   * - `prefix`: The install prefix of the library.
   * - `cflags`: The compiler flags that will be acquired by the main project depending on this library to
   *   search for the header files (i.e., the `-I` options).
   * - `ldflags`: The linker flags that will be acquired by the main project depending on this library to
   *   search for and identify the library files (i.e., the `-L`, `-l` options).
   */
  export type ProjectPkgConfig = {
    [k in PkgConfigType]: string;
  };

  /**
   * An object represents the project icon.
   */
  export interface IProjectIcon {
    /**
     * Icon name.
     */
    name: string;
    /**
     * The flag whether this icon is uploaded.
     */
    isUploaded: boolean;
  }

  /**
   * An object represents a person.
   */
  export interface IProjectPerson {
    /**
     * Person name.
     */
    name: string;
    /**
     * Email address.
     */
    email?: string;
    /**
     * Peronal homepage address.
     */
    url?: string;
  }

  /**
   * An object represents the project repository.
   */
  export interface IProjectRepository {
    /**
     * Repository type, i.e., git.
     */
    type: string;
    /**
     * The URL to the project repository.
     */
    url: string;
  }

  /**
   * An object represents the project build options.
   */
  export interface IProjectBuildOptions {
    /**
     * Option for support on infinite main loop.
     */
    needMainLoop?: boolean;
    /**
     * Option for support on pthread.
     */
    needPthread?: boolean;
    /**
     * Options for support on C++ exception catching.
     */
    needCppException?: boolean;
    /**
     * Option for support on Wasm SIMD.
     */
    needSimd?: boolean;
    /**
     * Option for support on generating modularized JS glue code.
     */
    needModularize?: boolean;
  }
  /**
   * The build option type.
   */
  export type BuildOptionType = keyof IProjectBuildOptions;
  /**
   * Options for updating build config.
   */
  export interface IBuildConfigUpdateOptions {
    /**
     * The array of updated environment variable name. The default value is the
     * array contains all environment variable names `["cflags", "ldflags"]`.
     */
    updateEnvParts?: EnvType[];
    /**
     * The array of updated options name. The default value is the array contains
     * all options names.
     */
    updateOptParts?: BuildOptionType[];
    /**
     * Whether to refresh the build config based on the updated data or not after
     * updating the build config JSON data. The default is true to refresh.
     */
    refresh?: boolean;
  }

  /**
   * An object represents the build config for a build {@link IProjectConfig.target}.
   */
  export interface IProjectBuildConfig {
    /**
     * The build target that this `ProjectBuildConfig` object corresponding to.
     * Details for a build target is explained in {@link IProjectConfig.target}.
     */
    readonly target: string;
    /**
     * The `builders` field JSON data in config file.
     */
    readonly rawBuilders: IJsonObject[] | undefined;
    /**
     * The IBuilders object array created from the {@link rawBuilders}.
     */
    readonly builders: IBuilder[] | null;
    /**
     * A string array of file paths to preload.
     */
    readonly preloadFiles: string[] | undefined;
    /**
     * A string of exported native function names, separated by comma.
     */
    readonly exportedFuncs: string | undefined;
    /**
     * A string of exported runtime methods in JavaScript glue code from Emscripten,
     * separated by comma.
     */
    readonly exportedRuntimeMethods: string | undefined;
    /**
     * The environment variables object defined for build, containing keys `cflags`
     * and `ldflags`.
     */
    readonly envs: ProjectEnv | undefined;
    /**
     * The options object defined for build.
     */
    readonly rawOptions: IProjectBuildOptions | null;
    /**
     * The disabled advisors object. The key should be a advisor type {@link IAdvisor.type}, the value `true`
     * means the corresponding advisor is disabled.
     */
    disabledAdvisors: { [k: string]: boolean } | null;
    /**
     * The package configurations of the project. This field must be defined for a library project.
     */
    pkgConfig: ProjectPkgConfig | undefined;

    /**
     * Get a environment variable value.
     * @param key The environment variable name.
     * @returns The environment variable value.
     */
    getEnv(key: EnvType): string;
    /**
     * Get an option value
     * @param key The option name.
     * @returns The option value.
     */
    getOption(key: BuildOptionType): boolean | undefined;
    /**
     * Get a disabled advisor value.
     * @param key The advisor name.
     * @returns The status of the advisor. True means `disabled` and vise versa.
     */
    getDisabledAdvisorFlag<T>(key: string): T | undefined;
    /**
     * Set a disabled advisor value.
     * @param key The advisor name.
     * @param value The status of the advisor to set. True means `disabled` and vise versa.
     */
    setDisabledAdvisorFlag<T>(key: string, value: T): void;
    /**
     * Reset the status of all the advisors to `enable`.
     */
    resetAdvisors(): void;
    /**
     * Get a package configuration value.
     * @param key The package configuration name.
     * @returns The package configuration value.
     */
    getPkgConfigEnv(key: PkgConfigType): string;
    /**
     * Set a package configuration value.
     * @param key The package configuration name.
     * @param value The package configuration value to set.
     */
    setPkgConfigEnv(key: PkgConfigType, value: string): void;
    /**
     * Update the build config data. This is the general entry for all config related updates.
     *
     * @param jsonParts The to be updated config data.
     * @param options The update options.
     */
    updateBuildConfig(
      jsonParts: { [k: string]: unknown },
      options?: IBuildConfigUpdateOptions
    ): void;
    /**
     * Reset the build config data to default.
     */
    resetBuildConfig(): void;

    /**
     * Convert the build config data to metadata format.
     *
     * @param convertParts The array of the fields to be converted. The default value
     * is `["envs", "builders", "pkgConfig"]` which converts all the related fields.
     */
    convertBuildTargetToMeta(convertParts?: ("envs" | "builders" | "pkgConfig")[]): void;
  }

  /**
   * An object represents a recipe from Webinizer.
   */
  export class Recipe {
    /**
     * Create a `Recipe` object.
     * @param proj The Project instance.
     * @param desc The description of the recipe.
     * @param advisor The advisor that generates this recipe.
     * @param requests The requests that generate this recipe.
     * @param actions The actions provided by this recipe.
     * @param showNoAdvisor Whether we can dismiss the recipe from the advisor. The default is false.
     */
    constructor(
      proj: Project,
      desc: string,
      advisor: IAdvisor,
      requests: IAdviseRequest | IAdviseRequest[],
      actions: IAction | IAction[],
      showNoAdvisor?: boolean
    );
    /**
     * The Project instance.
     */
    readonly proj: Project;
    /**
     * The description of the recipe.
     */
    readonly desc: string;
    /**
     * The advisor that generates this recipe.
     */
    readonly advisor: IAdvisor;
    /**
     * The requests that generate this recipe.
     */
    readonly requests: IAdviseRequest[];
    /**
     * The actions provided by this recipe.
     */
    readonly actions: IAction[];
    /**
     * Whether we can dismiss the recipe from the advisor. The default is false.
     */
    readonly showNoAdvisor: boolean;

    /**
     * Apply the recipe.
     * @returns Whether the recipe is applied successfully or not.
     */
    apply(): Promise<boolean>;
    /**
     * Convert the recipe to a plain JSON object.
     * @returns A plain JSON object represents this recipe.
     */
    toJson(): IJsonObject;
  }

  /**
   * An object represents the Builder creation options.
   */
  export interface IBuilderOptions {
    /**
     * The overall arguments string of the builder.
     */
    args?: string;
    /**
     * The working directory of the builder.
     */
    rootBuildFilePath?: string;
  }

  /**
   * An object represents the JSON object of a Builder.
   */
  export interface IBuilderJson extends IJsonObject {
    /**
     * The builder ID. This is the same as the index of the builder in a builder array and
     * is a unique identifier for builders in a single Project.
     */
    id: number;
    /**
     * The description of the builder.
     */
    desc: string;
    /**
     * The pre-defined command of the builder, used for build.
     */
    command: string;
    /**
     * The overall arguments string of the builder.
     */
    args: string;
    /**
     * The working directory of the builder.
     */
    rootBuildFilePath: string;
  }

  /**
   * An object represents a Builder. A builder contains all the information needed to run a build command.
   */
  export interface IBuilder extends IToJson {
    /**
     * The type of the Builder. This should be the same as the class name of the builder.
     */
    type: string;
    /**
     * The description of the builder.
     */
    desc: string;
    /**
     * The pre-defined command of the builder, used for build.
     */
    command: string;
    /**
     * The arguments array of the builder. Each element in the array is a argument.
     */
    args: string[];
    /**
     * The builder ID. This is the same as the index of the builder in a builder array and
     * is a unique identifier for builders in a single Project.
     */
    id: number;
    /**
     * Run the build command defined by the builder.
     * @param adviseManager The advise manager object.
     * @returns Whether the build command is ran successfully.
     */
    build(adviseManager: AdviseManager): Promise<boolean>;
    /**
     * Convert the builder object to a plain JSON object.
     * @returns The JSON object of the builder.
     */
    toJson(): IBuilderJson;
  }

  /**
   * An object represent a builder factory.
   */
  export interface IBuilderFactory extends IFromJson<IBuilder> {
    /**
     * The name of the builder factory.
     */
    name: string;
    /**
     * The description of the builder factory.
     */
    desc: string;
    /**
     * Detect a builder to use for the project.
     * @param proj The project instance.
     * @returns The detected builder or null (no builder detected).
     */
    detect(proj: Project): IBuilder | null;
    /**
     * Create a default builder object from the factory.
     * @param proj The project instance.
     * @param options The options to create a builder object.
     * @returns A builder object.
     */
    createDefault(proj: Project, options?: IBuilderOptions): IBuilder;
  }

  /**
   * An object contains all the builder factories.
   */
  export const ALL_BUILDER_FACTORIES: IJsonFactories<IBuilder, IBuilderFactory>;

  /**
   * Check if all the previous builders run native build commands.
   * @param proj The project instance.
   * @param idx The builder idx to check.
   * @returns `true` if all the previous builders run native build commands.
   */
  export function isPrevBuildersAllNative(proj: Project, idx: number): boolean;
  /**
   * Find the first builder with type `builder` in the poject's builders array.
   * @param proj The Project instance.
   * @param builder The builder type ({@link IBuilder.type}) string.
   * @returns The builder index if found one. `-1` means not found.
   */
  export function findFirstBuilder(proj: Project, builder: string): number;

  /**
   * An object represents an advise request.
   */
  export interface IAdviseRequest extends IToJson {
    /**
     * The tags array of the request.
     */
    tags: string[];
  }

  /**
   * An object represents the advise request.
   */
  export interface IAdviseResult {
    /**
     * Whether this request is handled by advisors or not.
     */
    handled: boolean;
    /**
     * The recipe generated by advisors.
     */
    recipe?: Recipe;
    /**
     * Whether continues to ask other advisors to handle this request or not.
     */
    needPropagation?: boolean;
    /**
     * Whether needs to replace the current request queue with it if defined.
     */
    newRequestQueue?: IAdviseRequest[];
  }

  /**
   * An object represents an advisor.
   */
  export interface IAdvisor {
    /**
     * The type of the advisor. This should be the same as the advisor class name.
     */
    type: string;
    /**
     * The description of the advisor.
     */
    desc: string;
    /**
     * Advise on the request.
     * @param proj The project instance.
     * @param req The request that needs to be advised.
     * @param requestList The queued request list.
     * @returns The advise result object.
     */
    advise(
      proj: Project,
      req: IAdviseRequest,
      requestList: ReadonlyArray<IAdviseRequest>
    ): Promise<IAdviseResult>;
  }

  /**
   * An object represents advisor factory.
   */
  export interface IAdvisorFactory {
    /**
     * Name of the advisor factory.
     */
    name: string;
    /**
     * The description of the advisor factory.
     */
    desc: string;
    /**
     * Create advisor object from the factory.
     * @param args The arguments used to create the advisor object.
     */
    createAdvisor(args?: string): IAdvisor;
  }

  /**
   * An object that manages advise requests and generate recipes.
   */
  export class AdviseManager {
    /**
     * The project instance.
     */
    readonly proj: Project;
    /**
     * Create an `AdviseManager` object.
     * @param proj the project instance.
     */
    constructor(proj: Project);
    /**
     * Queue the request to the request list.
     * @param req the request to be queued.
     */
    queueRequest(req: IAdviseRequest): void;
    /**
     * Advise on the request.
     * @returns The recipes generated for all the requests.
     */
    advise(): Promise<Recipe[]>;
  }

  /**
   * Register an advisor factory.
   * @param type The type of the advisor.
   * @param factory The factory object of the advisor.
   */
  export function registerAdvisorFactory(type: string, factory: IAdvisorFactory): void;
  /**
   * Get an advisor factory object with `type`.
   * @param type The type of the advisor.
   * @returns The advisor factory object. `null` if the advisor factory is not available.
   */
  export function advisorFactoryFromType(type: string): IAdvisorFactory | null;

  /**
   * Represents an request generated from build errors.
   */
  export class ErrorAdviseRequest implements IAdviseRequest {
    /**
     * Create an `ErrorAdviseRequest` object.
     * @param tags The tags of the request.
     * @param error The error messages.
     * @param location The file location for the error.
     * @param builderID The ID of the builder that generates the request.
     */
    constructor(
      tags: string | string[],
      error: string,
      location: FileLocation | null,
      builderID: number
    );

    /**
     * The tags array of the request.
     */
    readonly tags: string[];
    /**
     * The error messages.
     */
    readonly error: string;
    /**
     * The file location for the error.
     */
    readonly location: FileLocation | null;
    /**
     * The ID of the builder that generates the request.
     */
    readonly builderID: number;

    /**
     * Convert the request to a plain JSON object.
     */
    toJson(): IJsonObject;
    /**
     * Create a request object from a plain JSON object.
     * @param proj The project instance.
     * @param o The plain JSON object.
     * @returns A created `ErrorAdviseRequest` object.
     */
    static fromJson(proj: Project, o: IJsonObject): ErrorAdviseRequest;
  }

  /**
   * Represents other requests with plain JSON data.
   */
  export class PlainAdviseRequest implements IAdviseRequest {
    /**
     * Create a `PlainAdviseRequest` object.
     * @param tags The tags of the request.
     * @param plainData The request data.
     */
    constructor(tags: string | string[], plainData: unknown);

    /**
     * The tags array of the request.
     */
    readonly tags: string[];
    /**
     * The request data itself is a kind of JSON so easy to fromJson() and toJson().
     */
    readonly plainData: unknown;

    /**
     * Convert the request to a plain JSON object.
     */
    toJson(): IJsonObject;
    /**
     * Create a request object from a JSON object.
     * @param proj The project instance.
     * @param o The plain JSON object.
     * @returns A created `PlainAdviseRequest` object.
     */
    static fromJson(proj: Project, o: IJsonObject): PlainAdviseRequest;
  }

  /**
   * An object represents a plain JSON object.
   */
  export interface IJsonObject {
    /**
     * This should be the class name that this JSON object is converted from.
     */
    __type__: string;
    [key: string]: unknown;
  }

  /**
   * Check the JSON object type.
   * @param type The type to be checked.
   * @param o The JSON object to be checked.
   */
  export function checkJsonType(type: string, o: IJsonObject): void;

  /**
   * An object that can be converted to a plain JSON object (`IJsonObject`).
   */
  export interface IToJson {
    toJson(): IJsonObject;
  }

  /**
   * An object that can be converted from a plain JSON object (`IJsonObject`).
   */
  export interface IFromJson<T> {
    fromJson: FromJsonMethod<T>;
  }

  /**
   * Represents the function type of a `fromJson` method.
   * The JSON itself only contains static informaiton, but the object to restore
   * may need to contain the current content where proj is the root of all such
   * context (session) informaiton, so we need it for deserialization too.
   */
  export type FromJsonMethod<T> = (proj: Project, o: IJsonObject, index: number) => T | null;

  /**
   * A template class for Json Factories.
   */
  export interface IJsonFactories<
    T,
    X extends IFromJson<T> | FromJsonMethod<T> = IFromJson<T> | FromJsonMethod<T>
  > {
    /**
     * The name of the factories.
     */
    readonly name: string;

    /**
     * Create the factory from JSON object.
     * @param proj The project instance.
     * @param o The plain JSON object.
     * @param index The index of the JSON object in an array.
     * @returns The factory converted from JSON object.
     */
    fromJson(proj: Project, o: IJsonObject, index: number): T | null;
    /**
     * Register a factory or method to the Json factories map.
     * @param type The type of the factory or `fromJson` method.
     * @param method_or_factory The factory object of the `fromJson` method for the `type`.
     */
    register(type: string, method_or_factory: X): void;
    /**
     * Get the factories map.
     */
    factoriesMap(): Map<string, X>;
    /**
     * Create an array of objects from an array of JSON objects.
     * @param proj The project instance.
     * @param arr The array of JSON objects.
     */
    fromJsonArray(proj: Project, arr: IJsonObject[]): T[];
  }

  /**
   * An object represents an action.
   */
  export interface IAction extends IToJson {
    /**
     * The type of the action. This should be the same as the actual action class name.
     */
    type: string;
    /**
     * The description of the action.
     */
    desc: string;
    /**
     * Apply the action.
     * @returns Whether the action is applied successfully or not.
     */
    apply(): Promise<boolean>;
  }

  /**
   * An object contains all the action factories, used to create an new action object.
   */
  export const ALL_ACTION_FACTORIES: IJsonFactories<IAction>;

  /**
   * File change action - An action to change the file content
   */
  export class FileChangeAction implements IAction {
    /**
     * Create a `FileChangeAction`.
     * @param manager The `FileChangeManager` object. This should be passed from Project object as
     * {@link Project.fileChangeManager} rather than `new` one here.
     * @param desc The action decription.
     * @param region The file region to change.
     * @param content The file content to change.
     */
    constructor(
      manager: IFileChangeManager,
      desc: string,
      region: FileRegion,
      content: string | null
    );

    /**
     * The type of the action. This should be the same as class name `FileChangeAction`.
     */
    readonly type: string;
    /**
     * The `FileChangeManager` object of this project.
     */
    readonly manager: IFileChangeManager;
    /**
     * The description of the action.
     */
    readonly desc: string;
    /**
     * The file region to be changed.
     */
    readonly region: FileRegion;
    /**
     * The new content to be updated to the file `region`.
     */
    readonly newContent: string | null;
    /**
     * The number of lines of the `newContent`.
     */
    readonly nLinesNewContent: number;

    /**
     * Apply the action.
     * @returns Whether the action is applied successfully or not.
     */
    apply(): Promise<boolean>;
    /**
     * Convert this action to JSON object.
     * @returns The serialized JSON object of this action.
     */
    toJson(): IJsonObject;
    /**
     * Create this action from a JSON object.
     * @param proj The project instance.
     * @param o The JSON data of this action.
     * @returns The action object deserialized from a JSON object.
     */
    static fromJson(proj: Project, o: IJsonObject): FileChangeAction;
  }

  /**
   * An object represents the content location in a file.
   */
  export class FileLocation {
    /**
     * Create a `FileLocation` object.
     * @param file The absolute path to the file.
     * @param line The line number in the file.
     * @param col The column number in the file.
     */
    constructor(file: string, line: number, col: number);

    /**
     * The absolute path to the file.
     */
    readonly file: string;
    /**
     * The line number in the file.
     */
    readonly line: number;
    /**
     * The column number in the file.
     */
    readonly col: number;

    /**
     * Convert the `FileLocation` object to a plain JSON object.
     * @returns The plain JSON object.
     */
    toJson(): IJsonObject;
    /**
     * Convert the plain JSON object to a `FileLocation` object.
     * @param o The JSON object.
     * @returns The converted `FileLocation` object.
     */
    static fromJson(o: IJsonObject): FileRegion;
    /**
     * Convert this `FileLocation` object to a `FileRegion` object.
     * @returns A `FileRegion` object.
     */
    toFileRegion(): FileRegion;
  }

  /**
   * An object represents a region of lines in the file.
   */
  export class FileRegion {
    /**
     * Create a `FileRegion` object, representing the line region as [LineStart, LineEnd), 0 indexed
     * @param file The absolute path to the file.
     * @param lineStart The start of the region, 0 indexed.
     * @param lineEnd The end of the region. The default value is "{@link lineStart} + 1".
     */
    constructor(file: string, lineStart: number, lineEnd?: number);

    /**
     * The absolute path to the file.
     */
    readonly file: string;
    /**
     * The start line index of the region, 0 indexed.
     */
    readonly lineStart: number;
    /**
     * The end of the region.
     */
    readonly lineEnd: number;

    /**
     * Convert the `FileRegion` object to a plain JSON object.
     * @returns The plain JSON object.
     */
    toJson(): IJsonObject;
    /**
     * Convert the plain JSON object to a `FileRegion` object.
     * @param o The JSON object.
     * @returns The converted `FileRegion` object.
     */
    // isIntersected(r: FileRegion): boolean;
    /**
     * Lines change change if some region in this file is changed
     * @param r The region changed
     * @param nNewLines Number of lines after changed that region
     * @returns number of lines to change
     */
    linesToAdjust(r: FileRegion, nNewLines: number): number;
  }

  /**
   * The FileChangeManager object that coordinates all `FileChangeAction`s applied to one file to
   * ensure all histories is all tracked and managed.
   */
  export interface IFileChangeManager {
    /**
     * Apply the action.
     * @param action The action to be applied.
     * @returns Whether the action is applied successfully or not.
     */
    apply(action: FileChangeAction): Promise<boolean>;
  }

  /**
   * A string represents the args change action type. For a typical argment
   * `--x=y` to be changed:
   *
   * - `replace` - replace the existed value of `--x` option to `y`.
   * - `merge` - merge the existed value of `--x` option with `y`. If no `--x`
   *   option existed before, `replace` and `merge` have the same meaning.
   * - `delete` - delete the first `--x` option.
   * - `deleteAll` - delete all the `--x` options.
   */
  export type ActionType = "replace" | "merge" | "delete" | "deleteAll";

  /**
   * An object represents an build argument (i.e., `--x=y`).
   */
  export interface IArg {
    /**
     * The option name (`x`).
     */
    option: string;
    /**
     * The value of the option (`y`).
     */
    value: string | null;
    /**
     * The arg change action type.
     */
    type: ActionType;
  }

  /**
   * Build step args change action - An action to change the build step arguments
   */
  export class BuilderArgsChangeAction implements IAction {
    /**
     * Create a `BuilderArgsChangeAction`
     * @param proj The Project instance.
     * @param desc The action description.
     * @param args The argument(s) to be updated.
     * @param builderID The builder to be updated with the `args`.
     * @param refresh Whether refresh the cache of the builders or not when applying this action.
     */
    constructor(proj: Project, desc: string, args: IArg[], builderID: number, refresh: boolean);

    /**
     * The type of the action. This should be the same as class name `BuilderArgsChangeAction`.
     */
    readonly type: string;
    /**
     * The project instance.
     */
    readonly proj: Project;
    /**
     * The description of the action.
     */
    readonly desc: string;
    /**
     * The argument(s) to be updated.
     */
    readonly args: IArg[];
    /**
     * The builder ID that is to be updated with `args`.
     */
    readonly builderID: number;
    /**
     * Whether to refresh the cache of the builders or not. The default is true.
     */
    readonly refresh: boolean;

    /**
     * Apply the action.
     * @returns Whether the action is applied successfully or not.
     */
    apply(): Promise<boolean>;
    /**
     * Convert this action to JSON object.
     * @returns The serialized JSON object of this action.
     */
    toJson(): IJsonObject;
    /**
     * Create this action from a JSON object.
     * @param proj The project instance.
     * @param o The JSON data of this action.
     * @returns The action object deserialized from a JSON object.
     */
    static fromJson(proj: Project, o: IJsonObject): BuilderArgsChangeAction;
  }

  /**
   * An object represents a region/index range of build steps.
   */
  export class BuildStepRegion {
    /**
     * Create a `BuildStepRegion` object represents the region [iStart, iEnd),
     * 0 indexed.
     * @param iStart Start of the region, 0 indexed.
     * @param iEnd End of the region. The default value is the same as `iStart`.
     */
    constructor(iStart: number, iEnd?: number);

    /**
     * The start index of the region.
     */
    readonly iStart: number;
    /**
     * The end index of the region.
     */
    readonly iEnd: number;

    /**
     * Serialize to JSON object.
     * @returns An JSON object of this `BuildStepRegion`.
     */
    toJson(): IJsonObject;
    /**
     * Create the `BuildStepRegion` from a JSON object.
     * @param o The JSON object
     * @returns The object deserialized from JSON data.
     */
    static fromJson(o: IJsonObject): BuildStepRegion;

    // isIntersected(r: BuildStepRegion): boolean;
    /**
     * Calculate the index to be changed if some build steps are changed previously.
     * @param r The region that is changed previously.
     * @param nNewSteps Number of build steps to be changed.
     * @returns Indexes shift for this change.
     */
    indexesToAdjust(r: BuildStepRegion, nNewSteps: number): number;
  }

  /**
   * Build step change action - An action to change the build steps.
   */
  export class BuildStepChangeAction implements IAction {
    /**
     * Create a `BuildStepChangeAction`.
     * @param proj The project instance.
     * @param desc The action description.
     * @param region The build step region to be changed.
     * @param newBuildSteps The new build steps to change.
     */
    constructor(
      proj: Project,
      desc: string,
      region: BuildStepRegion,
      newBuildSteps: IBuilderJson[] | null
    );

    /**
     * The type of the action. This should be the same as the class name `BuildStepChangeAction`.
     */
    readonly type: string;
    /**
     * The project instance.
     */
    readonly proj: Project;
    /**
     * The description of the action.
     */
    readonly desc: string;
    /**
     * The build step region to be changed.
     */
    readonly region: BuildStepRegion;
    /**
     * The new buile step(s) to be changed to.
     */
    readonly newBuildSteps: IBuilderJson[];
    /**
     * The number of the new build step(s).
     */
    readonly nNewSteps: number;

    /**
     * Apply the action.
     * @returns Whether the action is applied successfully or not.
     */
    apply(): Promise<boolean>;
    /**
     * Convert this action to JSON object.
     * @returns The serialized JSON object of this action.
     */
    toJson(): IJsonObject;
    /**
     * Create this action from a JSON object.
     * @param proj The project instance.
     * @param o The JSON data of thie action.
     * @returns The action object deserialized from a JSON object.
     */
    static fromJson(proj: Project, o: IJsonObject): BuildStepChangeAction;
    /**
     * Calculate the actual build step region to apply the action.
     * @param changes All the previously applied actions.
     * @returns The actual build step region to apply the action.
     */
    actualBuildStepRegion(changes: BuildStepChangeAction[]): BuildStepRegion | null;
  }

  export interface IBuildStepChangeManager {
    /**
     * Apply the action.
     * @param action The action to be applied.
     * @returns Whether the action is applied successfully or not.
     */
    apply(action: BuildStepChangeAction): Promise<boolean>;
  }

  /**
   * Config env change action - An action to change the project compiler and linker flags.
   */
  export class ConfigEnvChangeAction implements IAction {
    /**
     * Create a `ConfigEnvChangeAction`.
     * @param proj the Project object
     * @param desc action description
     * @param partToUpdate the envs args to be updated
     */
    constructor(proj: Project, desc: string, partToUpdate: Partial<Record<EnvType, IArg[]>>);

    /**
     * The type of the action. This should be the same as the class name `ConfigEnvChangeAction`.
     */
    readonly type: string;
    /**
     * The project instance.
     */
    readonly proj: Project;
    /**
     * The description of the action.
     */
    readonly desc: string;
    /**
     * The new args to be updated in project config envs.
     */
    readonly partToUpdate: Partial<Record<EnvType, IArg[]>>;

    /**
     * Apply the action.
     * @returns Whether the action is applied successfully or not.
     */
    apply(): Promise<boolean>;
    /**
     * Convert this action to JSON object.
     * @returns The serialized JSON object of this action.
     */
    toJson(): IJsonObject;
    /**
     * Create this action from a JSON object.
     * @param proj The project instance.
     * @param o The JSON data of thie action.
     * @returns The action object deserialized from a JSON object.
     */
    static fromJson(proj: Project, o: IJsonObject): ConfigEnvChangeAction;
  }

  /**
   * Config option change action - An action to change the project config options
   */
  export class ConfigOptionChangeAction implements IAction {
    /**
     * Create a `ConfigOptionChangeAction`
     * @param proj The Project instance.
     * @param desc The action description.
     * @param partToUpdate The the config part to be updated.
     */
    constructor(proj: Project, desc: string, partToUpdate: { [k in string]: boolean });

    /**
     * The type of the action. This should be the same as the class name `ConfigOptionChangeAction`.
     */
    readonly type: string;
    /**
     * The project instance.
     */
    readonly proj: Project;
    /**
     * The description of the action.
     */
    readonly desc: string;
    /**
     * The new options object to be updated in project config options.
     */
    readonly partToUpdate: { [k in string]: boolean };

    /**
     * Apply the action.
     * @returns Whether the action is applied successfully or not.
     */
    apply(): Promise<boolean>;
    /**
     * Convert this action to JSON object.
     * @returns The serialized JSON object of this action.
     */
    toJson(): IJsonObject;
    /**
     * Create this action from a JSON object.
     * @param proj The project instance.
     * @param o The JSON data of thie action.
     * @returns The action object deserialized from a JSON object.
     */
    static fromJson(proj: Project, o: IJsonObject): ConfigOptionChangeAction;
  }

  /**
   * Show suggestion action - An action to show suggestion to user
   */
  export class ShowSuggestionAction implements IAction {
    /**
     * Create a `ShowSuggestionAction`.
     * @param init The initiator of the suggestion.
     * @param desc The action description.
     * @param suggestion The suggestion example.
     * @param region The file region related with the suggestion.
     */
    constructor(
      init: SuggestionInitiator,
      desc: string,
      suggestion: SuggestionExample | null,
      region: FileRegion | null
    );

    /**
     * The type of the action. This should be the same as the class name `ShowSuggestionAction`.
     */
    readonly type: string;
    /**
     * The initiator of this action, generated from `error` messages or project config `option` check.
     */
    readonly initiator: SuggestionInitiator;
    /**
     * The description of the action.
     */
    readonly desc: string;
    /**
     * The suggestion example.
     */
    readonly suggestion: SuggestionExample | null;
    /**
     * The file region related with the suggestion.
     */
    readonly region: FileRegion | null;

    /**
     * Apply the action.
     * @returns Whether the action is applied successfully or not.
     */
    apply(): Promise<boolean>;
    /**
     * Convert this action to JSON object.
     * @returns The serialized JSON object of this action.
     */
    toJson(): IJsonObject;
    /**
     * Create this action from a JSON object.
     * @param proj The project instance.
     * @param o The JSON data of thie action.
     * @returns The action object deserialized from a JSON object.
     */
    static fromJson(proj: Project, o: IJsonObject): ShowSuggestionAction;
  }

  /**
   * A string represents the suggestion initiator.
   * - `option`: The suggestion is generated based on user config options.
   * - `error`: The suggestion is generated based on error requests.
   */
  export type SuggestionInitiator = "option" | "error";

  /**
   * An object represents a suggestion example.
   */
  export class SuggestionExample {
    /**
     * Create a `SugggestionExample` object.
     * @param before The original content to be modified.
     * @param after The suggested examples to show the modification.
     */
    constructor(before: string, after: string);

    /**
     * The original content to be modified.
     */
    readonly before: string;
    /**
     * The suggested examples to show the modification.
     */
    readonly after: string;

    /**
     * Convert a `SuggestionExample` object to a JSON object.
     * @returns The serialized JSON object.
     */
    toJson(): IJsonObject;
    /**
     * Create the `SuggestionExample` object from a JSON object.
     * @param o The JSON object.
     * @returns The `SuggestionExample` object deserialized from JSON data.
     */
    static fromJson(o: IJsonObject): SuggestionExample;
  }
}
