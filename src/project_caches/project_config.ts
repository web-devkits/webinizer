/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import shlex from "shlex";
import * as _ from "lodash";
import path from "path";
import fs from "graceful-fs";
import semver from "semver";
import dotProp from "dot-prop";
import Ajv from "ajv";
import * as H from "../helper";
import * as C from "../constants";
import { ALL_BUILDER_FACTORIES } from "../builder";
import { updateArgs } from "../actions/args_change";
import errorCode from "../error_code";
import { IPackage, DependencyResolver } from "../package_manager/resolver";
import { getPackageFetcher } from "../package_manager/fetcher";
import ProjectCacheFile from "./project_cache_file";
import { Project } from "../project";
import { IProjectProfile } from "../project_profiles";
import {
  EnvType,
  ProjectEnv,
  PkgConfigType,
  ProjectPkgConfig,
  BuildOptionType,
  IProjectBuildOptions,
  IBuildConfigUpdateOptions,
  IArg,
  ActionType,
  IProjectConfig,
  IProjectBuildConfig,
  IJsonObject,
  IBuilder,
  IProjectPerson,
  IProjectRepository,
  IProjectIcon,
} from "webinizer";
import { configSchema, buildTargetConfigSchema } from "../schemas/config_schema";
import {
  IBuildOption,
  IBuildConfig,
  BuildConfigType,
  optionFromType,
  configFromType,
} from "./config_fields";

const log = H.getLogger("project_config");

// introduce ProjectBuildConfig class to handle build configs per target
class ProjectBuildConfig implements IProjectBuildConfig {
  private _proj: Project;
  private _data: H.Dict<unknown>;
  private _target: string;
  private _builders: IBuilder[] | null = null; // lazy created builders
  private _options: Record<BuildOptionType, IBuildOption> | null = null; // lazy created build options
  private _configFields: Record<BuildConfigType, IBuildConfig> | null = null; // lazy created build configs
  constructor(proj: Project, config: H.Dict<unknown>, target: string) {
    this._proj = proj;
    this._data = config;
    this._target = target;
    if (this._proj.config.useDefaultConfig !== false) {
      // initialize BuildConfig with default settings for webinizer
      if (!this.rawOptions || H.isObjectEmpty(this.rawOptions)) {
        this.resetOptions();
        if (!this.envs || H.isObjectEmpty(this.envs)) {
          this.resetEnvs();
        } else {
          this.updateEnvsFromOptions();
        }
      }
    }
  }

  // read-only, target of this ProjectBuildConfig
  get target(): string {
    return this._target;
  }

  get rawBuilders(): IJsonObject[] | undefined {
    return this._data.builders as IJsonObject[];
  }

  set rawBuilders(v: IJsonObject[] | undefined) {
    // using setter will reset this._builders
    this._builders = null;
    Object.assign(this._data, { builders: v });
    this.save();
    this.convertBuildersToMeta();
  }

  get builders(): IBuilder[] | null {
    if (!this._builders) {
      if (this.rawBuilders) {
        this._builders = ALL_BUILDER_FACTORIES.fromJsonArray(this._proj, this.rawBuilders);
        // save the builders with index info as builderID added from backend
        this.builders = this._builders;
      }
    }
    return this._builders;
  }

  set builders(newBuilders: IBuilder[] | null) {
    this._builders = newBuilders;
    const newBuildersJson = newBuilders?.map((b) => b.toJson());
    if (JSON.stringify(this.rawBuilders) !== JSON.stringify(newBuildersJson)) {
      this.updateBuildConfig({ builders: newBuildersJson }, { refresh: false });
    }
  }

  get preloadFiles(): string[] | undefined {
    return this._data.preloadFiles as string[];
  }

  set preloadFiles(v: string[] | undefined) {
    Object.assign(this._data, { preloadFiles: v });
    this.save();
  }

  get exportedFuncs(): string | undefined {
    return this._data.exportedFuncs as string;
  }

  set exportedFuncs(v: string | undefined) {
    Object.assign(this._data, { exportedFuncs: v });
    this.save();
  }

  get exportedRuntimeMethods(): string | undefined {
    return this._data.exportedRuntimeMethods as string;
  }

  set exportedRuntimeMethods(v: string | undefined) {
    Object.assign(this._data, { exportedRuntimeMethods: v });
    this.save();
  }

  get configFields(): Record<BuildConfigType, IBuildConfig> | null {
    if (!this._configFields) {
      const configClassMap = {} as Record<BuildConfigType, IBuildConfig>;
      const createConfigClass = (configType: BuildConfigType) => {
        configClassMap[configType] = new (configFromType(configType))(configType, this._data);
      };
      createConfigClass("exportedFuncs");
      createConfigClass("exportedRuntimeMethods");
      createConfigClass("preloadFiles");
      this._configFields = configClassMap;
    }
    return this._configFields;
  }

  getEnv(key: EnvType): string {
    const envs = (this.envs || {}) as ProjectEnv;
    return envs[key] as string;
  }

  setEnv(key: EnvType, value: string) {
    if (!this.envs) {
      this.envs = {} as ProjectEnv;
    }
    Object.assign(this.envs as ProjectEnv, { [key]: value });
    this._proj.config.updateOverallEnvsFromSelf(this.envs);
    this.save();
    this.convertEnvsToMeta();
  }

  get envs(): ProjectEnv | undefined {
    return this._data.envs as ProjectEnv;
  }

  set envs(v: ProjectEnv | undefined) {
    Object.assign(this._data, { envs: v });
    this._proj.config.updateOverallEnvsFromSelf(this.envs);
    this.save();
    this.convertEnvsToMeta();
  }

  resetEnvs() {
    this.envs = {
      cflags: "-msimd128",
      ldflags: "-msimd128 -sMODULARIZE=1",
    } as ProjectEnv;
  }

  getOption(key: BuildOptionType): boolean | undefined {
    const options = (this.rawOptions || {}) as IProjectBuildOptions;
    return options[key] as boolean;
  }

  setOption(key: BuildOptionType, value: boolean) {
    if (!this.rawOptions) {
      this.rawOptions = {} as IProjectBuildOptions;
    }
    Object.assign(this.rawOptions, { [key]: value });
    this.save();
  }

  get rawOptions(): IProjectBuildOptions | null {
    return this._data.options as IProjectBuildOptions;
  }
  set rawOptions(v: IProjectBuildOptions | null) {
    Object.assign(this._data, { options: v });
    this.save();
    this._options = null;
  }

  resetOptions() {
    this.rawOptions = {
      needMainLoop: true,
      needPthread: false,
      needCppException: false,
      needSimd: true,
      needModularize: true,
    };
  }

