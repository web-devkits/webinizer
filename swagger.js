// eslint-disable-next-line @typescript-eslint/no-var-requires
const swaggerAutogen = require("swagger-autogen");

const projectPoolRootPath = "/projects";

const gitHubRepoPath = "https://github.com/bytecodealliance/wasm-micro-runtime.git";

const gitHubProjectRootPath = `${projectPoolRootPath}/wasm-micro-runtime`;

// use your own setup registry server path instead
const registryServerPath = "http://localhost:4873";

const registryProjectRootPath = `${projectPoolRootPath}/webinizer-demo-main-app-1.0.0`;

const doc = {
  info: {
    title: "Webinizer",
    version: "0.0.1",
    description: "Webinizer APIs Swagger Specification",
  },
  host: "localhost:16666",
  schemes: ["http"],
  components: {
    schemas: {
      iconURL:
        "http://localhost:16666/api/projects/icons?root=g%252FProjects%252Fnative_projects%252Ftetris",
      icons: [{ url: "http://localhost:16666/assets/icons/default/a.png", uploaded: false }],

      githubProject: {
        $repoPath: gitHubRepoPath,
        config: {
          $name: "wamr",
          $version: "1.0.0",
          desc: "WebAssembly Micro Runtime",
        },
      },

      profile: [
        {
          name: "Tetris",
          desc: "Tetris is a classic video puzzle game, implemented based on SDL2.",
          img: "../assets/getstarted/tetris.png",
          category: "Game",
          version: "1.0.0",
          id: 0,
          path: "/projects/tetris",
        },
        {
          name: "wamr",
          desc: "WebAssembly Micro Runtime",
          img: "../assets/basic/preseticons/192x192/w.png",
          version: "1.0.0",
          path: "/projects/wasm-micro-runtime",
        },
      ],

      requestGitHubProjRoot: gitHubProjectRootPath,

      requestRegistryProjRoot: { dir: registryProjectRootPath },

      requestFilePath: { name: `${registryProjectRootPath}/main.c` },

      responseGitHubPath: {
        $path: gitHubProjectRootPath,
      },

      responseConfig: {
        __type__: "ProjectConfig",
        name: "webinizer-demo-main-app",
        version: "1.0.0",
        desc: "A demo main app to test functionality.",
        useDefaultConfig: false,
        buildTargets: {
          static: {
            envs: {
              cflags: "",
              ldflags: "",
            },
            builders: [
              {
                __type__: "EmccBuilder",
                args: "main.c -o main.js",
                rootBuildFilePath: "${projectRoot}",
              },
              {
                __type__: "NativeBuilder",
                args: "node main.js",
                rootBuildFilePath: "${projectRoot}",
              },
            ],
            exportedFuncs: "",
            exportedRuntimeMethods: "",
            preloadFiles: [],
          },
        },
        overallEnvsMap: {
          self: {
            cflags: "",
            ldflags: "",
          },
          "webinizer-demo-lib-b": {
            cflags:
              "'-I/projects/webinizer-demo-main-app-1.0.0/webinizer_deps/webinizer-demo-lib-b'",
            ldflags:
              "'-L/projects/webinizer-demo-main-app-1.0.0/webinizer_deps/webinizer-demo-lib-b/static' -ldemo_lib_b",
          },
          "webinizer-demo-lib-a": {
            cflags:
              "'-I/projects/webinizer-demo-main-app-1.0.0/webinizer_deps/webinizer-demo-lib-a'",
            ldflags:
              "'-L/projects/webinizer-demo-main-app-1.0.0/webinizer_deps/webinizer-demo-lib-a/static' -ldemo_lib_a",
          },
          "webinizer-demo-lib-c": {
            cflags:
              "'-I/projects/webinizer-demo-main-app-1.0.0/webinizer_deps/webinizer-demo-lib-c'",
            ldflags:
              "'-L/projects/webinizer-demo-main-app-1.0.0/webinizer_deps/webinizer-demo-lib-c/static' -ldemo_lib_c",
          },
        },
        overallEnvs: {
          cflags:
            "-I${projectRoot}/webinizer_deps/webinizer-demo-lib-b -I${projectRoot}/webinizer_deps/webinizer-demo-lib-a -I${projectRoot}/webinizer_deps/webinizer-demo-lib-c",
          ldflags:
            "-L${projectRoot}/webinizer_deps/webinizer-demo-lib-b/static -ldemo_lib_b -L${projectRoot}/webinizer_deps/webinizer-demo-lib-a/static -ldemo_lib_a -L${projectRoot}/webinizer_deps/webinizer-demo-lib-c/static -ldemo_lib_c",
        },
        target: "static",
        dependencies: {
          "webinizer-demo-lib-a": "^1.0.0",
          "webinizer-demo-lib-c": "^1.0.0",
        },
        resolutions: [
          {
            name: "webinizer-demo-lib-a",
            reference: "^1.0.0",
            version: "1.0.0",
            dependencies: [],
            destination: "webinizer_deps/webinizer-demo-lib-a",
            requiredBy: {
              "webinizer-demo-main-app": "1.0.0",
            },
          },
          {
            name: "webinizer-demo-lib-c",
            reference: "^1.0.0",
            version: "1.0.0",
            dependencies: [],
            destination: "webinizer_deps/webinizer-demo-lib-c",
            requiredBy: {
              "webinizer-demo-main-app": "1.0.0",
            },
          },
          {
            name: "webinizer-demo-lib-b",
            reference: "^1.0.0",
            version: "1.0.0",
            dependencies: [],
            destination: "webinizer_deps/webinizer-demo-lib-b",
            requiredBy: {
              "webinizer-demo-lib-a": "^1.0.0",
              "webinizer-demo-lib-c": "^1.0.0",
            },
          },
        ],
        img: "../assets/basic/preseticons/192x192/w.png",
      },

      requestConfigUpdate: {
        $config: {
          version: "1.0.1",
          target: "static",
        },
      },

      requestRegistryPackage: "webinizer",

      requestRecipes: {
        recipes: [],
      },

      responseRegistryPackage: {
        result: [
          { name: "webinizer-demo-lib-a", version: "1.0.0", desc: "lib-a" },
          { name: "webinizer-demo-lib-b", version: "1.0.0", desc: "lib-b" },
          { name: "webinizer-demo-lib-c", version: "1.0.0", desc: "lib-c" },
        ],
      },

      requestBuildOption: {
        static: {
          options: {
            needPthread: true,
          },
        },
      },

      requestDisableAdvisor: {
        advisor: "MainLoopAdvisor",
      },

      responseBuildersRecommend: {
        builders: [
          {
            __type__: "EmccBuilder",
            id: 0,
            desc: "emcc",
            args: "",
            rootBuildFilePath: "${projectRoot}",
          },
        ],
      },

      requestRegistry: {
        spec: {
          $name: "webinizer-demo-main-app",
          $version: "1.0.0",
        },
        config: {
          img: "../assets/basic/preseticons/192x192/w.png",
        },
      },
      responseRegistry: {
        path: registryProjectRootPath,
      },

      responseTemplate: {
        templates: [
          "${projectDist} =" + registryProjectRootPath + "/webinizer_build",
          "${projectRoot} = " + registryProjectRootPath + "",
          "${projectPool} = " + projectPoolRootPath + "",
        ],
      },

      requestTemplateEval: "${projectRoot}",
      responseTemplateEval: { val: registryProjectRootPath },

      requestGlobalSettings: {
        settingParts: {
          registry: registryServerPath,
        },
      },

      responseGlobalSettings: {
        __type__: "WebnizerSettings",
        extensions: {
          "webnizer-extension-demo": {
            desc: "This is a demo extension for webnizer.",
            status: "enable",
          },
        },
        registry: registryServerPath,
      },

      responseAllBuilders: {
        builders: [
          {
            __type__: "CMakeBuilder",
            id: 0,
            desc: "CMake",
            args: "",
            rootBuildFilePath: "${projectRoot}",
          },
          {
            __type__: "ConfigureBuilder",
            id: 0,
            desc: "configure",
            args: "",
            rootBuildFilePath: "${projectRoot}",
          },
          {
            __type__: "EmccBuilder",
            id: 0,
            desc: "emcc",
            args: "",
            rootBuildFilePath: "${projectRoot}",
          },
          {
            __type__: "MakeBuilder",
            id: 0,
            desc: "make",
            args: "",
            rootBuildFilePath: "${projectRoot}",
          },
          {
            __type__: "NativeBuilder",
            id: 0,
            desc: "Run native commands without emscripten related configs",
            args: "",
            rootBuildFilePath: "${projectRoot}",
          },
          {
            __type__: "DemoBuilder",
            id: 0,
            desc: "demo builder",
            args: "",
            rootBuildFilePath: "${projectRoot}",
          },
        ],
      },

      requestFileContent: {
        name: `${registryProjectRootPath}/main.c`,
        content: "This content is only for testing",
      },

      requestNewFile: {
        name: `${registryProjectRootPath}/main_4_testing.c`,
        content: "This content is only to test for the api of creating new file",
      },

      responseFileContent: {
        name: `${registryProjectRootPath}/main_4_testing.c`,
        content:
          '#include <stdio.h>\n#include "demo_lib_a.h"\n#include "demo_lib_c.h"\n\nint main() {\n    printf("Hello from demo main app.\\n");\n    MyFuncA();\n    MyFuncC();\n    return 0;\n}\n',
      },

      responseDirectoryTree: {
        tree: {
          path: registryProjectRootPath,
          name: "webinizer-demo-main-app-1.0.0",
          type: "directory",
          children: [
            {
              path: `${registryProjectRootPath}/main.c`,
              name: "main.c",
              type: "file",
            },
            {
              path: `${registryProjectRootPath}/package.json`,
              name: "package.json",
              type: "file",
            },
            {
              path: `${registryProjectRootPath}/webinizer_deps`,
              name: "webinizer_deps",
              type: "directory",
            },
          ],
        },
      },

      responseBuildStatus: { status: "idle_default" },

      responseRecipes: {
        recipes: [
          {
            recipes: [
              {
                __type__: "Recipe",
                proj: registryProjectRootPath,
                desc: "Recipe for main loop issue",
                advisor: "MainLoopAdvisor",
                requests: [
                  {
                    __type__: "PlainAdviseRequest",
                    tags: ["pre-build"],
                    plainData: {},
                  },
                ],
                actions: [
                  {
                    __type__: "ShowSuggestion",
                    initiator: "option",
                    desc: "Main loop implementation using Emscripten API is not detected. If you are using infinite loop in your application (i.e., for rendering / animation, etc.), please follow the example below to use [`emscripten_set_main_loop()`](https://emscripten.org/docs/api_reference/emscripten.h.html#c.emscripten_set_main_loop) API to modify. Otherwise, please click `IGNORE` to dismiss this recipe.",
                    suggestion: {
                      __type__: "SuggestionExample",
                      before:
                        '\n#include "game.h"\n\nint main() {\n  Game game;\n  while (game.loop());\n  return 0;\n}',
                      after:
                        '\n#include "game.h"\n#include <emscripten.h>\n\nint main() {\n  emscripten_set_main_loop(\n    []() {\n        static Game game;\n        game.loop();\n  }, 0, 1);\n  return 0;\n}',
                    },
                    region: null,
                  },
                ],
                showNoAdvisor: true,
              },
            ],
          },
        ],
      },

      responseBuildLog: {
        content: "Done",
      },

      responseBuildResults: {
        __type__: "ProjectResult",
        files: [
          {
            target: "main",
            type: "executable",
            result: [
              {
                path: `${registryProjectRootPath}/main.js`,
                name: "main.js",
                type: "file",
                size: 64949,
                date: "2023-08-22T05:37:59.052Z",
              },
              {
                path: `${registryProjectRootPath}/main.wasm`,
                name: "main.wasm",
                type: "file",
                size: 12375,
                date: "2023-08-22T05:37:59.048Z",
              },
            ],
          },
        ],
        timestamps: {
          tStart: "2023-08-22T05:37:57.613Z",
          tEnd: "2023-08-22T05:37:59.099Z",
          tDur: 1486,
        },
      },

      responsePublication: { status: "success" },
    },
  },
};

const outputFile = "./swagger-output.json";
const endpointsFiles = ["./src/server.ts"];

swaggerAutogen({ openapi: "3.0.0", autoHeaders: false, autoQuery: false, autoBody: false })(
  outputFile,
  endpointsFiles,
  doc
);
