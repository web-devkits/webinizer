/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import * as H from "./helper";
import * as C from "./constants";
import fs from "graceful-fs";
import writeFileAtomic from "write-file-atomic";
import path from "path";
import { buildDirTree, IDtreeJson } from "./dtree";
import { Project, ProjectConfig, ProjectResult } from "./project";
import { IProjectProfile } from "./project_profiles";
import { recipeArrayFromJson, type Recipe } from "./recipe";
// import { ALL_BUILDER_FACTORIES } from "./builder";
import { buildStatus, type StatusType } from "./status";
import errorCode from "./error_code";
import { handleUploadProject, cloneProject, fetchProjectFromRegistry } from "./create_project";
import { deleteProjectSoftly } from "./delete_project";
import { getProfilesFromDetection } from "./project_profiles";
import { search as searchPackage, IPackageSearchResult } from "./package_manager/search";
import { Settings } from "./settings";
import { EnvType, BuildOptionType, IJsonObject, IBuilder } from "webinizer";

const log = H.getLogger("api");

function validateProjectRoot(root: string) {
  if (!root) {
    throw new H.WError("Project root path can't be empty.", errorCode.WEBINIZER_ROOT_EMPTY);
  }
  if (!fs.existsSync(root)) {
    throw new H.WError("Project root path doesn't exist.", errorCode.WEBINIZER_ROOT_NOEXT);
  }
}

export async function resetBuildStatus(root: string, hardReset = false) {
  // expose this method from Project class for direct calls from the server layer
  validateProjectRoot(root);
  const proj = new Project(root);
  await proj.resetBuildStatus(hardReset);
}

export function getProjectProfilesFromDetection(projectPoolDir?: string): IProjectProfile[] {
  return getProfilesFromDetection(projectPoolDir);
}

export function getProjectConfig(root: string): ProjectConfig {
  validateProjectRoot(root);
  const proj = new Project(root);
  return proj.config;
}

export async function updatePartOfProjectConfig(
  root: string,
  configPart: H.Dict<unknown>
): Promise<ProjectConfig> {
  validateProjectRoot(root);
  const proj = new Project(root);
  let needActualUpdate = false;
  let needCreateBuildTargetsField = false;
  let needUpdateBuildTargets = false;
  const configJson = proj.config.toJson();

  for (const k in configPart) {
    if (Object.keys(configJson).includes(k)) {
      // to-be-updated part is in current proj.config, compare and update
      // wrap the value with a temp object to do the comparison
      const diff = H.getObjDifference(
        { [k]: configJson[k] },
        { [k]: configPart[k] }
      ) as H.Dict<unknown>;
      if (Object.keys(diff).length) {
        if (!needActualUpdate) needActualUpdate = true;
        if (k === "buildTargets") needUpdateBuildTargets = true;
      }
    } else {
      // to-be-updated part is not in current proj.config, update directly
      if (!needActualUpdate) needActualUpdate = true;
      if (k === "buildTargets") {
        needCreateBuildTargetsField = true;
        needUpdateBuildTargets = true;
      }
    }
  }
  if (needActualUpdate) {
    log.info("... actual update on project config");
    await proj.resetBuildStatus();
    const needBackupDepsDir = Object.keys(configPart).includes("dependencies") ? true : false;
    try {
      // backup meta and config files before updating configs
      proj.backupConfigFiles();
      // backup the dependency folder if needed
      if (needBackupDepsDir) proj.backupDependencyDir();
      if (needUpdateBuildTargets) {
        // configPart includes update on `buildTargets`, update `buildTarget` separately
        // then update rest configs without `buildTarget`
        if (needCreateBuildTargetsField) {
          proj.config.updateRawJson({ buildTargets: {} });
        }
        await updateProjectBuildConfig(root, configPart["buildTargets"] as H.Dict<unknown>);
        const configWithoutBuildTargets = Object.assign({}, configPart);
        delete configWithoutBuildTargets.buildTargets;
        await proj.config.updateRawJson(configWithoutBuildTargets);
      } else {
        // configPart has no update on `buildTargets`, simply update
        await proj.config.updateRawJson(configPart);
      }
    } catch (err) {
      // errors happened during configs update, restore meta and config before update
      proj.restoreConfigsFromBackupFiles();
      // restore dependency folder if needed
      if (needBackupDepsDir) {
        if ((err as H.WError).name === "WEBINIZER_DIR_COPY_FAIL") {
          // if the failure was happened at the backup dependency directory stage, just clean the backup folder only
          proj.cleanDependencyDirBackup();
        } else {
          proj.restoreDependencyDir();
        }
      }
      throw err;
    } finally {
      // cleanup the backup files in last step
      proj.cleanBackupFiles();
      if (needBackupDepsDir) proj.cleanDependencyDirBackup();
    }
  }

  return proj.config;
}

