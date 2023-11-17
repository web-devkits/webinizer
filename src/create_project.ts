/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "graceful-fs";
import * as H from "./helper";
import * as C from "./constants";
import * as _ from "lodash";
import Path from "path";
import multiparty from "multiparty";
import AdmZip from "adm-zip";
import errorCode from "./error_code";
import { Project } from "./project";
import { getPackageFetcher } from "./package_manager/fetcher";

const log = H.getLogger("create_project");
const enum UploadStatus {
  processing = "processing",
  done = "done",
}

export async function handleUploadProject(req: any, res: any) {
  const multiParty = new multiparty.Form(req);

  multiParty.parse(req, async (err, fields, files) => {
    try {
      if (err) throw err;
      /* parse form data successfully, get fields valve from `fields`*/
      const index = Number(fields.index);
      const uploadedSize = Number(fields.uploadedSize);
      const totalSize = Number(fields.totalSize);
      const chunkSize = Number(fields.chunkSize);
      const type = String(fields.type);
      const startTime = String(fields.startTime);

      /* get project details from fields */
      const projectName = String(fields.projectName);
      const projectVersion = String(fields.projectVersion);
      const projectDesc = String(fields.projectDesc);
      const projectIsLib = String(fields.projectIsLib) === "true" ? true : false;
      const projectDependencies = JSON.parse(String(fields.projectDependencies));
      const projImg = String(fields.img);

      /* get files details from `files`*/
      const fileFullName = String(files.file[0].originalFilename);
      const fileBaseName = Path.parse(fileFullName).name;
      const fileSize = Number(files.file[0].size);
      const temFilePath = String(files.file[0].path);
      let projRoot = Path.resolve(C.projectPool, fileBaseName);

      /**NOTE - should check if uploaded file's type meets requirement
       *      - should check if this project exists in
       *        projects pool path(/projects)
       */
      checkUploadedFileType(type);

      const targetName = generateValidProjFolderName(projRoot);
      /* reassign the project root since the target name may change */
      projRoot = Path.resolve(C.projectPool, targetName);

      /* construct the uploaded directory tree */
      const chunkDirPath = constructUploadedProjFolder(fileBaseName, startTime);

      /**NOTE - each chunk file is saved temporarily under /tmp
       *        directory, so we could just move it into constructed
       *        chunk directory
       * */
      fs.renameSync(temFilePath, Path.resolve(chunkDirPath, String(index)));

      /**NOTE -  merge chunks if the all chunks arrived, read each
       *         chunk then write into target.
       *         target file will be created and saved under current
       *         set up UPLOAD_PROJECT_REPO_PATH.
       */
      if (uploadedSize + fileSize === totalSize) {
        try {
          await mergeChunksIntoTarget(
            chunkDirPath,
            Path.resolve(C.UPLOAD_PROJECT_REPO_PATH, fileBaseName),
            chunkSize
          );
          extractTargetZipFile(
            Path.resolve(C.UPLOAD_PROJECT_REPO_PATH, fileBaseName),
            fileBaseName,
            targetName
          );

          /* git init the project for tracking */
          const gitInitResults = await H.runCommand(
            "git init && git add . && git commit -m 'first commit'",
            { cwd: projRoot, silent: true }
          );

          if (gitInitResults.code !== 0) {
            /**NOTE - should clear the project if error occurs
             *        cause the project folder has been extracted
             */
            throw new H.WError(
              `Initialize the project with git failed.`,
              errorCode.WEBINIZER_PROJ_INIT_FAIL
            );
          }

          /* update project config when creating project finish */
          const proj = new Project(projRoot);
          await proj.config.updateRawJson({
            name: projectName,
            version: projectVersion,
            desc: projectDesc,
            isLibrary: projectIsLib,
            dependencies: projectDependencies,
            img: projImg,
          });

          //TODO. do we need to check the existence of `package.json` and convert it to config.json?

          /* return Status.done when all actions finish */
          res
            .status(200)
            .json({ status: `${UploadStatus.done}`, path: encodeURIComponent(proj.root) });
          return;
        } catch (error) {
          /* remove the project folder */
          fs.rmSync(projRoot, { recursive: true, force: true });
          throw error as Error;
        } finally {
          fs.rmSync(C.UPLOAD_PROJECT_REPO_PATH, { recursive: true, force: true });
        }
      }

      /* if the response has been sent, then the headersSent will be true */
      if (!res.headersSent) {
        /* send back Status.process */
        res.status(200).json({ status: `${UploadStatus.processing}` });
      }
    } catch (error) {
      fs.rmSync(C.UPLOAD_PROJECT_REPO_PATH, { recursive: true, force: true });
      log.error("project initialization error\n", H.normalizeErrorOutput(error as Error));
      res.status(400).json(H.serializeError(error as Error));
      return;
    }
  });
}

