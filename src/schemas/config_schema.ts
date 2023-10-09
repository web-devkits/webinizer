/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

/**
 * Define schemas for config.json
 */

export const buildTargetConfigSchema = {
  $id: "webinizer://schema.server/buildTargetConfig.schema",
  title: "JSON schema for build config of each build target.",
  type: "object",
  properties: {
    options: {
      description: "The build options.",
      type: "object",
      properties: {
        needMainLoop: {
          type: "boolean",
        },
        needPthread: {
          type: "boolean",
        },
        needCppException: {
          type: "boolean",
        },
        needSimd: {
          type: "boolean",
        },
        needModularize: {
          type: "boolean",
        },
      },
      additionalProperties: false,
    },
    envs: {
      description: "The environment vairables from this project for build.",
      type: "object",
      properties: {
        cflags: { type: "string" },
        ldflags: { type: "string" },
      },
      additionalProperties: false,
    },
    builders: {
      description: "The build steps for build.",
      type: "array",
      items: {
        type: "object",
        properties: {
          __type__: { type: "string" },
          id: { type: "number" },
          desc: { type: "string" },
          args: { type: "string" },
          rootBuildFilePath: { type: "string" },
        },
        required: ["__type__", "args", "rootBuildFilePath"],
        additionalProperties: false,
      },
    },
    exportedFuncs: {
      description: "The exported native functions to call from JS.",
      type: "string",
    },
    exportedRuntimeMethods: {
      description: "The exported runtime methods exposed in JS glue code.",
      type: "string",
    },
    preloadFiles: {
      description: "The local files to be preloaded to the virtual FS and used by the project.",
      type: "array",
      items: {
        type: "string",
      },
    },
    disabledAdvisors: {
      description: "The disabled advisors.",
      type: "object",
      patternProperties: {
        "^[a-zA-Z0-9]*Advisor$": { type: "boolean" },
      },
      additionalProperties: false,
    },
    pkgConfig: {
      description: "The package configurations provided to projects that depend on this one.",
      type: "object",
      properties: {
        prefix: { type: "string" },
        cflags: { type: "string" },
        ldflags: { type: "string" },
      },
      additionalProperties: false,
    },
  },
};

export const configSchema = {
  $id: "webinizer://schema.server/config.schema",
  title: "JSON schema for config.json file",
  definitions: {
    dependency: {
      description:
        "Dependencies are specified with a simple hash of package name to version range, a tarball or git URL, or a local directory or .tgz file path.",
      type: "object",
      additionalProperties: {
        type: "string",
      },
    },
  },
  properties: {
    name: {
      description: "The name of the project.",
      type: "string",
      maxLength: 214,
      minLength: 1,
      pattern: "^(?:@(?:[a-z0-9-*~][a-z0-9-*._~]*)?/)?[a-z0-9-~][a-z0-9-._~]*$",
    },
    version: {
      description: "The version of the project.",
      type: "string",
      pattern: "^[0-9]+.[0-9]+.[0-9]+(?:-[a-z]+(?:[_\\.-]*[a-z0-9]+)*)*$",
    },
    desc: {
      description: "The description of the project.",
      type: "string",
    },
    keywords: {
      description: "The project keywords.",
      type: "string",
    },
    homepage: {
      description: "The project homepage address.",
      type: "string",
      pattern: "(^$)|(^(?=s*$))|(^(?!.*S))|(^(https|http)://)",
    },
    bugs: {
      description: "The project's issue tracker address.",
      type: "string",
      pattern: "(^$)|(^(?=s*$))|(^(?!.*S))|(^(https|http)://)",
    },
    license: {
      description: "The project license.",
      type: "string",
    },
    author: {
      description: "The project author info.",
      type: "object",
      properties: {
        name: { type: "string" },
        email: {
          type: "string",
          pattern:
            "(^$)|(^(?=s*$))|(^(?!.*S))|([a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)",
        },
        url: {
          type: "string",
          pattern: "(^$)|(^(?=s*$))|(^(?!.*S))|(^(https|http)://)",
        },
      },
      additionalProperties: false,
    },
    repository: {
      description: "The project repository address.",
      type: "object",
      properties: {
        type: { type: "string" },
        url: {
          type: "string",
          pattern: "(^$)|(^(?=s*$))|(^(?!.*S))|(^(https|https+git|git+https|git)://)",
        },
        directory: { type: "string" },
      },
      required: ["type", "url"],
      additionalProperties: false,
    },
    img: {
      description: "The path to the project icon image.",
      type: "string",
    },
    category: {
      description: "The category of the project.",
      type: "string",
    },
    isLibrary: {
      description: "Whether the project is a library or not.",
      type: "boolean",
    },
    target: {
      description: "The build target.",
      type: "string",
      pattern: "^(static|shared)$",
    },
    dependencies: {
      $ref: "#/definitions/dependency",
    },
    buildTargets: {
      description:
        "Define different build targets and corresponding configurations for the project.",
      type: "object",
      properties: {
        static: { $ref: "buildTargetConfig.schema#" },
        shared: { $ref: "buildTargetConfig.schema#" },
      },
      additionalProperties: false,
    },
    overallEnvs: {
      description: "The overall environment variables used for build.",
      type: "object",
      properties: {
        cflags: { type: "string" },
        ldflags: { type: "string" },
      },
      additionalProperties: false,
    },
    nativeLibrary: {
      description: "The native library info that the project is ported from.",
      type: "object",
      properties: {
        name: { type: "string" },
        version: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  type: "object",
};