export async function resetProjectConfig(root: string): Promise<ProjectConfig> {
  validateProjectRoot(root);
  const proj = new Project(root);
  await proj.resetBuildStatus();
  try {
    // backup meta and config files before updating configs
    proj.backupConfigFiles();
    proj.config.getBuildConfigForTarget(proj.config.target).resetBuildConfig();
    proj.cleanBackupFiles();
  } catch (err) {
    // errors happened during configs update, restore meta and config before update
    proj.restoreConfigsFromBackupFiles();
    throw err;
  }
  return proj.config;
}

export async function updateProjectBuildConfig(
  root: string,
  config: H.Dict<unknown>
): Promise<ProjectConfig> {
  validateProjectRoot(root);
  const proj = new Project(root);
  try {
    // backup meta and config files before updating configs
    proj.backupConfigFiles();
    for (const target in config) {
      const buildConfigToUpdate = config[target] as H.Dict<unknown>;
      const buildConfigJson = proj.config.getRawBuildConfigForTarget(target);
      if (buildConfigJson === undefined) {
        // to create a new target
        await proj.resetBuildStatus();
        proj.config.setRawBuildConfigForTarget(target, buildConfigToUpdate);
        proj.config.getBuildConfigForTarget(target).updateBuildConfig(buildConfigToUpdate);
      } else {
        // to update a current target
        // const buildConfigJson = proj.config.getRawBuildConfigForTarget(target);
        let needActualUpdate = false;
        let updateEnvParts: EnvType[] | undefined = undefined;
        let updateOptParts: BuildOptionType[] | undefined = undefined;

        for (const k in buildConfigToUpdate) {
          if (Object.keys(buildConfigJson).includes(k)) {
            // to-be-updated part is in current proj.config.buildTargets.[target], compare and update
            // wrap the value with a temp object to do the comparison
            const diff = H.getObjDifference(
              { [k]: buildConfigJson[k] },
              { [k]: buildConfigToUpdate[k] }
            ) as H.Dict<unknown>;
            if (Object.keys(diff).length) {
              if (!needActualUpdate) needActualUpdate = true;
              if (k === "envs")
                updateEnvParts = Object.keys(
                  diff[Object.keys(diff)[0]] as H.Dict<unknown>
                ) as EnvType[];
              else if (k === "options")
                updateOptParts = Object.keys(
                  diff[Object.keys(diff)[0]] as H.Dict<unknown>
                ) as BuildOptionType[];
            }
          } else {
            // to-be-updated part is not in current proj.config, update directly
            if (!needActualUpdate) needActualUpdate = true;
          }
        }
        if (needActualUpdate) {
          log.info(`... actual update on project config for target ${target}`);
          await proj.resetBuildStatus();
          const buildConfig = proj.config.getBuildConfigForTarget(target);
          buildConfig.updateBuildConfig(buildConfigToUpdate, { updateEnvParts, updateOptParts });
        }
      }
    }
  } catch (err) {
    // errors happened during configs update, restore meta and config before update
    proj.restoreConfigsFromBackupFiles();
    throw err;
  } finally {
    // cleanup the backup files in last step
    proj.cleanBackupFiles();
  }
  return proj.config;
}

export async function updateOverallEnvsFromDeps(root: string): Promise<ProjectConfig> {
  validateProjectRoot(root);
  const proj = new Project(root);
  await proj.resetBuildStatus();
  try {
    // backup meta and config files before updating configs
    proj.backupConfigFiles();
    await proj.config.updateOverallEnvsFromDeps();
    proj.cleanBackupFiles();
  } catch (err) {
    // errors happened during configs update, restore meta and config before update
    proj.restoreConfigsFromBackupFiles();
    throw err;
  }
  return proj.config;
}

export function recommendBuildersToUse(root: string): IBuilder[] {
  validateProjectRoot(root);
  const proj = new Project(root);
  return proj.recommendBuildersToUse();
}

export function getAllBuilders(root: string): IBuilder[] {
  validateProjectRoot(root);
  const proj = new Project(root);
  return proj.getAllBuilders();
}

export async function disableAdvisorToUse(root: string, advisor: string): Promise<ProjectConfig> {
  validateProjectRoot(root);
  const proj = new Project(root);
  await proj.resetBuildStatus();
  try {
    // backup meta and config files before updating configs
    proj.backupConfigFiles();
    proj.config.getBuildConfigForTarget(proj.config.target).setDisabledAdvisorFlag(advisor, true);
    proj.cleanBackupFiles();
  } catch (err) {
    // errors happened during configs update, restore meta and config before update
    proj.restoreConfigsFromBackupFiles();
    throw err;
  }
  return proj.config;
}