/**
 * ALLOWED_UPLOADED_FILE_TYPE is defined in constant.ts
 * @param type The type of the uploaded file
 */
function checkUploadedFileType(type: string) {
  if (!C.ALLOWED_UPLOADED_FILE_TYPE.includes(type)) {
    throw new H.WError(
      `Uploaded file's type is not allowed.`,
      errorCode.WEBINIZER_FILE_UNSUPPORTED_ENCODING
    );
  }
}

function generateValidProjFolderName(origProjectPath: string): string {
  /** use the rename the project name with if the projectPath
   *  does not exist, otherwise rename with new one
   */
  const folderName = Path.basename(origProjectPath);
  if (!fs.existsSync(origProjectPath)) {
    return folderName;
  } else {
    const newFolderName = renameNewlyAddedProject(folderName);
    const newFolderPath = Path.resolve(C.projectPool, newFolderName);
    return generateValidProjFolderName(newFolderPath);
  }
}

/**
 * construct the chunk directory for each uploaded project file
 * to save each chunk
 * E.g: UPLOAD_PROJECT_REPO_PATH/fileName/2023-01-09_00:00:00/0|1|2...
 *
 * @param fileName file's name without extension
 * @param uploadStartTime used in naming chunks directory
 */
function constructUploadedProjFolder(fileName: string, uploadStartTime: string): string {
  const chunkDirPath = Path.resolve(C.UPLOAD_PROJECT_REPO_PATH, `${fileName}_${uploadStartTime}`);

  if (!fs.existsSync(chunkDirPath)) {
    fs.mkdirSync(chunkDirPath, { recursive: true });
  }
  return chunkDirPath;
}

/**
 *
 * @param chunkDirPath the path that saves chunks
 * @param targetFilePath the path the chunks will be merged into
 * @param setupChunkSize the setup size of each chunk, may not equal
 *                       to the uploaded chunk size
 */
async function mergeChunksIntoTarget(
  chunkDirPath: string,
  targetFilePath: string,
  setupChunkSize: number
): Promise<void> {
  const chunksArr = fs.readdirSync(chunkDirPath);
  /* sort the chunks order by index to ensure successfully merge  */
  chunksArr.sort((a, b) => {
    return Number(a) - Number(b);
  });

  const allPromise = Promise.all(
    chunksArr.map((chunk, index) => {
      return new Promise<void>((resolve) => {
        const chunkPath = Path.resolve(chunkDirPath, String(chunk));
        const readStream = fs.createReadStream(chunkPath);
        const writeStream = fs.createWriteStream(targetFilePath, { start: index * setupChunkSize });
        readStream.pipe(writeStream);
        readStream.on("end", () => {
          fs.unlinkSync(chunkPath);
          resolve();
        });
      });
    })
  );

  await allPromise;
  /* remove the chunk directory after merging */
  fs.rmdirSync(chunkDirPath);
}

/**
 * extract zip file to dest, note that if the project folder exists
 * and has been set `deleted` flag as true, should change top
 * folder name to new target name
 * @param path the path of the project zip file
 */
function extractTargetZipFile(path: string, sourceFolderName?: string, targetName?: string): void {
  /**NOTE - the uploaded file has no access yet, access right
   *        before extracting
   */
  fs.chmodSync(path, 0o755);
  const unZipper = new AdmZip(path);
  /**NOTE - be aware that the compress action maybe not the same
   *        such as, user may select to compress the project folder
   *        directly, or he may compress the whole files under the
   *        project folder, we should check the files in the archive
   *        before extracting
   */
  if (sourceFolderName !== targetName) {
    unZipper.getEntries().forEach((entry) => {
      /**NOTE - check if the zip file name equals to the top layer
       *        folder, we strictly set limitation here
       */
      const regX = new RegExp("^" + sourceFolderName + "");
      if (entry.entryName.match(regX) === null) {
        throw new H.WError(
          `Upload project package does not meet requirement.`,
          errorCode.WEBINIZER_PROJ_PACKAGE_INVALID
        );
      }
      entry.entryName = entry.entryName.replace(sourceFolderName as string, targetName as string);
    });
  }
  unZipper.extractAllTo(C.projectPool, true, true);
}

