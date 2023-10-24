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
      crossOriginResourcePolicy: {
        policy: "cross-origin",
      },
    })
  );

  app.use("/assets/icons", express.static(__dirname + "/assets/icons"));

  app.get(
    "/api/projects/:root/icons/:name",
    param("root")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    param("name")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    (req, res) => {
      // #swagger.tags = ['Icons']
      // #swagger.operationId = '/api/projects/{root}/icons/{name}/get'
      // #swagger.description = 'Get the icon file.'

      /*
        #swagger.parameters['root'] = {
            in: 'path',
            description: 'Project root',
            type: 'string'
        }

        #swagger.parameters['name'] = {
            in: 'path',
            description: 'Project icon url',
            type: 'string'
        }
      */

      /*
        #swagger.responses[200] = {
            description: "Projects' icons object array",
            content: {
                "application/json": {
                    schema:{
                        $ref: "#/components/schemas/iconURL"
                    }
                }
            }
        }

        #swagger.responses[400]
      */
      const data = matchedData(req);
      const filePath = API.constructIconPath(data.root, data.name);
      res.sendFile(filePath);
    }
  );

  app.delete(
    "/api/projects/:root/icons/:name",
    param("root")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    param("name")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    (req, res) => {
      try {
        // #swagger.tags = ['Icons']
        // #swagger.operationId = '/api/projects/{root}/icons/{name}/delete'
        // #swagger.description = 'Delete the icon of the project.'

        /*
          #swagger.parameters['root'] = {
              in: 'path',
              description: 'Project root',
              type: 'string'
          }

          #swagger.parameters['name'] = {
              in: 'path',
              description: 'Project icon url',
              type: 'string'
          }
        */

        /*
          #swagger.responses[200] = {
              description: "Projects' icons object array",
              content: {
                  "application/json": {
                      schema:{
                          $ref: "#/components/schemas/icons"
                      }
                  }
              }
          }

          #swagger.responses[400]
        */
        const data = matchedData(req);
        const iconsObjArr = API.removeIconOf1Project(data.root, data.name);
        res.status(200).json(iconsObjArr);
      } catch (e) {
        log.error("delete projects icon error\n", H.normalizeErrorOutput(e as Error));
        res.status(400).json(H.serializeError(e as Error));
      }
    }
  );

  app.get("/api/projects/icons", (req, res) => {
    try {
      // #swagger.tags = ['Icons']
      // #swagger.operationId = '/api/projects/icons/get'
      // #swagger.description = 'Get all available icons of one project.'

      /*
        #swagger.parameters['root'] = {
            in: 'query',
            required: false,
            description: 'Project root',
            type: 'string'
        }
      */

      /*
        #swagger.responses[200] = {
            description: "Projects' icons object array",
            content: {
                "application/json": {
                    schema:{
                        $ref: "#/components/schemas/icons"
                    }
                }
            }
        }

        #swagger.responses[400]
      */
      const root = decodeURIComponent(String(req.query.root).trim());
      const iconsObjArr = API.getAllAvailableIcons(root);
      res.status(200).json(iconsObjArr);
    } catch (e) {
      log.error("get projects icons error\n", H.normalizeErrorOutput(e as Error));
      res.status(400).json(H.serializeError(e as Error));
    }
  });

  app.get("/api/projects/profile", async (req, res) => {
    // #swagger.tags = ['Profile']
    // #swagger.operationId = '/api/projects/profile/get'
    // #swagger.description = 'Get all projects' profile.'

    /*
      #swagger.responses[200] = {
          description: "Projects' profile array",
          content: {
              "application/json": {
                  schema:{
                      $ref: "#/components/schemas/profile"
                  }
              }
          }
      }

      #swagger.responses[400]
    */

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
    // #swagger.tags = ['Projects']
    // #swagger.operationId = '/api/projects/zip-file/post'
    // #swagger.description = 'Create project by uploading zip file.'

    /*
      #swagger.requestBody = {
          required: true,
          content: {
              "multipart/form-data": {
                  'schema': {
                      "type": "object",
                      "properties": {
                          "totalSize": {
                              "type": "integer",
                              "example": "512000",
                              "description": "The size of file(byte). Please set it with the real file size"
                          },

                          "type":{
                              "type":"string",
                              "example":"application/x-zip-compressed",
                              "description": "The uploaded file type. Please always set it as example"
                          },

                          "uploadedSize": {
                              "type": "integer",
                              "example": "0",
                              "description": "The size of uploaded part(byte), please set it with 0 always"
                          },

                          "chunkSize": {
                              "type": "integer",
                              "example": "1024000",
                              "description": "The size of chunk, please set it larger than ${totalSize} always"
                          },

                          "startTime": {
                              "type": "string",
                              "example":"2023-01-01",
                              "description": "The time of the uploading action"
                          },

                          "projectName": {
                              "type": "string",
                              "example":"tetris",
                              "description": "The name of the project"
                          },

                          "projectVersion": {
                              "type": "string",
                              "example": "1.0.0",
                              "description": "The version of the project"
                          },
                          "projectDesc": {
                              "type": "string",
                              "example": "tetris workload",
                              "description": "The description of the project"
                          },
                          "projectIsLib": {
                              "type": "string",
                              "example": "true",
                              "description": "true OR false"
                          },
                          "projImg": {
                              "type": "string",
                              "example": "../assets/basic/preseticons/192x192/t.png",
                              "description": "The image path"
                          },

                          "projectDependencies": {
                              "type": "object",
                              "example": "{}",
                              "description": "The dependencies object of the project"
                          },

                          "file": {
                              "type": "string",
                              "format": "binary"
                          }
                      },

              "required": ["totalSize", "type", "uploadedSize", "chunkSize", "startTime", "projectName", "projectVersion", "projectDesc", "projectIsLib", "projImg", "file"],
            }
          }
        }
      }

      #swagger.responses[400]
    */
    log.info("--> upload projects profile");
    try {
      await API.acceptProjectProfile(req, res);
    } catch (e) {
      log.error("upload projects profile error", H.normalizeErrorOutput(e as Error));
      res.status(400).json(H.serializeError(e as Error));
    }
  });

  app.post(
    "/api/projects/:root/icons",
    param("root")
      .trim()
      .customSanitizer((v) => decodeURIComponent(v)),
    async (req, res) => {
      // #swagger.tags = ['Icons']
      // #swagger.operationId = '/api/projects/{root}/icons/post'
      // #swagger.description = 'Upload icon for the project.'

      /*
        #swagger.requestBody = {
            required: true,
            content: {
                "multipart/form-data": {
                    'schema': {
                        "type": "object",
                        "properties": {
                            "file": {
                                "type": "string",
                                "format": "binary"
                            }
                        },
                    }
                }
            }
        }

        #swagger.responses[400]
      */

      log.info("--> upload projects icon");
      try {
        const data = matchedData(req);
        await API.acceptProjectIcon(data.root, req, res);
      } catch (e) {
        log.error("upload projects profile error", H.normalizeErrorOutput(e as Error));
        res.status(400).json(H.serializeError(e as Error));
      }
    }
  );

  app.post("/api/projects/github", body("repoPath").trim(), async (req, res) => {
    // #swagger.tags = ['Projects']
    // #swagger.operationId = '/api/projects/github/post'
    // #swagger.description = 'Create project by cloning from github'

    /*
      #swagger.requestBody = {
          required: true,
          content: {
              "application/json": {
                  schema: {
                      $ref: "#/components/schemas/githubProject"
                  }
              }
          }
      }

      #swagger.responses[200] = {
          description: "Project root path.",
          content: {
              "application/json": {
                  schema:{
                      $ref: "#/components/schemas/responseGitHubPath"
                  }
              }
          }
      }

      #swagger.responses[400]
    */
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
    // #swagger.tags = ['Projects']
    // #swagger.operationId = '/api/projects/registry/post'
    // #swagger.description = 'Create project by pulling from registry'

    /*
      #swagger.requestBody = {
          required: true,
          content: {
              "application/json": {
                  schema: {
                      $ref: "#/components/schemas/requestRegistry"
                  }
              }
          }
      }

      #swagger.responses[200] = {
          description: "Project root path",
          content: {
              "application/json": {
                  schema:{
                      $ref: "#/components/schemas/responseRegistry"
                  }
              }
          }
      }

      #swagger.responses[400]
    */
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
      // #swagger.tags = ['Projects']
      // #swagger.operationId = '/api/projects/{root}/delete'
      // #swagger.description = 'Delete the project'

      /*
        #swagger.parameters['root'] = {
            in: "path",
            description: "Project root",
            required: true,
            type: "string"
        }

        #swagger.responses[200] = {
            description: "Deleted project profile.",
            content: {
                "application/json": {
                    schema:{
                        $ref: "#/components/schemas/profile"
                    }
                }
            }
        }

        #swagger.responses[400]
      */
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
      // #swagger.tags = ['Config']
      // #swagger.operationId = '/api/projects/{root}/config/get'
      // #swagger.description = 'Get the project's config'

      /*
        #swagger.parameters['root'] = {
            in: "path",
            description: "Project root",
            required: true,
            type: "string"
        }

        #swagger.responses[200] = {
            description: "Project root path.",
            content: {
                "application/json": {
                    schema:{
                        $ref: "#/components/schemas/responseConfig"
                    }
                }
            }
        }

        #swagger.responses[400]
      */
      log.info("--> get project config", req.params);
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
      // #swagger.tags = ['Config']
      // #swagger.operationId = '/api/projects/{root}/config/put'
      // #swagger.description = 'Update the project's config'

      /*
        #swagger.parameters['root'] = {
            in: "path",
            description: "Project root",
            required: true,
            type: "string"
        }

        #swagger.requestBody = {
            required: true,
            content: {
                "application/json": {
                    schema: {
                        $ref: "#/components/schemas/requestConfigUpdate"
                    }
                }
            }
        }

        #swagger.responses[200] = {
            description: "Project's config.",
            content: {
                "application/json": {
                    schema:{
                        $ref: "#/components/schemas/responseConfig"
                    }
                }
            }
        }

        #swagger.responses[400]
      */
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
      // #swagger.tags = ['Config']
      // #swagger.operationId = '/api/projects/{root}/config/patch'
      // #swagger.description = 'Reset the project's config'

      /*
        #swagger.parameters['root'] = {
            in: "path",
            description: "Project root",
            required: true,
            type: "string"
        }

        #swagger.responses[200] = {
            description: "Project's config",
            content: {
                "application/json": {
                    schema:{
                        $ref: "#/components/schemas/responseConfig"
                    }
                }
            }
        }

        #swagger.responses[400]
      */
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
      // #swagger.tags = ['Config']
      // #swagger.operationId = '/api/projects/{root}/config/build-options/put'
      // #swagger.description = 'Update one project's build option config'

      /*
        #swagger.parameters['root'] = {
            in: "path",
            description: "Project root",
            required: true,
            type: "string"
        }

        #swagger.requestBody = {
            required: true,
            content: {
                "application/json": {
                    schema: {
                        $ref: "#/components/schemas/requestBuildOption"
                    }
                }
            }
        }

        #swagger.responses[200] = {
            description: "Project's config.",
            content: {
                "application/json": {
                    schema:{
                        $ref: "#/components/schemas/responseConfig"
                    }
                }
            }
        }

        #swagger.responses[400]
      */
      log.info(" --> update project build config", req.params, req.body);
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
      // #swagger.tags = ['Config']
      // #swagger.operationId = '/api/projects/{root}/config/overall-envs-deps/put'
      // #swagger.description = 'Update one project's overall option config'

      /*
        #swagger.parameters['root'] = {
            in: "path",
            description: "Project root",
            required: true,
            type: "string"
        }

        #swagger.responses[200] = {
            description: "Project's config.",
            content: {
                "application/json": {
                    schema:{
                        $ref: "#/components/schemas/responseConfig"
                    }
                }
            }
        }

        #swagger.responses[400]
      */
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
      // #swagger.tags = ['Advisor']
      // #swagger.operationId = '/api/projects/{root}/advisor/patch"
      // #swagger.description = 'Disable the advisor for the project.'

      /*
        #swagger.parameters['root'] = {
            in: "path",
            description: "Project root",
            required: true,
            type: "string"
        }

        #swagger.requestBody = {
            required: true,
            content: {
                "application/json": {
                    schema: {
                        $ref: "#/components/schemas/requestDisableAdvisor"
                    }
                }
            }
        }

        #swagger.responses[200] = {
              description: "Project root path.",
              content: {
                  "application/json": {
                      schema:{
                          $ref: "#/components/schemas/responseConfig"
                      }
                  }
              }
        }

        #swagger.responses[400]
      */
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
      // #swagger.tags = ['Builders']
      // #swagger.operationId = '/api/projects/{root}/builders/recommended-builders/get'
      // #swagger.description = 'Get recommended builders of one project.'

      /*
        #swagger.parameters['root'] = {
            in: "path",
            description: "Project root",
            required: true,
            type: "string"
        }

        #swagger.responses[200] = {
            description: "Project's builders list.",
            content: {
                "application/json": {
                    schema:{
                        $ref: "#/components/schemas/responseAllBuilders"
                    }
                }
            }
        }

        #swagger.responses[400]
      */
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
      // #swagger.tags = ['Builders']
      // #swagger.operationId = '/api/projects/{root}/builders/get'
      // #swagger.description = 'Get all builders of the project'

      /*
        #swagger.parameters['root'] = {
            in: "path",
            description: "Project root",
            required: true,
            type: "string"
        }

        #swagger.responses[200] = {
            description: "Project's builders list.",
            content: {
                "application/json": {
                    schema:{
                        $ref: "#/components/schemas/responseAllBuilders"
                    }
                }
            }
        }

        #swagger.responses[400]
      */
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
      // #swagger.tags = ['Construction']
      // #swagger.operationId = '/api/projects/:root/constructions/post'
      // #swagger.description = 'Trigger the build process'

      /*
        #swagger.parameters['root'] = {
            in: "path",
            description: "Project root",
            required: true,
            type: "string"
        }

        #swagger.requestBody = {
            required: true,
            content: {
                "application/json": {
                    schema: {
                        $ref: "#/components/schemas/requestRecipes"
                    }
                }
            }
        }

        #swagger.responses[200] = {
            content: {
                "application/json": {
                    schema:{
                        $ref: "#/components/schemas/responseRecipes"
                    }
                }
            }
        }

        #swagger.responses[400]
      */
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
      // #swagger.tags = ['Publication']
      // #swagger.operationId = '/api/projects/{root}/publication'
      // #swagger.description = 'Publish the project to the registry server.'

      /*
        #swagger.parameters['root'] = {
            in: "path",
            description: "Project root",
            required: true,
            type: "string"
        }

        #swagger.responses[200] = {
            content: {
                "application/json": {
                    schema:{
                        $ref: "#/components/schemas/responsePublication"
                    }
                }
            }
        }

        #swagger.responses[400]
      */
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
      // #swagger.tags = ['Registry']
      // #swagger.operationId = '/api/registry-packages/{words}/get'
      // #swagger.description = 'Get the matched packages in registry server'

      /*
        #swagger.parameters['words'] = {
            in: "path",
            description: "Project words",
            required: true,
            schema:{
                $ref: "#/components/schemas/requestRegistryPackage"
            }
        }

        #swagger.responses[200] = {
            content: {
                "application/json": {
                    schema:{
                        $ref: "#/components/schemas/responseRegistryPackage"
                    }
                }
            }
        }

        #swagger.responses[400]
      */
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
      // #swagger.tags = ['Recipes']
      // #swagger.operationId = '/api/projects/{root}/recipes/get'
      // #swagger.description = 'Get the recipes of the project.'

      /*
        #swagger.parameters['root'] = {
            in: "path",
            description: "Project root",
            required: true,
            type: "string"
        }

        #swagger.responses[200] = {
            content: {
                "application/json": {
                    schema:{
                        $ref: "#/components/schemas/responseRecipes"
                    }
                }
            }
        }

        #swagger.responses[400]
      */
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
      // #swagger.tags = ['File']
      // #swagger.operationId = '/api/projects/{root}/files/{name}/get'
      // #swagger.description = 'Get the file's content'

      /*
      #swagger.parameters['root'] = {
          in: "path",
          description: "Project root",
          required: true,
          type: "string"
      }

      #swagger.parameters['name'] = {
          in: "path",
          description: "File name",
          required: true,
          type: "string"
      }

      #swagger.responses[200] = {
          description: "File's name and content.",
          content: {
              "application/json": {
                  schema:{
                      $ref: "#/components/schemas/responseFileContent"
                  }
              }
          }
      }

      #swagger.responses[400]
    */
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
      // #swagger.tags = ['File']
      // #swagger.operationId = '/api/projects/{root}/files/{name}/put'
      // #swagger.description = 'Update the file content'

      /*
        #swagger.parameters['root'] = {
            in: "path",
            description: "Project root",
            required: true,
            type: "string"
        }

        #swagger.parameters['name'] = {
            in: "path",
            description: "File name",
            required: true,
            type: "string"
        }

        #swagger.requestBody = {
            required: true,
            content: {
                "application/json": {
                    schema: {
                        $ref: "#/components/schemas/requestFileContent"
                    }
                }
            }
        }

        #swagger.responses[200] = {
            description: "File's name and content.",
            content: {
                "application/json": {
                    schema:{
                        $ref: "#/components/schemas/responseFileContent"
                    }
                }
            }
        }

        #swagger.responses[400]
      */
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
      // #swagger.tags = ['File']
      // #swagger.operationId = '/api/projects/{root}/files/post'
      // #swagger.description = 'Create the file content.'

      /*
        #swagger.parameters['root'] = {
            in: "path",
            description: "Project root",
            required: true,
            type: "string"
        }

        #swagger.requestBody = {
            required: true,
            content: {
                "application/json": {
                    schema: {
                        $ref: "#/components/schemas/requestNewFile"
                    }
                }
            }
        }

        #swagger.responses[200] = {
            description: "File's path and content",
            content: {
                "application/json": {
                    schema:{
                        $ref: "#/components/schemas/responseFileContent"
                    }
                }
            }
        }

        #swagger.responses[400]
      */
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
      // #swagger.tags = ['File']
      // #swagger.operationId = '/api/projects/{root}/directory-tree/{dir}/get'
      // #swagger.description = 'Get 1 depth directory tree of the dir.'

      /*
        #swagger.parameters['root'] = {
            in: "path",
            description: "Project root",
            required: true,
            type: "string"
        }

        #swagger.parameters['dir'] = {
            in: "path",
            description: "Project directory",
            required: true,
            schema: {
                $ref: "#/components/schemas/requestRegistryProjRoot"
            }
        }

        #swagger.responses[200] = {
            description: "Project's directory tree.",
            content: {
                "application/json": {
                    schema:{
                        $ref: "#/components/schemas/responseDirectoryTree"
                    }
                }
            }
        }

        #swagger.responses[400]
      */
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
      // #swagger.tags = ['Build']
      // #swagger.operationId = '/api/projects/{root}/construction/logs/get'
      // #swagger.description = 'Get the build logs.'

      /*
        #swagger.parameters['root'] = {
            in: "path",
            description: "Project root",
            required: true,
            type: "string"
        }

        #swagger.responses[200] = {
            description: "Build log content",
            content: {
                "application/json": {
                    schema:{
                        $ref: "#/components/schemas/responseBuildResults"
                    }
                }
            }
        }

        #swagger.responses[400]
      */
      log.info("--> get build log");
      try {
        const data = matchedData(req);
        // eslint-disable-next-line no-control-regex
        const content = API.getBuildLog(data.root).replace(/\u001b/g, "\\u001b");
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
      // #swagger.tags = ['Build']
      // #swagger.operationId = '/api/projects/{root}/construction/results/get'
      // #swagger.description = 'Get the build results'

      /*
        #swagger.parameters['root'] = {
            in: "path",
            description: "Project root",
            required: true,
            type: "string"
        }

        #swagger.responses[200] = {
            description: "Build results",
            content: {
                "application/json": {
                    schema:{
                        $ref: "#/components/schemas/responseBuildResults"
                    }
                }
            }
        }

        #swagger.responses[400]
      */
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
      // #swagger.tags = ['Build']
      // #swagger.operationId = '/api/projects/{root}/construction/status/get'
      // #swagger.description = 'Get the build status'

      /*
        #swagger.parameters['root'] = {
            in: "path",
            description: "Project root",
            required: true,
            type: "string"
        }

        #swagger.responses[200] = {
            description: "Build status",
            content: {
                "application/json": {
                    schema:{
                        $ref: "#/components/schemas/responseBuildStatus"
                    }
                }
            }
        }

        #swagger.responses[400]
      */

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
      // #swagger.tags = ['Projects']
      // #swagger.operationId = '/api/projects/{root}/templates/get'
      // #swagger.description = 'Get available template literals.'

      /*
        #swagger.parameters['root'] = {
            in: "path",
            description: "Project root",
            required: true,
            type: "string"
        }

        #swagger.responses[200] = {
            description: "Template literals.",
            content: {
                "application/json": {
                    schema:{
                        $ref: "#/components/schemas/responseTemplate"
                    }
                }
            }
        }

        #swagger.responses[400]
      */
      log.info("--> get available template literals");
      try {
        const data = matchedData(req);
        const templates = API.getTemplates(data.root);
        res.status(200).json({ templates });
      } catch (e) {
        log.error("get template literals error\n", H.normalizeErrorOutput(e as Error));
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
      // #swagger.tags = ['Projects']
      // #swagger.operationId = '/api/projects/{root}/templates/{template}/evaluation-literals/get'
      // #swagger.description = 'Get template evaluation literals.'

      /*
        #swagger.parameters['root'] = {
            in: "path",
            description: "Project root",
            required: true,
            type: "string"
        }

        #swagger.parameters['template'] = {
            in: "path",
            description: "Template",
            required: true,
            schema: {
                $ref: "#/components/schemas/requestTemplateEval"
            }
        }

        #swagger.responses[200] = {
            description: "Template literals evaluation.",
            content: {
                "application/json": {
                    schema:{
                        $ref: "#/components/schemas/responseTemplateEval"
                    }
                }
            }
        }

        #swagger.responses[400]
      */
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
    // #swagger.tags = ['Settings']
    // #swagger.operationId = '/api/settings/get'
    // #swagger.description = 'Get global webinizer settings'

    /*
      #swagger.responses[200] = {
          description: "Global settings.",
          content: {
              "application/json": {
              schema:{
                  $ref: "#/components/schemas/responseGlobalSettings"
              }
            }
          }
      }

      #swagger.responses[400]
    */
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
    // #swagger.tags = ['Settings']
    // #swagger.operationId = '/api/settings/post'
    // #swagger.description = 'Update global webinizer settings'

    /*
      #swagger.requestBody = {
          required: true,
          content: {
              "application/json": {
                schema: {
                    $ref: "#/components/schemas/requestGlobalSettings"
                }
              }
          }
      }

      #swagger.responses[200] = {
          description: "Global settings.",
          content: {
              "application/json": {
                  schema:{
                      $ref: "#/components/schemas/responseGlobalSettings"
                  }
              }
          }
      }

      #swagger.responses[400]
    */
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