  get options(): Record<BuildOptionType, IBuildOption> | null {
    if (!this._options) {
      if (this.rawOptions && Object.keys(this.rawOptions).length) {
        const optionClassMap = {} as Record<BuildOptionType, IBuildOption>;
        for (const op of Object.keys(this.rawOptions)) {
          const opt = op as BuildOptionType;
          const classType = optionFromType(opt);
          optionClassMap[opt] = new classType(opt, this.rawOptions);
        }
        this._options = optionClassMap;
      }
    }
    return this._options;
  }

  getDisabledAdvisorFlag<T>(key: string): T | undefined {
    const flags = (this.disabledAdvisors || {}) as H.Dict<unknown>;
    return flags[key] as T;
  }

  setDisabledAdvisorFlag<T>(key: string, value: T) {
    if (!this.disabledAdvisors) {
      this.disabledAdvisors = {};
    }
    Object.assign(this.disabledAdvisors as H.Dict<unknown>, { [key]: value });
    this.save();
  }

  get disabledAdvisors(): H.Dict<boolean> | null {
    return this._data.disabledAdvisors as H.Dict<boolean>;
  }

  set disabledAdvisors(v: H.Dict<boolean> | null) {
    Object.assign(this._data, { disabledAdvisors: v });
    this.save();
  }

  resetAdvisors() {
    this.disabledAdvisors = {};
  }

  // pkgConfig: exported package configs to be used by other libraries
  get pkgConfig(): ProjectPkgConfig | undefined {
    return this._data.pkgConfig as ProjectPkgConfig;
  }

  set pkgConfig(v: ProjectPkgConfig | undefined) {
    Object.assign(this._data, { pkgConfig: v });
    this.save();
    this.convertPkgConfigToMeta();
  }

  getPkgConfigEnv(key: PkgConfigType): string {
    const pkgConfig = (this.pkgConfig || {}) as H.Dict<string>;
    return pkgConfig[key] as string;
  }

  setPkgConfigEnv(key: PkgConfigType, value: string) {
    if (!this.pkgConfig) {
      this.pkgConfig = {} as ProjectPkgConfig;
    }
    Object.assign(this.pkgConfig, { [key]: value });
    this.save();
    this.convertPkgConfigToMeta();
  }

  updateEnvsFromConfigs(configType: BuildConfigType) {
    if (this.configFields && Object.keys(this.configFields).includes(configType)) {
      const configClass = this.configFields[configType];
      if (configClass.updateToEnvs) {
        const envUpdateSet = configClass.updateToEnvs();
        this.save();
        (Object.keys(envUpdateSet) as EnvType[]).forEach((env) => {
          if (envUpdateSet[env].length) {
            this.updateEnv(env, envUpdateSet[env]);
          }
        });
      }
    }
  }

  updateEnvsFromOptions(updateParts?: BuildOptionType | BuildOptionType[]) {
    let toUpdate: BuildOptionType[] = [];
    if (updateParts) {
      // update envs from specified options
      toUpdate = Array.isArray(updateParts) ? updateParts : [updateParts];
    } else {
      // update envs from all options
      if (this.rawOptions) toUpdate = Object.keys(this.rawOptions) as BuildOptionType[];
    }
    if (toUpdate.length && this.options) {
      for (const opt of toUpdate) {
        if (opt in this.options) {
          const optClass = this.options[opt];
          if (optClass.updateToEnvs) {
            const envUpdateSet = optClass.updateToEnvs();
            (Object.keys(envUpdateSet) as EnvType[]).forEach((env) => {
              if (envUpdateSet[env].length) {
                this.updateEnv(env, envUpdateSet[env]);
              }
            });
          }
        }
      }
    }
  }

  /**
   * Update the value of a environment variable with argument(s).
   * @param k The to be updated environment variable name.
   * @param val The to be updated arguments.
   */
  updateEnv(k: EnvType, args: IArg | IArg[]) {
    log.info(`... update ${k} with args to change are \n`, args);
    // update envs and save
    if (this.envs) {
      const updatedArgs = updateArgs(this.getEnv(k), args);
      if (updatedArgs !== this.getEnv(k)) {
        this.setEnv(k, updatedArgs);
      }
    }
  }

  /**
   * Update all the environment variables with argument(s).
   * @param args The to be updated arguments.
   */
  updateEnvs(args: IArg | IArg[]) {
    for (const env in this.envs) {
      this.updateEnv(env as EnvType, args);
    }
  }

  updateOptionsFromEnvs(currentEnv: EnvType) {
    const envFlags = this.getEnv(currentEnv).trim();
    if (this.options) {
      const opts = Object.keys(this.options) as BuildOptionType[];
      opts.forEach((opt) => {
        const optClass = this.options ? this.options[opt] : null;
        if (optClass && optClass.updateFromEnvs) {
          const envUpdateSet = optClass.updateFromEnvs(currentEnv, envFlags);
          this.save();
          (Object.keys(envUpdateSet) as EnvType[]).forEach((env) => {
            if (envUpdateSet[env].length) {
              this.updateEnv(env, envUpdateSet[env]);
            }
          });
        }
      });
    }
  }

  updateConfigsFromEnvs(currentEnv: EnvType) {
    if (currentEnv === "ldflags") {
      const envFlags = this.getEnv("ldflags").trim();
      if (this.configFields) {
        const fields = Object.keys(this.configFields) as BuildConfigType[];
        fields.forEach((field) => {
          const configClass = this.configFields ? this.configFields[field] : null;
          if (configClass && configClass.updateFromEnvs) {
            const updatedEnvsFlags = configClass.updateFromEnvs(currentEnv, envFlags);
            this.save();
            this.setEnv("ldflags", updatedEnvsFlags);
          }
        });
      }
    }
  }

  updateConfigsAndOptsFromEnvs(updateParts?: EnvType | EnvType[]) {
    let toUpdate: EnvType[] = [];
    if (updateParts) {
      // update envs from specified options
      toUpdate = Array.isArray(updateParts) ? updateParts : [updateParts];
    } else {
      // update envs from all options
      if (this.envs) toUpdate = Object.keys(this.envs) as EnvType[];
    }

    if (toUpdate.length) {
      if (toUpdate.includes("cflags")) {
        log.info("... update from cflags change: ", this.getEnv("cflags"));
        this.updateOptionsFromEnvs("cflags");
      }
      if (toUpdate.includes("ldflags")) {
        log.info("... update from ldflags change: ", this.getEnv("ldflags"));
        this.updateConfigsFromEnvs("ldflags");
        this.updateOptionsFromEnvs("ldflags");
      }
    }
  }

