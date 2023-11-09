/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

/**
 * Project Details - hold the entire session
 *
 * @module
 */
import path from "path";
import fs from "graceful-fs";
import { cloneDeep } from "lodash";
import { AdviseManager } from "./advisor";
import { ALL_BUILDER_FACTORIES } from "./builder";
import * as H from "./helper";
import * as C from "./constants";
import { Recipe } from "./recipe";
import { FileChangeManager } from "./actions/file_change";
import { PlainAdviseRequest } from "./advise_requests/common_requests";
import { BuildStepChangeManager } from "./actions/build_step_change";
import { buildStatus } from "./status";
import errorCode from "./error_code";
import PackageMeta from "./package_metadata";
import { ProjectConfig } from "./project_caches/project_config";
import ProjectResult from "./project_caches/project_result";
import ProjectLog from "./project_caches/project_log";
import ProjectRecipe from "./project_caches/project_recipe";
import publish from "./package_manager/publish";
import { Project as IProject, ProjectConstType, IBuilder } from "webinizer";

const log = H.getLogger("project");
export class Project implements IProject {
  root = ""; // root of project
  config: ProjectConfig;
  log: ProjectLog;
  result: ProjectResult;
  recipe: ProjectRecipe;
  meta: PackageMeta;
  fileChangeManager = new FileChangeManager();
  buildStepChangeManager = new BuildStepChangeManager();
  isRootProject: boolean;
  constant: Record<ProjectConstType, string>;

  constructor(root: string, isRoot?: boolean) {
    this.root = root;
    this.config = new ProjectConfig(this, path.join(this.root, ".webinizer", "config.json"));
    this.log = new ProjectLog(this, path.join(this.root, ".webinizer", "log.json"));
    this.result = new ProjectResult(this, path.join(this.root, ".webinizer", "result.json"));
    this.recipe = new ProjectRecipe(this, path.join(this.root, ".webinizer", "recipe.json"));
    this.meta = new PackageMeta(this, path.join(this.root, "package.json"));
    /**
     * This is to determine if the project is a dependency or root based on path
     * If the project is nested inside a `webinizer_deps` folder -> a dependency
     * If the project is nested inside projectPool -> root project
     */
    this.isRootProject =
      isRoot !== undefined ? isRoot : path.dirname(this.root) === C.projectPool ? true : false;
    this.constant = {
      projectDist: path.join(this.root, C.buildDir), //default build path
      projectRoot: this.root, // project root path
      projectPool: C.projectPool, // project pool directory for all native projects
    };
    if (H.isObjectEmpty(this.meta.data) && Object.keys(this.config.data).length > 1) {
      this.config.convertToRegMetaFromConfig();
    }
  }

  // Detect all possible builders and provide to user for their reference
  // And return a possible build steps to use
  recommendBuildersToUse(): IBuilder[] {
    const builders: IBuilder[] = [];
    log.info("... trying to detect the Builder to use");
    for (const f of ALL_BUILDER_FACTORIES.factoriesMap().values()) {
      const builder = f.detect(this);
      if (builder) {
        builders.push(builder);
        if (builder.type === "CMakeBuilder" || builder.type === "ConfigureBuilder") {
          const m = ALL_BUILDER_FACTORIES.factoriesMap().get("MakeBuilder");
          if (m) {
            // create the following builders with the same rootBuildFilePath as the detected
            // one, and add MakeBuilder with a clean step ahead
            builders.push(
              ...[
                m.createDefault(this, {
                  rootBuildFilePath: builder.toJson().rootBuildFilePath,
                  args: "clean",
                }),
                m.createDefault(this, {
                  rootBuildFilePath: builder.toJson().rootBuildFilePath,
                }),
              ]
            );
          }
        }
        if (builder.type === "MakeBuilder") {
          // add MakeBuilder with a clean step ahead at the same build path
          const m = cloneDeep(builder.toJson());
          m.args = "clean";
          const mBuilder = ALL_BUILDER_FACTORIES.fromJsonArray(this, [m]);
          builders.splice(0, 0, ...mBuilder);
        }
        break;
      }
    }
    // if no builders detected, recommend to use emcc directly
    if (!builders.length) {
      const b = ALL_BUILDER_FACTORIES.factoriesMap().get("EmccBuilder");
      if (b) builders.push(b.createDefault(this));
    }
    return builders;
  }

  getAllBuilders(): IBuilder[] {
    const builders: IBuilder[] = [];
    for (const bf of ALL_BUILDER_FACTORIES.factoriesMap().values()) {
      builders.push(bf.createDefault(this));
    }
    return builders;
  }

