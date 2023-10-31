/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

/**
 * Define schemas for package.json
 */

export const buildTargetMetaSchema = {
  $id: "webinizer://schema.server/buildTargetMeta.schema",
  $ref: "#/definitions/standard",
  definitions: {
    standard: {
      allOf: [
        {
          $ref: "#/definitions/structure",
        },
        {
          required: ["envs", "buildSteps"],
        },
      ],
    },
    library: {
      allOf: [
        {
          $ref: "#/definitions/structure",
        },
        {
          required: ["envs", "buildSteps", "pkgConfig"],
        },
      ],
    },
    structure: {
      description: "Webinizer specific metadata fields.",
      type: "object",
      properties: {
        envs: {
          description: "The environment variables defined for build.",
          type: "object",
          properties: {
            cflags: {
              description: "The compiler flags defined for build.",
              type: "string",
            },
            ldflags: {
              description: "The linker flags defined for build.",
              type: "string",
            },
          },
          required: ["cflags", "ldflags"],
          additionalProperties: false,
        },
        buildSteps: {
          description: "The build steps defined for build.",
          type: "array",
          items: {
            type: "object",
            properties: {
              command: { type: "string", minLength: 1 },
              args: { type: "string" },
              cwd: { type: "string", minLength: 1 },
            },
            required: ["command", "args", "cwd"],
            additionalProperties: false,
          },
        },
        pkgConfig: {
          description: "The package configurations defined for projects depending on this.",
          type: "object",
          properties: {
            prefix: { type: "string", minLength: 1 },
            cflags: { type: "string", minLength: 1 },
            ldflags: { type: "string", minLength: 1 },
          },
          required: ["prefix", "cflags", "ldflags"],
          additionalProperties: false,
        },
      },
    },
  },
};

export const webinizerFieldMetaSchema = {
  $id: "webinizer://schema.server/webinizerFieldMeta.schema",
  $ref: "#/definitions/standard",
  definitions: {
    standard: {
      allOf: [
        {
          $ref: "#/definitions/structure",
        },
        {
          required: ["buildTargets"],
        },
      ],
    },
    library: {
      allOf: [
        {
          $ref: "#/definitions/structure",
        },
        {
          required: ["buildTargets", "nativeLibrary"],
        },
      ],
    },
    structure: {
      type: "object",
      properties: {
        buildTargets: {
          description: "The supported build targets and corresponding build configurations.",
          type: "object",
          properties: {
            static: { $ref: "buildTargetMeta.schema#" },
            shared: { $ref: "buildTargetMeta.schema#" },
          },
          anyOf: [{ required: ["static"] }, { required: ["shared"] }],
          additionalProperties: false,
        },
        toolchain: {
          description: "The information of toolchain used for build.",
          type: "object",
          properties: {
            emscripten: { type: "string" },
          },
        },
        nativeLibrary: {
          description: "The native library information used for conversion.",
          type: "object",
          properties: {
            name: { type: "string", minLength: 1 },
            version: { type: "string", minLength: 1 },
          },
          required: ["name", "version"],
        },
      },
    },
  },
};

export const metaSchema = {
  $id: "webinizer://schema.server/meta.schema",
  type: "object",
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
    description: {
      description: "The description of the project.",
      type: "string",
    },
    keywords: {
      description: "The project keywords.",
      type: "array",
      items: {
        type: "string",
        pattern: "^[A-Za-z](?:[_\\.-]?[A-Za-z0-9]+)*$",
      },
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
      required: ["name"],
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
    dependencies: {
      description: "The project dependent packages.",
      type: "object",
      patternProperties: {
        "^(?:@(?:[a-z0-9-*~][a-z0-9-*._~]*)?/)?[a-z0-9-~][a-z0-9-._~]*$": { type: "string" },
      },
    },
    webinizer: {
      $ref: "webinizerFieldMeta.schema#",
    },
  },
  required: ["name", "version", "webinizer"],
};