  async setRelocatable(type: ActionType): Promise<void> {
    if (
      !this.getEnv("cflags").includes("MAIN_MODULE") &&
      !this.getEnv("cflags").includes("SIDE_MODULE") &&
      !this.getEnv("ldflags").includes("MAIN_MODULE") &&
      !this.getEnv("ldflags").includes("SIDE_MODULE")
    ) {
      // only set/reset -sRELOCATABLE if MAIN_MODULE or SIDE_MODULE options are not set
      this.updateEnvs({
        option: "-sRELOCATABLE",
        value: null,
        type: type,
      });
    }
    if (!this._proj.config.dependencies) {
      await this._proj.config.getDependencies();
    }
    if (this._proj.config.dependencies && !H.isObjectEmpty(this._proj.config.dependencies)) {
      for (const dep in this._proj.config.dependencies) {
        const depProject = this._proj.config.dependencies[dep];
        const depBuildConfig = depProject.config.getBuildConfigForTarget(depProject.config.target);
        await depBuildConfig.setRelocatable(type);
      }
    }
  }

  updateBuildConfig(jsonParts: H.Dict<unknown>, options: IBuildConfigUpdateOptions = {}) {
    const updateOptions: IBuildConfigUpdateOptions = { refresh: true };
    if (options) {
      _.extend(updateOptions, options);
    }
    const { updateEnvParts, updateOptParts, refresh } = updateOptions;
    // perform the schema validation before actually updating the config JSON data.
    this.validateBuildTargetConfigSchema(jsonParts);
    // update config data
    Object.assign(this._data, jsonParts);
    this.save();
    log.info("updateBuildConfig", jsonParts, updateEnvParts, updateOptParts);
    if (refresh) {
      const jsonKeys = Object.keys(jsonParts);
      log.info(`jsonKeys are ${jsonKeys.join(", ")}`);
      if (jsonKeys.includes("builders")) {
        this._builders = null;
        this.convertBuildersToMeta();
      }
      if (jsonKeys.includes("pkgConfig")) {
        this.convertPkgConfigToMeta();
      }
      let updateEnvs = false;
      const setUpdateEnvsBit = () => {
        if (!updateEnvs) updateEnvs = true;
      };
      if (jsonKeys.includes("preloadFiles")) {
        this.updateEnvsFromConfigs("preloadFiles");
        setUpdateEnvsBit();
      }
      if (jsonKeys.includes("exportedFuncs")) {
        this.updateEnvsFromConfigs("exportedFuncs");
        setUpdateEnvsBit();
      }
      if (jsonKeys.includes("exportedRuntimeMethods")) {
        this.updateEnvsFromConfigs("exportedRuntimeMethods");
        setUpdateEnvsBit();
      }
      if (jsonKeys.includes("options")) {
        this._options = null;
        this.updateEnvsFromOptions(updateOptParts);
        setUpdateEnvsBit();
      }
      if (jsonKeys.includes("envs")) {
        this.updateConfigsAndOptsFromEnvs(updateEnvParts);
        setUpdateEnvsBit();
      }
      if (updateEnvs) {
        this.convertEnvsToMeta();
        this._proj.config.updateOverallEnvsFromSelf(this.envs);
      }
    }
  }

  resetBuildConfig() {
    this.resetOptions();
    this.resetEnvs();
    if (this.disabledAdvisors) this.resetAdvisors();
    if (this.exportedFuncs) this.exportedFuncs = "";
    if (this.exportedRuntimeMethods) this.exportedRuntimeMethods = "";
    if (this.preloadFiles) this.preloadFiles = [];
  }

  convertEnvsToMeta() {
    if (this.envs && !H.isObjectEmpty(this.envs)) {
      if (
        !H.isObjectEmpty(
          H.getObjDifference(
            this._proj.meta.get(`webinizer.buildTargets.${this.target}.envs`) as H.Dict<unknown>,
            this.envs as H.Dict<unknown>
          )
        )
      ) {
        this._proj.meta.set(`webinizer.buildTargets.${this.target}.envs`, _.cloneDeep(this.envs));
      }
    }
  }

  convertBuildersToMeta() {
    if (this.rawBuilders && this.rawBuilders.length) {
      const buildStepMap = new Map<string, string>();
      this._proj.getAllBuilders().forEach((b) => {
        const builderJson = b.toJson();
        buildStepMap.set(builderJson.__type__, builderJson.command);
      });
      const buildSteps = this.rawBuilders.map((b) => {
        if (buildStepMap.has(b.__type__)) {
          if (b.__type__ === "NativeBuilder") {
            // parse NativeBuilder args to command and args
            const [first, ...rest] = shlex.split(b.args as string);
            return {
              command: first,
              args: shlex.join(rest),
              cwd: b.rootBuildFilePath || "${projectRoot}",
            };
          }
          return {
            command: buildStepMap.get(b.__type__),
            args: b.args || "",
            cwd: b.rootBuildFilePath || "${projectRoot}",
          } as H.Dict<unknown>;
        } else {
          // not a registered and available builder, throw error.
          throw new H.WError(
            `Unknown build step type ${b.__type__}`,
            errorCode.WEBINIZER_BUILDER_UNKNOWN
          );
        }
      });
      if (
        !H.isObjectEmpty(
          H.getObjDifference(
            {
              buildSteps: this._proj.meta.get(
                `webinizer.buildTargets.${this.target}.buildSteps`
              ) as H.Dict<unknown>,
            },
            { buildSteps } as H.Dict<unknown>
          )
        )
      ) {
        this._proj.meta.set(`webinizer.buildTargets.${this.target}.buildSteps`, buildSteps);
      }
    }
  }

  convertPkgConfigToMeta() {
    if (this._proj.config.isLibrary && this.pkgConfig && !H.isObjectEmpty(this.pkgConfig)) {
      if (
        !H.isObjectEmpty(
          H.getObjDifference(
            this._proj.meta.get(
              `webinizer.buildTargets.${this.target}.pkgConfig`
            ) as H.Dict<unknown>,
            this.pkgConfig as H.Dict<unknown>
          )
        )
      ) {
        this._proj.meta.set(
          `webinizer.buildTargets.${this.target}.pkgConfig`,
          _.cloneDeep(this.pkgConfig)
        );
      }
    }
  }

  // convert `buildTargets` in config.json to package.json
  // Fields included: envs, builders, pkgConfig
  convertBuildTargetToMeta(convertParts?: ("envs" | "builders" | "pkgConfig")[]) {
    let fieldsToConvert = ["envs", "builders", "pkgConfig"];
    if (convertParts && convertParts.length) {
      fieldsToConvert = convertParts;
    }
    if (fieldsToConvert.includes("envs")) this.convertEnvsToMeta();
    if (fieldsToConvert.includes("builders")) this.convertBuildersToMeta();
    if (fieldsToConvert.includes("pkgConfig")) this.convertPkgConfigToMeta();
  }

