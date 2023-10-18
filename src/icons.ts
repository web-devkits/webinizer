import * as H from "./helper";
import fs from "graceful-fs";
import path from "path";
import { Project } from "./project";
import multiparty from "multiparty";
import errorCode from "./error_code";

const log = H.getLogger("icons");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleUploadIcon(root: string, req: any, res: any) {
  const multiParty = new multiparty.Form(req);
  multiParty.parse(req, async (err, fields, files) => {
    try {
      if (err) throw err;
      const fileName = path.parse(String(files.file[0].originalFilename)).name;
      const fileSize = Number(files.file[0].size);

      checkUploadIconType(files.file[0].path);
      checkIfFileSize(fileSize);

      const targetFilePath = constructIconPath(root, fileName);
      fs.renameSync(String(files.file[0].path), targetFilePath);

      // update project config
      const proj = new Project(root);
      // construct the request img resource url
      const imgURL = `http://${req.headers.host}/projects/${encodeURIComponent(
        root
      )}/icons/${path.basename(targetFilePath)}`;
      await proj.config.updateRawJson({
        img: imgURL,
      });
      res.status(200).json({ iconPath: imgURL });
      return;
    } catch (error) {
      log.error("upload project icon error\n", H.normalizeErrorOutput(error as Error));
      res.status(400).json(H.serializeError(error as Error));
      return;
    }
  });
}

async function checkUploadIconType(path: string) {
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
}

function checkIfFileSize(fileSize: number) {
  /* the size maximum is 1 MB */
  if (fileSize > 1024 * 1024) {
    throw new H.WError(
      `File's size reached the limit.`,
      errorCode.WEBINIZER_FILE_SIZE_REACHED_LIMIT
    );
  }
}

function constructUploadedIconsFolder(root: string): string {
  /** the icons of one project are stored under
   *  root/.webinizer/icons
   */
  // check if root/.webinizer exists, throw error if not
  if (!fs.existsSync(path.resolve(root, ".webinizer"))) {
    throw new H.WError("Project root path doesn't exist.", errorCode.WEBINIZER_ROOT_NOEXT);
  }

  const iconsStoredFolder = path.resolve(root, ".webinizer/icons");
  if (!fs.existsSync(iconsStoredFolder)) {
    fs.mkdirSync(iconsStoredFolder, { recursive: true });
  }
  return iconsStoredFolder;
}

function constructIconPath(root: string, fileName: string): string {
  const timestamp = new Date().toISOString().replace(/[^a-zA-Z0-9]/g, "");
  const uniqueTargetName = `${timestamp}-${fileName}`;
  return path.resolve(constructUploadedIconsFolder(root), uniqueTargetName);
}

/**
 * @param host : the host of the server
 * @param root : the root of project, it means to get default icons
 *               if the root is null
 *
 */
export function constructAllAvailableIcons(host: string, root?: string) {
  // get all default icons
  let icons: string[];
  const imageExtensions = [".png"];
  const prefix4Default = `http://${host}/assets/icons/default/`;
  const defaultIconFolderPath = path.resolve(__dirname, "assets/icons/default");
  const defaultIcons = fs
    .readdirSync(defaultIconFolderPath)
    .filter((file) => {
      const extname = path.extname(file).toLocaleLowerCase();
      return imageExtensions.includes(extname);
    })
    .map((icon) => prefix4Default + icon);
  icons = defaultIcons;

  // get uploaded icon under root/.webinizer/icons
  if (root && fs.existsSync(path.resolve(root, ".webinizer/icons"))) {
    const prefix4ProjIcon = `http://${host}/projects/${encodeURIComponent(root)}/icons/`;
    const projUploadIconFolderPath = path.resolve(root, ".webinizer/icons");
    const uploadIcons = fs
      .readdirSync(projUploadIconFolderPath)
      .map((icon) => prefix4ProjIcon + icon);
    icons = icons.concat(uploadIcons);
  }

  return icons;
}