  getTemplateLiterals(withMarkdown = false): string[] {
    const templates: string[] = [];
    for (const c in this.constant) {
      if (withMarkdown) templates.push(`\`$\{${c}}\` = ${this.constant[c as ProjectConstType]}`);
      else templates.push(`$\{${c}} = ${this.constant[c as ProjectConstType]}`);
    }
    return templates;
  }

  evalTemplateLiterals(s: string): string {
    let val = s;
    if (s) {
      for (const c in this.constant) {
        val = val.replaceAll("${" + c + "}", this.constant[c as ProjectConstType]);
      }
    }
    return val;
  }

  validateTemplateLiterals(s: string): string[] {
    // TODO. validate if the string is defined with proper template literal format?
    // i.e., ${xyz} - correct, {xyz} - wrong
    const invalidTemplates: string[] = [];
    const templateReg = /\$\{(?<dir>[^${]*)\}/g;
    const matches = s.matchAll(templateReg);
    for (const m of matches) {
      if (m && m.groups && !Object.keys(this.constant).includes(m.groups.dir)) {
        invalidTemplates.push(m[0]);
      }
    }
    return invalidTemplates;
  }

  backupConfigFiles() {
    log.info("... backup meta and config files before updating configs");
    this.config.backup();
    this.meta.backup();
  }

  restoreConfigsFromBackupFiles() {
    log.info("... errors happened, restore config and meta files");
    this.config.restoreFromBackupFile();
    this.meta.restoreFromBackupFile();
  }

  cleanBackupFiles() {
    log.info("... cleanup backup files");
    this.config.cleanBackupFile();
    this.meta.cleanBackupFile();
  }

  // dependency folder backup and restore for root project only
  backupDependencyDir() {
    if (this.isRootProject) {
      const depsDir = path.join(this.root, C.dependencyDir);
      const depsBackupDir = path.join(this.root, `.${C.dependencyDir}`);
      if (fs.existsSync(depsDir) && !fs.existsSync(depsBackupDir)) {
        H.backupFolderSync(depsDir, depsBackupDir);
      }
    }
  }

  restoreDependencyDir() {
    if (this.isRootProject) {
      const depsDir = path.join(this.root, C.dependencyDir);
      const depsBackupDir = path.join(this.root, `.${C.dependencyDir}`);
      if (fs.existsSync(depsDir)) {
        H.deleteFolder(depsDir);
      }
      if (fs.existsSync(depsBackupDir)) {
        H.renameFolder(depsBackupDir, depsDir);
      }
    }
  }

  cleanDependencyDirBackup() {
    if (this.isRootProject) {
      const depsBackupDir = path.join(this.root, `.${C.dependencyDir}`);
      if (fs.existsSync(depsBackupDir)) {
        H.deleteFolder(depsBackupDir);
      }
    }
  }

  /**
   * Reset build status of project to `idle_default` if it requires hard reset or there is any API requests fired
   * from UI to change project configs / source codes. This will be propagated to all requiredBy parent projects.
   * @param hardReset reset the status to `idle_default` regardless of the current build status
   */
  async resetBuildStatus(hardReset = false) {
    if (hardReset) buildStatus.setBuildStatus(this.root, "idle_default");
    else {
      const currentStatus = await buildStatus.getBuildStatus(this.root);
      if (currentStatus !== "building" && currentStatus !== "building_with_recipes") {
        buildStatus.setBuildStatus(this.root, "idle_default");
      } else {
        // if the project is under building, any actions to update configs are not allowed
        throw new H.WError(
          "The project is under building and update the configs and files is not allowed.",
          errorCode.WEBINIZER_PROCESS_UPDATE_UNDER_BUILD
        );
      }
    }
    // propagate the status reset to all parent projects
    if (this.config.requiredBy && !H.isObjectEmpty(this.config.requiredBy)) {
      await Promise.all(
        Object.keys(this.config.requiredBy).map(async (name) => {
          const requiredProjRoot = await this.config.detectProjectRoot(
            name,
            this.config.requiredBy?.[name] || "",
            false /* detect for parent project */
          );
          if (requiredProjRoot) {
            const requiredProj = new Project(requiredProjRoot);
            await requiredProj.resetBuildStatus(hardReset);
          } else {
            throw new H.WError(
              `Can't find required project ${name} on local disk`,
              errorCode.WEBINIZER_ROOT_NOEXT
            );
          }
        })
      );
    }
    return;
  }

  async build(res: Recipe[] | null): Promise<Recipe[]> {
    const currentStatus = await buildStatus.getBuildStatus(this.root);
    if (currentStatus === "building" || currentStatus === "building_with_recipes") {
      throw new H.WError(
        `Project ${this.root} is under building now, multiple builds for the same project is not allowed.`,
        errorCode.WEBINIZER_PROCESS_MULTI_BUILD
      );
    }

    if (res && res.length) {
      buildStatus.setBuildStatus(this.root, "building_with_recipes");
    } else buildStatus.setBuildStatus(this.root, "building");

    const projName = this.config.name ? this.config.name : path.basename(this.root);
    const tStart = new Date();

    // clear the log, result and recipe files when build
    this.log.clear();
    this.result.clear();
    this.recipe.clear();
    const dumpLog = (data: string) => {
      this.log.update(data);
    };

    // apply recipes before build if any
    if (res && res.length) {
      log.info(`... apply recipes for project ${projName}`, dumpLog);
      for (const r of res) await r.apply();
    }

    const buildConfig = this.config.getBuildConfigForTarget(this.config.target);

    if (!buildConfig.builders) {
      // one must have configured related builders in UI before trigger build
      buildStatus.setBuildStatus(this.root, "idle_fail");
      buildStatus.setChangeHash(this.root);
      throw new H.WError(
        "No builders defined yet for building.",
        errorCode.WEBINIZER_BUILDER_UNDEFINED
      );
    }

    const recipes: Recipe[] = [];
    const adviseManager = new AdviseManager(this);

    /**
     * dependencies' build
     */
    if (this.isRootProject) {
      // if there is any shared build enabled in the dependency tree, append `-sRELOCATABLE` to all
      // (main and dependent) projects' build. Otherwise, remove it.
      const isSharedBuild = await this.config.isSharedBuild();
      if (isSharedBuild) await buildConfig.setRelocatable("replace");
      else await buildConfig.setRelocatable("deleteAll");
    }

    if (!this.config.dependencies) {
      await this.config.getDependencies();
    }
    if (this.config.dependencies && !H.isObjectEmpty(this.config.dependencies)) {
      const depRecipes: string[] = [];
      for (const k in this.config.dependencies) {
        const depRoot = this.config.dependencies[k].root;
        const depBuildStatus = await buildStatus.getBuildStatus(depRoot);
        // don't rebuild dep project if it's a successful build previously
        if (
          depBuildStatus !== "idle_success" &&
          depBuildStatus !== "building" &&
          depBuildStatus !== "building_with_recipes"
        ) {
          log.info(`... build dependency: ${k}@${depRoot}`, dumpLog);
          const r = await this.config.dependencies[k].build(null);
          if (r.length) {
            this.config.dependencies[k].recipe.saveRecipes(r);
            // depRecipes.push(k.replace(C.projectPool, "${projectPool}"));
            depRecipes.push(depRoot);
          }
        }
      }

      if (depRecipes.length) {
        // recipes in dep projects generated
        adviseManager.queueRequest(new PlainAdviseRequest("dep-build", depRecipes));
        recipes.push(...(await adviseManager.advise()));
      }

      if (recipes.length > 0) {
        this.recipe.saveRecipes(recipes);
        buildStatus.setBuildStatus(this.root, "idle_fail");
        buildStatus.setChangeHash(this.root);
        return recipes;
      }
    }

    /**
     * pre-build checks
     */
    log.info(`... running pre-build checks for project ${projName}`, dumpLog);
    adviseManager.queueRequest(new PlainAdviseRequest("pre-build", {}));
    recipes.push(...(await adviseManager.advise()));

    // recipes generated during pre-build, stop building the project
    if (recipes.length > 0) {
      this.recipe.saveRecipes(recipes);
      buildStatus.setBuildStatus(this.root, "idle_fail");
      buildStatus.setChangeHash(this.root);
      return recipes;
    }

    // force to update overallEnvs from dependencies before build to ensure latest configs are used
    await this.config.updateOverallEnvsFromDeps();

    /**
     * root project build
     */
    log.info(`... building project ${projName}`, dumpLog);
    // run build steps
    for (const builder of buildConfig.builders) {
      log.info(`... will use Builder ${builder.type}`);
      if (!(await builder.build(adviseManager))) {
        recipes.push(...(await adviseManager.advise()));
        break;
      }
    }

    if (recipes.length > 0) {
      this.recipe.saveRecipes(recipes);
      buildStatus.setBuildStatus(this.root, "idle_fail");
      buildStatus.setChangeHash(this.root);
      return recipes;
    } else {
      // no recipe means successful build - generate build summary
      log.info(`... project ${projName} build successfully!`, dumpLog);
      const tEnd = new Date();
      this.result.timestamps = {
        tStart: tStart,
        tEnd: tEnd,
        tDur: tEnd.getTime() - tStart.getTime(),
      };
      await this.result.genBuildResults();
      buildStatus.setBuildStatus(this.root, "idle_success");
      buildStatus.setChangeHash(this.root);
      return [];
    }
  }

  async publishToRegistry() {
    await publish(this);
  }
}

// re-export related project cache files classes here
export { ProjectConfig, ProjectLog, ProjectRecipe, ProjectResult };