  validateBuildTargetConfigSchema(configData: H.Dict<unknown>) {
    const ajv = new Ajv();
    const validate = ajv.compile(buildTargetConfigSchema);

    const valid = validate(configData);
    if (!valid) {
      log.info(
        `Errors happened in config data validation for target ${this.target} of project ${this._proj.config.name}@${this._proj.config.version}:\n`,
        validate.errors
      );
      throw new H.WError(
        `Errors happened in config data validation for target ${this.target} of project ${
          this._proj.config.name
        }@${this._proj.config.version}:\n${ajv.errorsText(validate.errors)}`,
        errorCode.WEBINIZER_META_SCHEMA_VALIDATION_FAILED
      );
    } else log.info(`Config data validation for target ${this.target} passed!`);
  }

  save() {
    this._proj.config.save();
  }
}

export class ProjectConfig extends ProjectCacheFile implements IProjectConfig {
  static __type__ = "ProjectConfig";
  private _dependencies: H.Dict<Project> | null = null; // lazy created dependent projects
  private _buildTargetConfigMap: H.Dict<ProjectBuildConfig> | null = null; // holds all build targets' config

  constructor(proj: Project, filePath: string) {
    super(proj, filePath, ProjectConfig.__type__);
  }

  get name(): string | undefined {
    return this.data.name as string;
  }

  set name(v: string | undefined) {
    this.data = { name: v };
    if (this.name?.toLocaleLowerCase() !== this.proj.meta.get("name")) {
      this.proj.meta.set("name", this.name?.toLocaleLowerCase());
    }
  }

  get version(): string | undefined {
    return this.data.version as string;
  }

  set version(v: string | undefined) {
    this.data = { version: v };
    if (this.version !== this.proj.meta.get("version")) {
      this.proj.meta.set("version", this.version);
    }
  }

  get desc(): string | undefined {
    return this.data.desc as string;
  }

  set desc(v: string | undefined) {
    this.data = { desc: v };
    if (this.desc !== this.proj.meta.get("description")) {
      this.proj.meta.set("description", this.desc);
    }
  }

  get keywords(): string[] | undefined {
    return this.data.keywords as string[];
  }

  set keywords(v: string[] | undefined) {
    this.data = { keywords: v };
    const equalsCheck = (a: string[], b: string[]) => {
      return a.length === b.length && a.every((v, i) => v === b[i]);
    };
    if (!equalsCheck(this.keywords || [], (this.proj.meta.get("keywords") || []) as string[])) {
      this.proj.meta.set("keywords", this.keywords);
    }
  }

  setDefaultKeywords(words = ["webinizer"]) {
    const currentKeywords: string[] = this.keywords || [];
    let keywordsUpdated = false;
    words.forEach((word) => {
      if (!currentKeywords.length || !currentKeywords.includes(word)) {
        currentKeywords.splice(0, 0, word);
        if (!keywordsUpdated) keywordsUpdated = true;
      }
    });
    if (keywordsUpdated) {
      this.keywords = currentKeywords;
    }
  }

  get homepage(): string | undefined {
    return this.data.homepage as string;
  }

  set homepage(v: string | undefined) {
    this.data = { homepage: v };
    if (this.homepage !== this.proj.meta.get("homepage")) {
      this.proj.meta.set("homepage", this.homepage);
    }
  }

  get bugs(): string | undefined {
    return this.data.bugs as string;
  }

  set bugs(v: string | undefined) {
    this.data = { bugs: v };
    if (this.bugs !== this.proj.meta.get("bugs")) {
      this.proj.meta.set("bugs", this.bugs);
    }
  }

  get license(): string | undefined {
    return this.data.license as string;
  }

  set license(v: string | undefined) {
    this.data = { license: v };
    if (this.license !== this.proj.meta.get("license")) {
      this.proj.meta.set("license", this.license);
    }
  }

  get author(): IProjectPerson | undefined {
    return this.data.author as IProjectPerson;
  }

  set author(v: IProjectPerson | undefined) {
    this.data = { author: v };
    if (JSON.stringify(this.author) !== JSON.stringify(this.proj.meta.get("author"))) {
      this.proj.meta.set("author", _.cloneDeep(this.author));
    }
  }

  get repository(): IProjectRepository | undefined {
    return this.data.repository as IProjectRepository;
  }

  set repository(v: IProjectRepository | undefined) {
    this.data = { repository: v };
    if (JSON.stringify(this.repository) !== JSON.stringify(this.proj.meta.get("repository"))) {
      this.proj.meta.set("repository", _.cloneDeep(this.repository));
    }
  }

  // img: path to project image file
  get img(): IProjectIcon | undefined {
    return this.data.img as IProjectIcon;
  }

  set img(v: IProjectIcon | undefined) {
    Object.assign(this.data, { img: v });
    this.save();
  }

  // category: project category
  get category(): string | undefined {
    return this.data.category as string;
  }

  set category(v: string | undefined) {
    this.data = { category: v };
  }

  // id: sort projects based on id value, should only be defined for demo projects
  get id(): number | undefined {
    return this.data.id as number;
  }

  set id(v: number | undefined) {
    this.data = { id: v };
  }

  // deleted: the flag of project deleted status
  get deleted(): boolean | undefined {
    return this.data.deleted as boolean;
  }

  set deleted(v: boolean | undefined) {
    this.data = { deleted: v };
  }

  // target: the selected build target for Project
  get target(): string | undefined {
    // set the first target defined in `buildTargets` as default if `target` is not defined
    if (!this.data.target && this.rawBuildTargets && !H.isObjectEmpty(this.rawBuildTargets)) {
      this.target = Object.keys(this.rawBuildTargets)[0];
    }
    return this.data.target as string;
  }

  set target(v: string | undefined) {
    this.data = { target: v };
    if (v) this.updateOverallEnvsFromSelf(this.getBuildConfigForTarget(this.target).envs);
  }

  // isLibrary: the project is a library or not
  get isLibrary(): boolean | undefined {
    return this.data.isLibrary as boolean;
  }

  set isLibrary(v: boolean | undefined) {
    this.data = { isLibrary: v };
  }

  get useDefaultConfig(): boolean | undefined {
    return this.data.useDefaultConfig as boolean;
  }

  set useDefaultConfig(v: boolean | undefined) {
    this.data = { useDefaultConfig: v };
  }