export async function cloneProject(repoPath: string, configPart: H.Dict<unknown>): Promise<string> {
  /*NOTE - should check if the project has existed under project
   *       pool directory
   */
  const extractNameCmd = `basename ${repoPath} .git`;
  const extractResult = await H.runCommand(extractNameCmd, { silent: true });
  if (extractResult.code !== 0) {
    throw new H.WError(
      `The repo's path is invalid.`,
      errorCode.WEBINIZER_PROJ_GIT_REPO_PATH_INVALID
    );
  }

  const repoName = extractResult.output.replace(/\n/gi, "");
  let projRoot = Path.resolve(C.projectPool, repoName);
  const targetName = generateValidProjFolderName(projRoot);
  /* reassign the project root since the target name may change */
  projRoot = Path.resolve(C.projectPool, targetName);
  try {
    const cmd = `git clone ${repoPath} ${projRoot}`;
    const cloneResult = await H.runCommand(cmd, { cwd: C.projectPool });
    if (cloneResult.code !== 0) {
      throw new H.WError(
        `Clone the project with git failed.`,
        errorCode.WEBINIZER_PROJ_GIT_CLONE_FAIL
      );
    }

    if (fs.existsSync(Path.join(projRoot, ".gitmodules"))) {
      // initialize submodules
      const initSubmodules = await H.runCommand("git submodule update --init --recursive", {
        cwd: projRoot,
      });
      if (initSubmodules.code !== 0) {
        throw new H.WError(
          `Initialize the project with git submodules failed.`,
          errorCode.WEBINIZER_PROJ_GIT_CLONE_FAIL
        );
      }
    }

    /* save the project config when project is cloned successfully */
    const proj = new Project(projRoot);
    await proj.config.updateRawJson(configPart);

    //TODO. do we need to check the existence of `package.json` and convert it to config.json?
    return projRoot;
  } catch (error) {
    /* remove the project folder if any error occurs */
    fs.rmSync(projRoot, { recursive: true, force: true });
    throw error as Error;
  }
}

export async function fetchProjectFromRegistry(
  spec: H.Dict<string>,
  config: H.Dict<unknown>
): Promise<string> {
  const packageFetcher = getPackageFetcher(
    { name: spec.name.trim(), reference: spec.version.trim() },
    {
      fullMetadata: true,
    }
  );
  const manifest = await packageFetcher.getManifest();
  // using name-version as the default name for this project
  let projRoot = Path.join(C.projectPool, `${manifest.name}-${manifest.version}`);
  const targetName = generateValidProjFolderName(projRoot);
  /* reassign the project root since the target name may change */
  projRoot = Path.resolve(C.projectPool, targetName);

  try {
    // fetch project and extract to local
    await packageFetcher.fetchPackage(projRoot);

    // git init project
    // FIXME. should we include config.json into git tree or not?
    const gitInitResults = await H.runCommand(
      "git init && git add . && git commit -m 'first commit'",
      { cwd: projRoot, silent: true }
    );
    if (gitInitResults.code !== 0) {
      throw new H.WError(
        `Initialize the project with git failed.`,
        errorCode.WEBINIZER_PROJ_INIT_FAIL
      );
    }
    const proj = new Project(projRoot);
    // convert package.json to config.json
    if (fs.existsSync(proj.meta.path)) {
      proj.meta.validateMetaSchema(_.cloneDeep(proj.meta.data));
      await proj.config.convertFromRegMeta();
    }
    // update other config part such as `img`, `isLibrary`, etc
    await proj.config.updateRawJson(config);
    return projRoot;
  } catch (error) {
    /* remove the project folder if any error occurs */
    fs.rmSync(projRoot, { recursive: true, force: true });
    throw error as Error;
  }
}

/**
 * @param projectName the name of project
 * @returns true if the project exist in recycle_bin
 *
 * if there are projects which have same name in
 * directory, should rename the new added(including upload & clone)
 * follow the format. ProjName__1 | 2 | 3
 */
function renameNewlyAddedProject(projectName: string): string {
  let newName = "";
  const suffix = "__1";
  const results = projectName.match(/((.+)__)(\d+)/);
  if (results) {
    const baseFolderName = results[1];
    const version = Number(results[3]) + 1;
    newName = baseFolderName + version;
  }
  return newName || projectName + suffix;
}
