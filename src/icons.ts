/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import * as H from "./helper";
import fs from "graceful-fs";
import path from "path";
import { Project } from "./project";
import multiparty from "multiparty";
import errorCode from "./error_code";
import { IProjectIcon } from "webinizer";

const log = H.getLogger("icons");

const projectIconFolder = ".webinizer/icons";
const uploadIconsMaximumNumber = 10;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleUploadIcon(root: string, req: any, res: any) {
  const multiParty = new multiparty.Form(req);
  multiParty.parse(req, async (err, _, files) => {
    try {
      if (err) throw err;
      const fileName = path.parse(String(files.file[0].originalFilename)).base;
      const fileSize = Number(files.file[0].size);

      checkUploadIconType(files.file[0].path);
      checkFileSize(fileSize);

      // construct the project icons folder first
      const projUploadIconFolderPath = constructProjIconFolder(root);

      // the maximum icons number of each project is 10
      // maybe users put the image files into the folder manually
      while (!checkIconsNumber(projUploadIconFolderPath)) {
        // remove the earliest uploaded icon since the number has
        // reached the maximum.
        removeEarliestIcon(root, projUploadIconFolderPath);
      }

      const targetFilePath = constructIconPath(projUploadIconFolderPath, fileName);
      fs.renameSync(String(files.file[0].path), targetFilePath);

      // update project config
      const proj = new Project(root);
      const imgName = path.basename(targetFilePath);
      await proj.config.updateRawJson({
        img: { name: imgName, isUploaded: true },
      });

      res.status(200).json({ iconName: imgName });
      return;
    } catch (error) {
      log.error("upload project icon error\n", H.normalizeErrorOutput(error as Error));
      res.status(400).json(H.serializeError(error as Error));
      return;
    }
  });
}

function checkUploadIconType(path: string): boolean {
  const imageSignatures = [
    "ffd8ffe0", // JPEG
    "89504e47", //PNG
    "47494638", //GIF
  ];

  const buffer = fs.readFileSync(path);
  const fileSignature = buffer.toString("hex", 0, 8);

  if (!imageSignatures.some((signature) => fileSignature.startsWith(signature)))
    throw new H.WError(
      `Uploaded file's type is not allowed.`,
      errorCode.WEBINIZER_FILE_UNSUPPORTED_ENCODING
    );

  return true;
}

function checkFileSize(fileSize: number): boolean {
  /* the size maximum is 1 MB */
  if (fileSize > 1024 * 1024) {
    throw new H.WError(
      `File's size reached the limit.`,
      errorCode.WEBINIZER_FILE_SIZE_REACHED_LIMIT
    );
  }

  return true;
}

/**
 *  get the icons files under .webinizer/icons folder
 *  and check if the number reach the maximum
 */
function checkIconsNumber(iconDirPath: string): boolean {
  const existedIconsNumber = fs.readdirSync(iconDirPath).filter((file) => {
    try {
      return checkUploadIconType(path.resolve(iconDirPath, file));
    } catch (err) {
      return false;
    }
  }).length;

  return existedIconsNumber < uploadIconsMaximumNumber;
}

function constructProjIconFolder(root: string): string {
  /** the icons of one project are stored under
   *  root/.webinizer/icons
   */
  // check if root/.webinizer exists, throw error if not
  if (!fs.existsSync(path.resolve(root, ".webinizer"))) {
    throw new H.WError("Project root path doesn't exist.", errorCode.WEBINIZER_ROOT_NOEXT);
  }
  const projUploadIconFolderPath = path.resolve(root, projectIconFolder);

  if (!fs.existsSync(projUploadIconFolderPath)) {
    fs.mkdirSync(projUploadIconFolderPath, { recursive: true });
  }
  return projUploadIconFolderPath;
}

function removeEarliestIcon(root: string, iconDirPath: string) {
  let occupiedIcon = "";
  // get current used uploaded icon in config.json
  const proj = new Project(root);

  if (proj.config.img?.isUploaded) {
    occupiedIcon = proj.config.img.name;
  }

  // get all uploaded icons and sort them by uploaded time
  const iconFiles = fs
    .readdirSync(iconDirPath)
    .filter((file) => {
      try {
        return checkUploadIconType(path.resolve(iconDirPath, file));
      } catch (err) {
        return false;
      }
    })
    .filter((file) => {
      return file !== occupiedIcon;
    });

  iconFiles.sort((a, b) => {
    const aStat = fs.statSync(path.resolve(iconDirPath, a));
    const bStat = fs.statSync(path.resolve(iconDirPath, b));

    return new Date(aStat.birthtime).getTime() - new Date(bStat.birthtime).getTime();
  });

  fs.rmSync(path.resolve(iconDirPath, iconFiles[0]));
}

function constructIconPath(iconDirPath: string, fileName: string): string {
  const timestamp = new Date().toISOString().replace(/[^a-zA-Z0-9]/g, "");
  const uniqueTargetName = `${timestamp}-${fileName}`;
  return path.resolve(iconDirPath, uniqueTargetName);
}

/**
 * @param host : the host of the server
 * @param root : the root of project, it means to get default icons
 *               if the root is null
 *
 */
export function constructAllAvailableIcons(root?: string): IProjectIcon[] {
  // get all default icons
  let icons: IProjectIcon[];
  const defaultIconFolderPath = path.resolve(__dirname, "assets/icons/default");
  const defaultIcons = fs
    .readdirSync(defaultIconFolderPath)
    .filter((file) => {
      // only images files can be kept
      try {
        return checkUploadIconType(path.resolve(defaultIconFolderPath, file));
      } catch (err) {
        return false;
      }
    })
    .map((icon) => {
      return { name: icon, isUploaded: false };
    });
  icons = defaultIcons;

  // get uploaded icon under root/.webinizer/icons
  if (root && fs.existsSync(path.resolve(root, projectIconFolder))) {
    const projUploadIconFolderPath = path.resolve(root, projectIconFolder);
    const uploadIcons = fs
      .readdirSync(projUploadIconFolderPath)
      .filter((file) => {
        try {
          return checkUploadIconType(path.resolve(projUploadIconFolderPath, file));
        } catch (err) {
          return false;
        }
      })
      .map((icon) => {
        return { name: icon, isUploaded: true };
      });
    icons = uploadIcons.concat(icons);
  }

  return icons;
}

/**
 *
 * @param host
 * @param root
 * @param iconURL the http request URL of this icon
 * @returns
 */
export function removeIcon(root: string, iconURL: string): IProjectIcon[] {
  // resolve the iconURL to avoid that the `..` is the last part
  const absIconURL = path.resolve(iconURL);
  const iconPath = path.resolve(root, projectIconFolder, path.basename(absIconURL));

  if (!fs.existsSync(iconPath)) {
    throw new H.WError(`File doesn't exist.`, errorCode.WEBINIZER_FILE_NOEXT);
  }

  fs.rmSync(iconPath);
  return constructAllAvailableIcons(root);
}