  // nativeLibrary: the native library info - name and version
  get nativeLibrary(): H.Dict<unknown> | undefined {
    return this.data.nativeLibrary as H.Dict<unknown>;
  }

  set nativeLibrary(v: H.Dict<unknown> | undefined) {
    this.data = { nativeLibrary: v };
  }

  // requiredBy: the packages that depends on this project - the opposite of dependencies
  get requiredBy(): H.Dict<string> | undefined {
    return this.data.requiredBy as H.Dict<string>;
  }

  set requiredBy(v: H.Dict<string> | undefined) {
    this.data = { requiredBy: v };
  }

  get rawDependencies(): H.Dict<string> | undefined {
    return this.data.dependencies as H.Dict<string>;
  }

  async setRawDependencies(v: H.Dict<string> | undefined) {
    this.data = { dependencies: v };
    this._dependencies = null;
    if (this.proj.isRootProject) {
      // this is for rootProject only
      await this.finalizeDependencyProjects();
    }
    await this.updateOverallEnvsFromDeps();
    if (
      !H.isObjectEmpty(
        H.getObjDifference(
          this.proj.meta.get("dependencies") as H.Dict<unknown>,
          this.rawDependencies as H.Dict<unknown>
        )
      )
    ) {
      this.proj.meta.set("dependencies", _.cloneDeep(this.rawDependencies));
    }
  }

  // resolved dependencies with package info
  get resolutions(): IPackage[] | undefined {
    return this.data.resolutions as IPackage[];
  }

  set resolutions(v: IPackage[] | undefined) {
    this.data = { resolutions: v };
  }

  async finalizeDependencyProjects() {
    const resolver = new DependencyResolver(this.proj);
    this.resolutions = await resolver.resolveDependencies();
    // update configs for each dependency
    if (this.resolutions && this.resolutions.length) {
      for (const dep of this.resolutions) {
        if (dep.destination) {
          // create Project for dependency with `isRoot = false`
          const depProject = new Project(path.join(this.proj.root, dep.destination), false);
          // convert package.json to config.json if config.json doesn't exist
          if (fs.existsSync(depProject.meta.path) && !fs.existsSync(depProject.config.path)) {
            try {
              depProject.meta.validateMetaSchema(_.cloneDeep(depProject.meta.data));
              await depProject.config.convertFromRegMeta();
            } catch (err) {
              // remove the project folder before throw the error.
              fs.rmSync(path.join(this.proj.root, dep.destination), {
                recursive: true,
                force: true,
              });
              throw err as Error;
            }
          }
          // add requiredBy field from the root project's `resolutions` field to config.json
          await depProject.config.updateRawJson({ requiredBy: _.cloneDeep(dep.requiredBy) });
        }
      }
    }
  }

  get dependencies(): H.Dict<Project> | null {
    return this._dependencies;
  }

  async getDependencies(): Promise<void> {
    if (!this._dependencies) {
      if (this.rawDependencies && !H.isObjectEmpty(this.rawDependencies)) {
        this._dependencies = {};
        for (const dep in this.rawDependencies) {
          const depRoot = await this.detectProjectRoot(dep, this.rawDependencies[dep]);
          log.info(`detectDependencyProjectRoot`, dep, this.rawDependencies[dep], depRoot);
          if (depRoot) {
            if (!this._dependencies[dep]) {
              // create Project for dependency with `isRoot = false`
              const depProject = new Project(depRoot, false);
              // convert package.json to config.json if config.json doesn't exist
              if (fs.existsSync(depProject.meta.path) && !fs.existsSync(depProject.config.path)) {
                await depProject.config.convertFromRegMeta();
              }
              this._dependencies[dep] = depProject;
            }
          } else {
            throw new H.WError(
              `Can't find dependent project ${dep} on local disk`,
              errorCode.WEBINIZER_ROOT_NOEXT
            );
          }
        }
      }
    }
    // return this._dependencies;
  }

  // Detect project root for dependencies or requiredBy projects based on path
  async detectProjectRoot(
    name: string,
    reference: string,
    forDependencies = true
  ): Promise<string | null> {
    const searchPaths: string[] = [];
    if (forDependencies) {
      // detect for dependencies, search paths include:
      // - root project --> `webinizer_deps` sub-dir in current root
      // - dependent project --> parent directory `webinizer_deps`
      if (this.proj.isRootProject)
        searchPaths.push(path.join(this.proj.root, C.dependencyDir, name.toLocaleLowerCase()));
      else searchPaths.push(path.join(path.dirname(this.proj.root), name.toLocaleLowerCase()));
    } else {
      if (!this.proj.isRootProject) {
        // detect for requiredBy, search paths include:
        // 1. parent directory `webinizer_deps` --> another dependency of the main project
        // 2. parent directory of `webinizer_deps` --> the main projet
        searchPaths.push(path.join(path.dirname(this.proj.root), name.toLocaleLowerCase()));
        searchPaths.push(path.join(path.dirname(path.dirname(this.proj.root))));
      }
    }
    // if `reference` is not a semver or semver range (i.e., a directory/file path), convert it to a
    // version number at first
    let depVer = "";
    if (reference.startsWith("file:")) {
      const packageManifest = await getPackageFetcher({ name, reference }).getManifest();
      depVer = packageManifest.version;
    }
    for (const searchPath of searchPaths) {
      if (fs.existsSync(searchPath)) {
        if (fs.existsSync(path.join(searchPath, "package.json"))) {
          const packageJson = JSON.parse(
            fs.readFileSync(path.join(searchPath, "package.json"), "utf8")
          );
          const depRef = depVer ? depVer : reference;
          if (
            packageJson.name === name.toLocaleLowerCase() &&
            ((semver.valid(depRef) && depRef === packageJson.version) ||
              (semver.validRange(depRef) && semver.satisfies(packageJson.version, depRef)))
          ) {
            return searchPath;
          }
        }
      }
    }

    return null;
  }

  // overallEnvs: the combination of self envs and deps' pkgConfig field, read-only for users
  get overallEnvs(): ProjectEnv | undefined {
    return this.data.overallEnvs as ProjectEnv;
  }

  set overallEnvs(v: ProjectEnv | undefined) {
    Object.assign(this.data, { overallEnvs: v });
    this.save();
  }

  getOverallEnv(key: EnvType): string {
    const overallEnvs = (this.overallEnvs || {}) as ProjectEnv;
    return overallEnvs[key] as string;
  }

  setOverallEnv(key: EnvType, value: string) {
    if (!this.overallEnvs) {
      this.overallEnvs = {} as ProjectEnv;
    }
    Object.assign(this.overallEnvs as ProjectEnv, { [key]: value });
    this.save();
  }