export async function resetAdvisors(root: string): Promise<ProjectConfig> {
  validateProjectRoot(root);
  const proj = new Project(root);
  await proj.resetBuildStatus();
  try {
    // backup meta and config files before updating configs
    proj.backupConfigFiles();
    proj.config.getBuildConfigForTarget(proj.config.target).resetAdvisors();
    proj.cleanBackupFiles();
  } catch (err) {
    // errors happened during configs update, restore meta and config before update
    proj.restoreConfigsFromBackupFiles();
    throw err;
  }
  return proj.config;
}

export async function build(root: string, r: IJsonObject[] | null): Promise<Recipe[]> {
  validateProjectRoot(root);
  // we create a brand new project everytime
  const proj = new Project(root);
  const recipes = r ? recipeArrayFromJson(proj, r) : null;
  try {
    // backup meta and config files before updating configs
    proj.backupConfigFiles();
    // build with recipes
    const res = await proj.build(recipes);
    // cleanup the backup files
    proj.cleanBackupFiles();
    return res;
  } catch (err) {
    // errors happened during configs update, restore meta and config before update
    proj.restoreConfigsFromBackupFiles();
    throw err;
  }
}

export function getRecipes(root: string): IJsonObject[] {
  validateProjectRoot(root);
  const proj = new Project(root);
  return proj.recipe.toJson().recipes as IJsonObject[];
}

export async function getFileContent(root: string, name: string): Promise<string> {
  validateProjectRoot(root);
  if (!fs.existsSync(name)) {
    throw new H.WError(`File doesn't exist.`, errorCode.WEBINIZER_FILE_NOEXT);
  }
  const relative = path.relative(root, name);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    // check file type before reading it, throw error for unsupported file format (binary, etc...)
    const fileType = await H.runCommand(`file -b ${name}`, { silent: true });
    if (
      fileType.code === 0 &&
      (fileType.all.includes("ASCII text") ||
        fileType.all.includes("UTF-8 Unicode text") ||
        fileType.all.includes("JSON data") ||
        fileType.all.includes("empty"))
    ) {
      return fs.readFileSync(name, "utf-8");
    } else if (fileType.code === 0 && fileType.all.includes("symbolic link to")) {
      // handle file redirection with symbolic link
      const redir = fileType.all.match(/symbolic link to (?<dir>[\S]*)/);
      if (redir && redir.groups) {
        return getFileContent(root, path.join(path.dirname(name), redir.groups.dir));
      }
      throw new H.WError(
        `File is symbolic link to an unknown file.`,
        errorCode.WEBINIZER_FILE_UNKNOWN_SYMBOLIC
      );
    } else {
      throw new H.WError(
        "Can't open file because it is either binary or uses an unsupported text encoding.",
        errorCode.WEBINIZER_FILE_UNSUPPORTED_ENCODING
      );
    }
  } else {
    throw new H.WError(
      `File is outside the project root and cannot be accessed.`,
      errorCode.WEBINIZER_FILE_OUTSIDE_ROOT
    );
  }
}

export async function updateFileContent(
  root: string,
  name: string,
  content: string
): Promise<string> {
  validateProjectRoot(root);
  const proj = new Project(root);
  if (!fs.existsSync(name)) {
    throw new H.WError(`File doesn't exist.`, errorCode.WEBINIZER_FILE_NOEXT);
  }
  // config.json is readonly
  if (name === proj.config.path) {
    throw new H.WError(
      `File ${path.basename(name)} is readonly.`,
      errorCode.WEBINIZER_FILE_READONLY
    );
  }
  // files from dependency project is readonly
  const relativeToDeps = path.relative(path.join(root, C.dependencyDir), name);
  if (relativeToDeps && !relativeToDeps.startsWith("..") && !path.isAbsolute(relativeToDeps)) {
    throw new H.WError(
      `File ${path.basename(name)} is from dependency project and readonly.`,
      errorCode.WEBINIZER_FILE_READONLY
    );
  }
  // update package metadata file, do validation before actually updating it
  if (name === proj.meta.path) {
    if (content === fs.readFileSync(name, "utf-8")) {
      // no config update, skip validations and return
      return content;
    }
    let metaToUpdate: H.Dict<unknown> = {};
    try {
      metaToUpdate = JSON.parse(content);
    } catch (err) {
      throw new H.WError(
        `Failed to parse ${path.basename(name)} content due to error:\n${(err as Error).message}`,
        errorCode.WEBINIZER_META_PARSE_FAILED
      );
    }
    // apply metadata schema validation
    proj.meta.validateMetaSchema(metaToUpdate);
    await proj.resetBuildStatus();
    const diffContent = H.getObjDifference(proj.meta.data, metaToUpdate);
    const needBackupDepsDir = Object.keys(diffContent).includes("dependencies") ? true : false;
    try {
      // backup meta and config files before updating configs
      proj.backupConfigFiles();
      // backup the dependency folder if needed
      if (needBackupDepsDir) proj.backupDependencyDir();
      // handle metadata update
      await proj.meta.updateMetaAndConfig(metaToUpdate);
      // cleanup the backup files and dependency folder if needed
      proj.cleanBackupFiles();
      if (needBackupDepsDir) proj.cleanDependencyDirBackup();
      return fs.readFileSync(name, "utf8");
    } catch (err) {
      // errors happened during configs update, restore meta and config before update
      proj.restoreConfigsFromBackupFiles();
      // restore the dependency folder if needed
      if (needBackupDepsDir) {
        if ((err as H.WError).name === "WEBINIZER_DIR_COPY_FAIL") {
          // if the failure was happened at the backup dependency directory stage, just clean the backup folder only
          proj.cleanDependencyDirBackup();
        } else {
          proj.restoreDependencyDir();
        }
      }
      throw err;
    }
  }
  // editing files from main project
  const relativeToRoot = path.relative(root, name);
  if (relativeToRoot && !relativeToRoot.startsWith("..") && !path.isAbsolute(relativeToRoot)) {
    await proj.resetBuildStatus();
    writeFileAtomic.sync(name, content, "utf-8");
    return content;
  } else {
    throw new H.WError(
      `File is outside the project root and cannot be accessed.`,
      errorCode.WEBINIZER_FILE_OUTSIDE_ROOT
    );
  }
}

