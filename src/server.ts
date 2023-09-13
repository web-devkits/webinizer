/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import chalk from "chalk";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { param, body, matchedData } from "express-validator";
import * as H from "./helper";
import { init } from "./init";
import * as API from "./api";
import { IJsonObject } from "webinizer";

const log = H.getLogger("server");
const PORT = 16666;

async function startServer() {
  log.info("... initialization ...");
  await init();

  log.info("... start the server ...");
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(
    express.urlencoded({
      extended: true,
      limit: "50mb",
    })
  );
  app.use(cors());
  app.use(
    helmet({
      strictTransportSecurity: {
        maxAge: 31536000,
        includeSubDomains: true,
      },
    })
  );

  app.get("/api/projects/profile", async (req, res) => {
    log.info("--> get projects profile", req.body);
    try {
      const profiles = API.getProjectProfilesFromDetection();
      res.status(200).json({ profiles });
    } catch (e) {
      log.error("get projects profile error\n", H.normalizeErrorOutput(e as Error));
      res.status(400).json(H.serializeError(e as Error));
    }
  });

  app.post("/api/projects/zip-file", async (req, res) => {
    log.info("--> upload projects profile");
    try {
      await API.acceptProjectProfile(req, res);
    } catch (e) {
      log.error("upload projects profile error", H.normalizeErrorOutput(e as Error));
      res.status(400).json(H.serializeError(e as Error));
    }
  });

  app.post("/api/projects/github", body("repoPath").trim(), async (req, res) => {
    log.info("--> clone project with git");
    try {
      const data = matchedData(req);
      const path = await API.addProjectByGitClone(data.repoPath, req.body.config);
      res.status(200).json({ path: encodeURIComponent(path) });
    } catch (e) {
      log.error("git clone projects error", H.normalizeErrorOutput(e as Error));
      res.status(400).json(H.serializeError(e as Error));
    }
  });

  app.post("/api/projects/registry", async (req, res) => {
    log.info("--> fetch project from registry");
    try {
      const path = await API.addProjectFromRegistry(req.body.spec, req.body.config);
      res.status(200).json({ path: encodeURIComponent(path) });
    } catch (e) {
      log.error("fetch project from registry error", H.normalizeErrorOutput(e as Error));
      res.status(400).json(H.serializeError(e as Error));
    }
  });

  app.delete(
    "/api/projects/:root",
    param("root")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    async (req, res) => {
      log.info("--> delete project", req.params);
      try {
        const data = matchedData(req);
        const profiles = API.deleteProject(data.root);
        res.status(200).json({ profiles });
      } catch (e) {
        log.error("delete project error", H.normalizeErrorOutput(e as Error));
        res.status(400).json(H.serializeError(e as Error));
      }
    }
  );

  app.get(
    "/api/projects/:root/config",
    param("root")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    async (req, res) => {
      log.info("--> get project config", req.params?.root);
      try {
        const data = matchedData(req);
        const config = API.getProjectConfig(data.root);
        res.status(200).json(config.toJson());
      } catch (e) {
        log.error("get project config error\n", H.normalizeErrorOutput(e as Error));
        res.status(400).json(H.serializeError(e as Error));
      }
    }
  );

  app.put(
    "/api/projects/:root/config",
    param("root")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    body("config"),
    async (req, res) => {
      log.info("--> update project config", req.params, req.body);
      try {
        const data = matchedData(req);
        const config = await API.updatePartOfProjectConfig(data.root, data.config);
        res.status(200).json(config.toJson());
      } catch (e) {
        log.error("update project config error\n", H.normalizeErrorOutput(e as Error));
        res.status(400).json(H.serializeError(e as Error));
      }
    }
  );

  app.patch(
    "/api/projects/:root/config",
    param("root")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    async (req, res) => {
      log.info("--> reset project config", req.params);
      try {
        const data = matchedData(req);
        const config = await API.resetProjectConfig(data.root);
        res.status(200).json(config.toJson());
      } catch (e) {
        log.error("reset project config error\n", H.normalizeErrorOutput(e as Error));
        res.status(400).json(H.serializeError(e as Error));
      }
    }
  );

  app.put(
    "/api/projects/:root/config/build-options",
    param("root")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    body("config"),
    async (req, res) => {
      log.info(" --> update project build config", req.body);
      try {
        const data = matchedData(req);
        const config = await API.updateProjectBuildConfig(data.root, data.config);
        res.status(200).json(config.toJson());
      } catch (e) {
        log.error("update project build config error\n", H.normalizeErrorOutput(e as Error));
        res.status(400).json(H.serializeError(e as Error));
      }
    }
  );

  app.put(
    "/api/projects/:root/config/overall-envs-deps",
    param("root")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    async (req, res) => {
      log.info(" --> update project overallEnvs due to dependency update", req.params);
      try {
        const data = matchedData(req);
        const config = await API.updateOverallEnvsFromDeps(data.root);
        res.status(200).json(config.toJson());
      } catch (e) {
        log.error(
          "update project overallEnvs due to dependency update error\n",
          H.normalizeErrorOutput(e as Error)
        );
        res.status(400).json(H.serializeError(e as Error));
      }
    }
  );

  app.patch(
    "/api/projects/:root/advisor",
    param("root")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    body("advisor").trim(),
    async (req, res) => {
      log.info("--> disable advisor", req.params, req.body);
      try {
        const data = matchedData(req);
        const config = await API.disableAdvisorToUse(data.root, data.advisor);
        res.status(200).json(config.toJson());
      } catch (e) {
        log.error("disable advisor error\n", H.normalizeErrorOutput(e as Error));
        res.status(400).json(H.serializeError(e as Error));
      }
    }
  );

  app.get(
    "/api/projects/:root/builders/recommended-builders",
    param("root")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    async (req, res) => {
      log.info("--> recommend builders to use", req.params);
      try {
        const data = matchedData(req);
        const builders = API.recommendBuildersToUse(data.root);
        res.status(200).json({ builders: builders.map((b) => b.toJson()) });
      } catch (e) {
        log.error("recommend builders error\n", H.normalizeErrorOutput(e as Error));
        res.status(400).json(H.serializeError(e as Error));
      }
    }
  );

  app.get(
    "/api/projects/:root/builders",
    param("root")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    async (req, res) => {
      log.info("--> get all builders", req.params);
      try {
        const data = matchedData(req);
        const builders = API.getAllBuilders(data.root);
        res.status(200).json({ builders: builders.map((b) => b.toJson()) });
      } catch (e) {
        log.error("get all builders error\n", H.normalizeErrorOutput(e as Error));
        res.status(400).json(H.serializeError(e as Error));
      }
    }
  );

  app.post(
    "/api/projects/:root/construction",
    param("root")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    body("recipes"),
    async (req, res) => {
      log.info("--> build", req.params, req.body);
      try {
        const data = matchedData(req);
        const recipes = await API.build(
          data.root,
          data.recipes ? (data.recipes as IJsonObject[]) : null
        );
        res.status(200).json({ recipes: recipes.map((r) => r.toJson()) });
      } catch (e) {
        log.error("build error\n", H.normalizeErrorOutput(e as Error));
        if (
          (e as Error).name !== "WEBINIZER_ROOT_EMPTY" &&
          (e as Error).name !== "WEBINIZER_ROOT_NOEXT"
        ) {
          // reset build status to idle_default if exception happens during build
          await API.resetBuildStatus(String(decodeURIComponent(req.params?.root)).trim(), true);
        }
        res.status(400).json(H.serializeError(e as Error));
      }
    }
  );

  app.post(
    "/api/projects/:root/publication",
    param("root")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    async (req, res) => {
      log.info("--> publish project", req.params);
      try {
        const data = matchedData(req);
        await API.publishProject(data.root);
        res.status(200).json({ status: "success" });
      } catch (e) {
        log.error("publish error\n", H.normalizeErrorOutput(e as Error));
        res.status(400).json(H.serializeError(e as Error));
      }
    }
  );

  app.get(
    "/api/registry-packages/:words",
    param("words")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    async (req, res) => {
      log.info("--> search project", req.params);
      try {
        const data = matchedData(req);
        const result = await API.searchProject(data.words);
        res.status(200).json({ result });
      } catch (e) {
        log.error("search error\n", H.normalizeErrorOutput(e as Error));
        res.status(400).json(H.serializeError(e as Error));
      }
    }
  );

  app.get(
    "/api/projects/:root/recipes",
    param("root")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    async (req, res) => {
      log.info("--> get recipes from last build", req.params);
      try {
        const data = matchedData(req);
        const recipes = API.getRecipes(data.root);
        res.status(200).json({ recipes });
      } catch (e) {
        log.error("get recipes error\n", H.normalizeErrorOutput(e as Error));
        res.status(400).json(H.serializeError(e as Error));
      }
    }
  );

  app.get(
    "/api/projects/:root/files/:name",
    param("root")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    param("name")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    async (req, res) => {
      log.info("--> get file content");
      try {
        const data = matchedData(req);
        const content = await API.getFileContent(data.root, data.name);
        res.status(200).json({
          name: data.name,
          content: content,
        });
      } catch (e) {
        log.error("get file content error\n", H.normalizeErrorOutput(e as Error));
        res.status(400).json(H.serializeError(e as Error));
      }
    }
  );

  app.put(
    "/api/projects/:root/files/:name",
    param("root")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    param("name")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    body("content").trim(),
    async (req, res) => {
      log.info("--> update file content");
      try {
        const data = matchedData(req);
        log.info(`data.content is`, data.content);
        const updatedContent = await API.updateFileContent(data.root, data.name, data.content);
        res.status(200).json({
          name: data.name,
          content: updatedContent,
        });
      } catch (e) {
        log.error("update file content error\n", H.normalizeErrorOutput(e as Error));
        res.status(400).json(H.serializeError(e as Error));
      }
    }
  );

  app.post(
    "/api/projects/:root/files",
    param("root")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    body("name")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    body("content").trim(),
    async (req, res) => {
      log.info("--> create new file", req.params, req.body);
      try {
        const data = matchedData(req);
        await API.createNewFile(data.root, data.name, data.content);
        res.status(200).json({
          name: encodeURIComponent(data.name),
          content: data.content,
        });
      } catch (e) {
        log.error("create new file error\n", H.normalizeErrorOutput(e as Error));
        res.status(400).json(H.serializeError(e as Error));
      }
    }
  );

  app.get(
    "/api/projects/:root/directory-tree/:dir",
    param("root")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    param("dir")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    async (req, res) => {
      log.info("--> get directory tree");
      try {
        const data = matchedData(req);
        const directoryTree = API.getDirTree(data.root, data.dir);
        res.status(200).json(directoryTree);
      } catch (e) {
        log.error("get directory tree error\n", H.normalizeErrorOutput(e as Error));
        res.status(400).json(H.serializeError(e as Error));
      }
    }
  );

  app.get(
    "/api/projects/:root/construction/logs",
    param("root")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    async (req, res) => {
      log.info("--> get build log");
      try {
        const data = matchedData(req);
        const content = API.getBuildLog(data.root);
        res.status(200).json({ content });
      } catch (e) {
        log.error("get build log error\n", H.normalizeErrorOutput(e as Error));
        res.status(400).json(H.serializeError(e as Error));
      }
    }
  );

  app.get(
    "/api/projects/:root/construction/results",
    param("root")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    async (req, res) => {
      log.info("--> get build results");
      try {
        const data = matchedData(req);
        const result = API.getBuildResult(data.root);
        res.status(200).json(result.toJson());
      } catch (e) {
        log.error("get build result error\n", H.normalizeErrorOutput(e as Error));
        res.status(400).json(H.serializeError(e as Error));
      }
    }
  );

  app.get(
    "/api/projects/:root/construction/status",
    param("root")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    async (req, res) => {
      log.info("--> get build status");
      try {
        const data = matchedData(req);
        const status = await API.getStatus(data.root);
        res.status(200).json({ status });
      } catch (e) {
        log.error("get build status error\n", H.normalizeErrorOutput(e as Error));
        res.status(400).json(H.serializeError(e as Error));
      }
    }
  );

  app.get(
    "/api/projects/:root/templates",
    param("root")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    async (req, res) => {
      log.info("--> get available template literals");
      try {
        const data = matchedData(req);
        const templates = API.getTemplates(data.root);
        res.status(200).json({ templates });
      } catch (e) {
        log.error("get template literals error\n", H.normalizeErrorOutput(e as Error));
        // #swagger.responses[400]
        res.status(400).json(H.serializeError(e as Error));
      }
    }
  );

  app.get(
    "/api/projects/:root/templates/:template/evaluation-literals",
    param("root")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    param("template")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    async (req, res) => {
      log.info("--> evaluate template literals");
      try {
        const data = matchedData(req);
        const val = API.evalTemplates(data.root, data.template);
        res.status(200).json({ val });
      } catch (e) {
        log.error("evaluate template literals error\n", H.normalizeErrorOutput(e as Error));
        res.status(400).json(H.serializeError(e as Error));
      }
    }
  );

  app.get("/api/settings", async (req, res) => {
    log.info("--> get webinizer settings");
    try {
      const settings = API.getSettings();
      res.status(200).json(settings);
    } catch (e) {
      log.error("get webinizer setting error\n", H.normalizeErrorOutput(e as Error));
      res.status(400).json(H.serializeError(e as Error));
    }
  });

  app.post("/api/settings", body("settingParts"), async (req, res) => {
    log.info("--> update webinizer settings");
    try {
      const data = matchedData(req);
      const settings = await API.updateSettings(data.settingParts);
      res.status(200).json(settings);
    } catch (e) {
      log.error("update webinizer setting error\n", H.normalizeErrorOutput(e as Error));
      res.status(400).json(H.serializeError(e as Error));
    }
  });

  app.listen(PORT, () => log.warn(`Server started at port ${chalk.redBright(PORT)}...`));
}

startServer();
