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
      type: "object",
      properties: {
        envs: {
          type: "object",
          properties: {
            cflags: { type: "string" },
            ldflags: { type: "string" },
          },
          required: ["cflags", "ldflags"],
          additionalProperties: false,
        },
        buildSteps: {
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
          type: "object",
          properties: {
            static: { $ref: "buildTargetMeta.schema#" },
            shared: { $ref: "buildTargetMeta.schema#" },
          },
          anyOf: [{ required: ["static"] }, { required: ["shared"] }],
          additionalProperties: false,
        },
        toolchain: {
          type: "object",
          properties: {
            emscripten: { type: "string" },
          },
        },
        nativeLibrary: {
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
      type: "string",
      maxLength: 214,
      minLength: 1,
      pattern: "^(?:@(?:[a-z0-9-*~][a-z0-9-*._~]*)?/)?[a-z0-9-~][a-z0-9-._~]*$",
    },
    version: {
      type: "string",
      pattern: "^[0-9]+.[0-9]+.[0-9]+(?:-[a-z]+(?:[_\\.-]*[a-z0-9]+)*)*$",
    },
    description: { type: "string" },
    dependencies: {
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