export async function createNewFile(root: string, name: string, content: string) {
  validateProjectRoot(root);
  const proj = new Project(root);
  if (fs.existsSync(name)) {
    throw new H.WError(
      `File already exists, please specify another directory.`,
      errorCode.WEBINIZER_FILE_EXT
    );
  }
  const relative = path.relative(root, name);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    await proj.resetBuildStatus();
    fs.mkdirSync(path.dirname(name), { mode: 0o0700, recursive: true });
    writeFileAtomic.sync(name, content, {
      mode: 0o0600,
    });
  } else {
    throw new H.WError(
      `File is outside the project root and cannot be accessed.`,
      errorCode.WEBINIZER_FILE_OUTSIDE_ROOT
    );
  }
}

export function getBuildLog(root: string): string {
  validateProjectRoot(root);
  const proj = new Project(root);
  return proj.log.getContent();
}

export function getDirTree(root: string, dirPath: string): IDtreeJson {
  validateProjectRoot(root);
  const relative = path.relative(root, dirPath);
  // relative == "" --> root == dirPath will work
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    const tree = buildDirTree(dirPath);
    return { tree };
  } else {
    throw new H.WError(
      `Directory ${dirPath} is outside the project root and cannot be accessed.`,
      errorCode.WEBINIZER_DIR_OUTSIDE_ROOT
    );
  }
}

export function getBuildResult(root: string): ProjectResult {
  validateProjectRoot(root);
  const proj = new Project(root);
  return proj.result;
}

export function getTemplates(root: string): string[] {
  validateProjectRoot(root);
  const proj = new Project(root);
  return proj.getTemplateLiterals();
}

export function evalTemplates(root: string, v: string): string {
  validateProjectRoot(root);
  const proj = new Project(root);
  return proj.evalTemplateLiterals(v);
}

export async function getStatus(root: string): Promise<StatusType> {
  validateProjectRoot(root);
  const status = await buildStatus.getBuildStatus(root);
  return status;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function acceptProjectProfile(req: any, res: any) {
  await handleUploadProject(req, res);
}

export async function addProjectByGitClone(
  repoPath: string,
  configPart: H.Dict<unknown>
): Promise<string> {
  return cloneProject(repoPath, configPart);
}

export async function addProjectFromRegistry(
  spec: H.Dict<string>,
  config: H.Dict<unknown>
): Promise<string> {
  return fetchProjectFromRegistry(spec, config);
}

export function deleteProject(projPath: string): IProjectProfile[] {
  validateProjectRoot(projPath);
  deleteProjectSoftly(projPath);
  return getProfilesFromDetection();
}

export async function publishProject(root: string) {
  validateProjectRoot(root);
  const proj = new Project(root);
  await proj.publishToRegistry();
}

export async function searchProject(text: string): Promise<IPackageSearchResult[]> {
  return searchPackage(text);
}

export function getSettings(): IJsonObject {
  return Settings.toJson();
}

export async function updateSettings(jsonParts: H.Dict<unknown>): Promise<IJsonObject> {
  await Settings.updateSettings(jsonParts);
  return Settings.toJson();
}