  // overallEnvsMap: a map holding {dep: config} pair to store state
  get overallEnvsMap(): H.Dict<ProjectEnv> | undefined {
    return this.data.overallEnvsMap as H.Dict<ProjectEnv>;
  }

  set overallEnvsMap(v: H.Dict<ProjectEnv> | undefined) {
    Object.assign(this.data, { overallEnvsMap: v });
    this.save();
  }

  async gatherPkgConfigsFromDeps(envsDict: H.Dict<ProjectEnv>) {
    if (!this.dependencies) {
      await this.getDependencies();
    }
    if (this.dependencies && !H.isObjectEmpty(this.dependencies)) {
      for (const dep in this.dependencies) {
        const depProject = this.dependencies[dep];
        const depBuildConfig = depProject.config.getBuildConfigForTarget(depProject.config.target);
        await depProject.config.gatherPkgConfigsFromDeps(envsDict);

        if (
          depBuildConfig.pkgConfig &&
          depBuildConfig.pkgConfig.prefix &&
          depBuildConfig.pkgConfig.cflags &&
          depBuildConfig.pkgConfig.ldflags
        ) {
          const prefixVal = depProject
            .evalTemplateLiterals(depBuildConfig.getPkgConfigEnv("prefix"))
            .replace(/'/g, "");

          const compilerFlags = depBuildConfig
            .getPkgConfigEnv("cflags")
            .replaceAll("${prefix}", prefixVal);

          const linkerFlags = depBuildConfig
            .getPkgConfigEnv("ldflags")
            .replaceAll("${prefix}", prefixVal);

          if (!Object.keys(envsDict).includes(dep)) {
            envsDict[dep] = {
              cflags: compilerFlags
                ? compilerFlags
                : `-I${path.join(depProject.root, C.buildDir, "include")}`,
              ldflags: linkerFlags
                ? linkerFlags
                : `-L${path.join(depProject.root, C.buildDir, "lib")}`,
            } as ProjectEnv;
          }
        } else {
          log.warn(
            `Package configurations of project ${depProject.config.name} are not defined properly.`
          );
          // throw error and stop the process if pkgConfig field is not properly defined.
          throw new H.WError(
            `Package configurations of project "${depProject.config.name}" and build target "${depProject.config.target}" are not defined properly.`,
            errorCode.WEBINIZER_META_FIELD_UNDEFINED
          );
        }
      }
    }
  }

  updateOverallEnvsFromSelf(envs: ProjectEnv | undefined, needUpdateRaw = true) {
    if (!this.overallEnvsMap) {
      this.overallEnvsMap = {};
    }
    if (
      envs &&
      (!Object.keys(this.overallEnvsMap).includes("self") ||
        this.overallEnvsMap.self.cflags !== envs.cflags ||
        this.overallEnvsMap.self.ldflags !== envs.ldflags)
    ) {
      // only update self envs when it's changed
      log.info(`updateOverallEnvsFromSelf, envs is ${JSON.stringify(envs, null, 2)}`);
      Object.assign(this.overallEnvsMap, { self: _.cloneDeep(envs) });
      if (needUpdateRaw) this.updateRawOverallEnvs();
    }
  }

  async updateOverallEnvsFromDeps(needUpdateRaw = true) {
    log.info(
      `updateOverallEnvsFromDeps for ${this.proj.root}`,
      JSON.stringify(this.overallEnvsMap, null, 2)
    );
    const newEnvsMapFromDeps: H.Dict<ProjectEnv> = {};
    await this.gatherPkgConfigsFromDeps(newEnvsMapFromDeps);
    const oldDeps = Object.keys(this.overallEnvsMap || {});
    const newDeps = Object.keys(newEnvsMapFromDeps);
    log.info(
      `updateOverallEnvsFromDeps newDeps for ${this.proj.root}`,
      JSON.stringify(newEnvsMapFromDeps, null, 2)
    );
    newDeps.forEach((dep) => {
      if (!this.overallEnvsMap) {
        this.overallEnvsMap = {};
      }
      this.overallEnvsMap[dep] = newEnvsMapFromDeps[dep];
    });
    oldDeps
      .filter((dep) => !newDeps.includes(dep) && dep !== "self")
      .forEach((dep) => {
        delete this.overallEnvsMap?.[dep];
      });
    if (needUpdateRaw) this.updateRawOverallEnvs();
  }

  updateRawOverallEnvs() {
    log.info(
      `updateRawOverallEnvs for project ${this.proj.root}`,
      JSON.stringify(this.overallEnvsMap, null, 2),
      `\nis this a root project? - ${this.proj.isRootProject}`
    );
    if (this.overallEnvsMap) {
      const overallCflags = Object.keys(this.overallEnvsMap)
        .map((dep) => {
          return this.overallEnvsMap?.[dep].cflags;
        })
        .join(" ");
      this.setOverallEnv(
        "cflags",
        shlex
          .join([...new Set(shlex.split(overallCflags))])
          .replaceAll(this.proj.root, "${projectRoot}")
      );

      // update linker flags from dependent projects for root/main project only
      const overallLdflags = this.proj.isRootProject
        ? Object.keys(this.overallEnvsMap)
            .map((dep) => {
              return this.overallEnvsMap?.[dep].ldflags;
            })
            .join(" ")
        : this.overallEnvsMap.self.ldflags;

      this.setOverallEnv(
        "ldflags",
        shlex
          .join([...new Set(shlex.split(overallLdflags))])
          .replaceAll(this.proj.root, "${projectRoot}")
      );
    }
  }

  async isSharedBuild(): Promise<boolean> {
    if (this.target === "shared") return true;
    if (!this.dependencies) {
      await this.getDependencies();
    }
    if (this.dependencies && !H.isObjectEmpty(this.dependencies)) {
      for (const dep in this.dependencies) {
        const isShared = await this.dependencies[dep].config.isSharedBuild();
        if (isShared) return true;
      }
    }
    return false;
  }

  // rawBuildTargets: raw configs for all build targets
  get rawBuildTargets(): H.Dict<unknown> | undefined {
    return this.data.buildTargets as H.Dict<unknown>;
  }

  set rawBuildTargets(v: H.Dict<unknown> | undefined) {
    this.data = { buildTargets: v };
    this._buildTargetConfigMap = null;
    this.convertBuildTargetsToMeta();
  }

  getRawBuildConfigForTarget(key: string): H.Dict<unknown> | undefined {
    const buildTargets = (this.rawBuildTargets || {}) as H.Dict<unknown>;
    return buildTargets[key] as H.Dict<unknown>;
  }

  setRawBuildConfigForTarget(key: string, value: H.Dict<unknown> | undefined) {
    Object.assign(this.rawBuildTargets || {}, { [key]: value });
    this._buildTargetConfigMap = null;
    this.save();
    if (value) this.getBuildConfigForTarget(key).convertBuildTargetToMeta();
  }

  get buildTargetConfigMap() {
    if (!this._buildTargetConfigMap) {
      if (this.rawBuildTargets) {
        this._buildTargetConfigMap = {};
        for (const t in this.rawBuildTargets) {
          if (!this._buildTargetConfigMap[t]) {
            this._buildTargetConfigMap[t] = new ProjectBuildConfig(
              this.proj,
              this.getRawBuildConfigForTarget(t) as H.Dict<unknown>,
              t
            );
          }
        }
      }
    }
    return this._buildTargetConfigMap;
  }

  getBuildConfigForTarget(target: string | undefined): ProjectBuildConfig {
    if (
      target &&
      this.buildTargetConfigMap &&
      Object.keys(this.buildTargetConfigMap).includes(target)
    ) {
      return this.buildTargetConfigMap[target];
    } else {
      throw new H.WError("Build target doesn't exist!", errorCode.WEBINIZER_PROJ_TARGET_NOEXT);
    }
  }

  async updateRawJson(jsonParts: H.Dict<unknown>, refresh = true) {
    // perform the schema validation before actually updating the config JSON data.
    this.validateConfigSchema(jsonParts);
    // update config data
    this.data = jsonParts;
    if (refresh) {
      const jsonKeys = Object.keys(jsonParts);
      // refresh cache
      if (jsonKeys.includes("name")) {
        this.proj.meta.set("name", this.name?.toLocaleLowerCase());
      }
      if (jsonKeys.includes("version")) {
        this.proj.meta.set("version", this.version);
      }
      if (jsonKeys.includes("desc")) {
        this.proj.meta.set("description", this.desc);
      }
      if (jsonKeys.includes("keywords")) {
        this.setDefaultKeywords();
        this.proj.meta.set("keywords", _.cloneDeep(this.keywords));
      }
      if (jsonKeys.includes("homepage")) {
        this.proj.meta.set("homepage", this.homepage);
      }
      if (jsonKeys.includes("bugs")) {
        this.proj.meta.set("bugs", this.bugs);
      }
      if (jsonKeys.includes("license")) {
        this.proj.meta.set("license", this.license);
      }
      if (jsonKeys.includes("author")) {
        this.proj.meta.set("author", _.cloneDeep(this.author));
      }
      if (jsonKeys.includes("repository")) {
        this.proj.meta.set("repository", _.cloneDeep(this.repository));
      }
      if (jsonKeys.includes("buildTargets")) {
        this._buildTargetConfigMap = null;
        this.convertBuildTargetsToMeta();
      }
      if (jsonKeys.includes("dependencies")) {
        // if dependencies are updated, set dependencyTree and dependencies to null
        this._dependencies = null;
        if (this.proj.isRootProject) {
          // for root project only
          await this.finalizeDependencyProjects();
        }
        await this.updateOverallEnvsFromDeps();
        this.proj.meta.set("dependencies", _.cloneDeep(this.rawDependencies));
      }
      if (jsonKeys.includes("target")) {
        if (this.target) {
          if (this.rawBuildTargets) {
            if (!Object.keys(this.rawBuildTargets).includes(this.target)) {
              // if this is to set a new target, initialize the raw build config for it as an empty object {}
              this.setRawBuildConfigForTarget(this.target, {} as H.Dict<unknown>);
            }
          } else {
            // buildTargets field is not defined yet, initialize buildTargets first and then
            // initialize the raw build config for target as an empty object {}
            this.rawBuildTargets = {} as H.Dict<unknown>;
            this.setRawBuildConfigForTarget(this.target, {} as H.Dict<unknown>);
          }
          this.updateOverallEnvsFromSelf(this.getBuildConfigForTarget(this.target).envs);
        }
      }
    }
  }

  getProjectProfile(): IProjectProfile {
    const profile: IProjectProfile = {};
    if (this.name) Object.assign(profile, { name: this.name });
    if (this.desc) Object.assign(profile, { desc: this.desc });
    if (this.img) Object.assign(profile, { img: this.img });
    if (this.category) Object.assign(profile, { category: this.category });
    if (this.version) Object.assign(profile, { version: this.version });
    if (this.deleted !== undefined) Object.assign(profile, { deleted: this.deleted });

    // this.id could be 0 so can't simply use this.id
    if (this.id !== undefined && this.id !== null) Object.assign(profile, { id: this.id });
    return profile;
  }

  setProjectProfile(v: IProjectProfile) {
    if ("path" in v) {
      // remove path entry before updating to ProjectConfig
      delete v.path;
    }
    this.data = v as H.Dict<unknown>;
  }

  convertBuildTargetsToMeta() {
    if (this.buildTargetConfigMap) {
      Object.keys(this.buildTargetConfigMap).forEach((target) => {
        this.getBuildConfigForTarget(target).convertBuildTargetToMeta();
      });
    }
  }

  // convert config.json to package.json
  convertToRegMetaFromConfig() {
    if (this.name) {
      this.proj.meta.set("name", this.name.toLocaleLowerCase());
    } else {
      throw new H.WError("Package name is required.", errorCode.WEBINIZER_META_FIELD_UNDEFINED);
    }
    if (this.version) {
      this.proj.meta.set("version", this.version);
    } else {
      throw new H.WError("Package version is required.", errorCode.WEBINIZER_META_FIELD_UNDEFINED);
    }
    if (this.desc) {
      this.proj.meta.set("description", this.desc);
    }
    /* dependencies */
    if (this.rawDependencies) {
      this.proj.meta.set("dependencies", _.cloneDeep(this.rawDependencies));
    }

    /* webinizer customized fields */
    // buildTargets
    if (this.buildTargetConfigMap) {
      this.convertBuildTargetsToMeta();
    }
    // nativeLibrary
    if (this.nativeLibrary) {
      this.proj.meta.set("webinizer.nativeLibrary", _.cloneDeep(this.nativeLibrary));
    }
  }

  async convertToRegMetaForPublish() {
    this.convertToRegMetaFromConfig();
    // add toolchain info when publish
    const toolchainVer = await H.runCommand("emcc --version", { silent: true });
    if (toolchainVer.code === 0) {
      const versionReg = /emcc \([^()]*\) (?<ver>[0-9]+.[0-9]+.[0-9]+) \((?<hash>[a-z0-9]*)\)/;
      for (const line of toolchainVer.all.split("\n")) {
        const m = line.match(versionReg);
        if (m && m.groups) {
          const version = m.groups.ver.trim();
          this.proj.meta.set("webinizer.toolchain", { emscripten: version });
          break;
        }
      }
    }
  }

  convertBuildTargetFromRegMeta(target: string, diffContent: H.Dict<unknown>) {
    const targetJson = _.cloneDeep(
      this.proj.meta.get(`webinizer.buildTargets.${target}`)
    ) as H.Dict<unknown>;
    if (!this.rawBuildTargets) {
      this.rawBuildTargets = {};
    }
    if (targetJson) {
      const convertedJson = this.getRawBuildConfigForTarget(target) || {};
      if (dotProp.has(diffContent, `webinizer.buildTargets.${target}.envs`))
        Object.assign(convertedJson, { envs: targetJson.envs || { cflags: "", ldflags: "" } });
      if (dotProp.has(diffContent, `webinizer.buildTargets.${target}.pkgConfig`)) {
        Object.assign(convertedJson, {
          pkgConfig: targetJson.pkgConfig || undefined,
        });
      }
      if (dotProp.has(diffContent, `webinizer.buildTargets.${target}.buildSteps`)) {
        // convert buildSteps to rawBuilders
        const steps = (targetJson.buildSteps || []) as H.Dict<string>[];
        const builderTypeMap = new Map<string, string>();
        this.proj.getAllBuilders().forEach((b) => {
          const builderJson = b.toJson();
          if (builderJson.command) {
            // NativeBuilder has an empty default command, exclude it
            builderTypeMap.set(builderJson.command, builderJson.__type__);
          }
        });

        const rawBuilders = steps.map((step) => {
          const builderType = builderTypeMap.get(step.command);
          // FIXME. this will treat all other unknown builders as NativeBuilder without a warning.
          return {
            __type__: builderType || "NativeBuilder",
            args: builderType ? step.args : `${step.command} ${step.args}`,
            rootBuildFilePath: step.cwd,
          };
        });
        Object.assign(convertedJson, { builders: rawBuilders });
      }
      this.setRawBuildConfigForTarget(target, convertedJson);
      this.getBuildConfigForTarget(target).updateBuildConfig(convertedJson);
    } else {
      // delete the entire buildConfig for target
      this.setRawBuildConfigForTarget(target, undefined);
    }
  }

  // convert package.json to config.json
  async convertFromRegMeta(diffContent = _.cloneDeep(this.proj.meta.data)) {
    if (dotProp.has(diffContent, "name")) {
      this.name = (this.proj.meta.get("name") || "") as string;
    }
    if (dotProp.has(diffContent, "version")) {
      this.version = (this.proj.meta.get("version") || "") as string;
    }
    if (dotProp.has(diffContent, "description")) {
      this.desc = (this.proj.meta.get("description") || "") as string;
    }
    if (dotProp.has(diffContent, "keywords")) {
      this.keywords = _.cloneDeep(this.proj.meta.get("keywords") as string[]);
      this.setDefaultKeywords();
    }
    if (dotProp.has(diffContent, "homepage")) {
      this.homepage = (this.proj.meta.get("homepage") || "") as string;
    }
    if (dotProp.has(diffContent, "bugs")) {
      this.bugs = (this.proj.meta.get("bugs") || "") as string;
    }
    if (dotProp.has(diffContent, "license")) {
      this.license = (this.proj.meta.get("license") || "") as string;
    }
    if (dotProp.has(diffContent, "author")) {
      this.author = (_.cloneDeep(this.proj.meta.get("author")) || undefined) as IProjectPerson;
    }
    if (dotProp.has(diffContent, "repository")) {
      this.repository = (_.cloneDeep(this.proj.meta.get("repository")) ||
        undefined) as IProjectRepository;
    }
    /* handle webinizer specific fields */
    if (dotProp.has(diffContent, "webinizer.nativeLibrary")) {
      this.nativeLibrary = (_.cloneDeep(this.proj.meta.get("webinizer.nativeLibrary")) ||
        undefined) as H.Dict<unknown>;
      // set isLibrary to true
      if (this.nativeLibrary && !this.isLibrary) this.isLibrary = true;
    }
    // buildTargets
    this.useDefaultConfig = false;
    if (dotProp.has(diffContent, "webinizer.buildTargets")) {
      Object.keys(dotProp.get(diffContent, "webinizer.buildTargets") as H.Dict<unknown>).forEach(
        (target) => {
          log.info(`update buildConfig for target ${target}`);
          this.convertBuildTargetFromRegMeta(target, diffContent);
        }
      );
      // update the default target if the original one was deleted
      const newTargetSet = Object.keys(this.rawBuildTargets || {}).filter((t) =>
        this.getRawBuildConfigForTarget(t)
      );
      if (newTargetSet.length) {
        if (this.target && !newTargetSet.includes(this.target)) this.target = newTargetSet[0];
      } else {
        this.target = "";
      }
    }

    /* dependencies */
    if (dotProp.has(diffContent, "dependencies")) {
      await this.setRawDependencies(
        (_.cloneDeep(this.proj.meta.get("dependencies")) || {}) as H.Dict<string>
      );
    }
  }

  validateConfigSchema(configData: H.Dict<unknown>) {
    const ajv = new Ajv();
    const validate = ajv.addSchema(buildTargetConfigSchema).compile(configSchema);

    const valid = validate(configData);
    if (!valid) {
      log.info(
        `Errors happened in config data schema validation of project ${this.name}@${this.version}:\n`,
        validate.errors
      );
      throw new H.WError(
        `Errors happened in config data schema validation of project ${this.name}@${
          this.version
        }:\n${ajv.errorsText(validate.errors)}`,
        errorCode.WEBINIZER_META_SCHEMA_VALIDATION_FAILED
      );
    } else log.info("Config data validation passed!");
  }

  // config.json file backup and restore
  backup() {
    if (fs.existsSync(this.path) && !fs.existsSync(`${this.path}.bak`)) {
      fs.copyFileSync(this.path, `${this.path}.bak`);
      // chmod for the temp file to be read-only
      fs.chmodSync(`${this.path}.bak`, 0o0400);
    }
  }

  restoreFromBackupFile() {
    if (fs.existsSync(`${this.path}.bak`)) {
      this.reset();
      this.data = JSON.parse(fs.readFileSync(`${this.path}.bak`, "utf8")) as IJsonObject;
      this.cleanBackupFile();
    }
  }

  cleanBackupFile() {
    fs.rmSync(`${this.path}.bak`, { force: true });
  }
}
