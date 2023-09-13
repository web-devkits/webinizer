/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

import * as H from "../helper";
import * as C from "../constants";
import { registerAdvisorFactory } from "../advisor";
import { FileRegion, FileChangeAction } from "../actions/file_change";
import { ShowSuggestionAction, SuggestionExample } from "../actions/show_suggestion";
import { Recipe } from "../recipe";
import { ErrorAdviseRequest } from "../advise_requests/common_requests";
import { ConfigEnvChangeAction } from "../actions/config_env_change";
import path from "path";
import fs from "graceful-fs";
import {
  IAction,
  IArg,
  IAdviseRequest,
  IAdviseResult,
  IAdvisorFactory,
  IAdvisor,
  Project as IProject,
} from "webinizer";

export async function preloadFontFiles(
  proj: IProject
): Promise<{ opts: string[]; actions: IAction[] }> {
  const preloadOpts: string[] = [];
  const actions: IAction[] = [];

  const matchedFiles = H.matchFilePath("**/*(*.ttf|*.TTF)", proj.root, [C.dependencyDir]);
  const fontFiles: H.Dict<{ fontPath: string; add: boolean }> = {};
  for (const f of matchedFiles) {
    const fontName = path.basename(f);
    if (Object.keys(fontFiles).includes(fontName)) break;
    else {
      fontFiles[fontName] = { fontPath: path.join("${projectRoot}", f), add: false };
    }
  }

  // find TTF_OpenFont(...) in src files, and modify the font file names as below:
  // 1. use file name directly -> no change
  // 2. use a relative or absolute file path -> change to use just the file name
  // 3. use variables/expressions to set the font file / can't find required font file
  //    -> ShowSuggestionAction to notify user
  const patterns = await H.findPatternInFiles("TTF_OpenFont(", proj.root, [
    C.buildDir,
    C.dependencyDir,
  ]);
  const fileExt = C.C_ENDINGS.concat(C.CXX_ENDINGS, C.HEADER_ENDINGS);
  if (patterns.length) {
    const re = /TTF_OpenFont\((?<fontLoc>[^;]+),(?<fontSize>[^;]+)\)/;
    for (const p of patterns) {
      if (fileExt.includes(path.extname(p.file)) && !p.content.trim().startsWith("//")) {
        // Suppose only one pattern match per line (for most cases)
        const m = p.content.match(re);
        if (m && m.groups) {
          const fontFile = m.groups.fontLoc.trim();
          if (fontFile.startsWith('"') && fontFile.endsWith('"')) {
            // fontLoc is a path or file name
            const fontPath = fontFile.replace(/"/g, "");
            const font = path.basename(fontPath);
            if (Object.keys(fontFiles).includes(font)) {
              // add --preload-file to linker options if needed
              if (!fontFiles[font].add) {
                preloadOpts.push(`--preload-file ${fontFiles[font].fontPath}@/`);
                fontFiles[font].add = true;
              }
              // change file if needed, ensure add preload options and change file are happening together
              if (fontPath !== path.basename(fontPath)) {
                actions.push(
                  new FileChangeAction(
                    proj.fileChangeManager,
                    `Update \`TTF_OpenFont()\` statement to use the font name directly instead of the path to it.`,
                    new FileRegion(path.join(p.rootDir, p.file), p.line),
                    p.content.replace(fontPath, path.basename(fontPath))
                  )
                );
              }
            } else {
              actions.push(
                new ShowSuggestionAction(
                  "error",
                  `Font file is \`not\` found, please ensure it's inside project directory.`,
                  null,
                  new FileRegion(path.join(p.rootDir, p.file), p.line)
                )
              );
            }
          } else {
            actions.push(
              new ShowSuggestionAction(
                "error",
                `Font file is set with expression in \`TTF_OpenFont()\`, please directly use font file name.`,
                new SuggestionExample(
                  `font_ = TTF_OpenFont(font_file, 18);`,
                  `font_ = TTF_OpenFont("PressStart2P.ttf", 18);`
                ),
                new FileRegion(path.join(p.rootDir, p.file), p.line)
              )
            );
          }
        }
      }
    }
  }

  return { opts: preloadOpts, actions: actions };
}

class SDLAdvisorFactory implements IAdvisorFactory {
  name = "SDLAdvisorFactory";
  desc = "Use this factory class to create SDLAdvisor instance";

  createAdvisor(): IAdvisor {
    return new SDLAdvisor();
  }
}

class SDLAdvisor implements IAdvisor {
  static __type__ = "SDLAdvisor";
  type = SDLAdvisor.__type__;
  desc = "Advise issues related to SDL";

  private _getCMakeFixTemplate(linkerOpts: string[], pkg: string, ver?: number): string {
    const fixTemplate =
      `set(USE_FLAGS "-sUSE_${pkg}${ver ? "=" + ver : ""}")\n` +
      'set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${USE_FLAGS}")\n' +
      'set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} ${USE_FLAGS}")\n' +
      'set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} ${USE_FLAGS}' +
      ` ${linkerOpts.join(" ")}` +
      ' ")';
    return fixTemplate;
  }

  private _format(content: string, location: FileRegion): string {
    const fileData = fs.readFileSync(location.file, "utf-8");
    const lines = fileData.split("\n");
    let indent = 0;

    // search for the closest previous line with content and use that indention
    for (let i = location.lineStart - 1; i > 0; i--) {
      if (lines[i].trim().length > 0) {
        for (const c of lines[i]) {
          if (c === " ") indent++;
          else break;
        }
        break;
      }
    }
    if (indent) {
      const f = content.split("\n").map((s) => " ".repeat(indent) + s);
      return f.join("\n");
    }

    return content;
  }

  private async _fixCMakeSDL2Missing(
    proj: IProject,
    req: ErrorAdviseRequest
  ): Promise<IAdviseResult> {
    H.assert(req.location !== null, "No file location in the error");
    const actions = [] as IAction[];
    const location = req.location?.toFileRegion() as FileRegion;
    location.file = path.join(proj.root, location.file);
    // delete find_package() statement
    actions.push(
      new FileChangeAction(
        proj.fileChangeManager,
        `Remove \`find_package()\` statement for SDL2 from \`CMakeLists.txt\` at line **${location.lineStart}**`,
        location,
        null
      )
    );
    // add emscripten flags
    actions.push(
      new ConfigEnvChangeAction(
        proj,
        `Add related compiler and linker flags to use Emscripten ported \`SDL2\` library.`,
        {
          cflags: [{ option: "-sUSE_SDL", value: "2", type: "replace" }],
          ldflags: [{ option: "-sUSE_SDL", value: "2", type: "replace" }],
        }
      )
    );

    return {
      handled: true,
      recipe: new Recipe(proj, "Recipe for SDL2 missing issue in CMake", this, req, actions),
    };
  }

  private async _fixMakeSDL2OptionNotSet(
    proj: IProject,
    req: ErrorAdviseRequest
  ): Promise<IAdviseResult> {
    const action = new ConfigEnvChangeAction(
      proj,
      `Add related compiler and linker flags to use Emscripten ported \`SDL2\` library.`,
      {
        cflags: [{ option: "-sUSE_SDL", value: "2", type: "replace" }],
        ldflags: [{ option: "-sUSE_SDL", value: "2", type: "replace" }],
      }
    );
    return {
      handled: true,
      recipe: new Recipe(
        proj,
        "Recipe for SDL2 related symbols undefined issue in Make",
        this,
        req,
        action
      ),
    };
  }

  private async _fixSDL2ttfCore(proj: IProject): Promise<IAction[]> {
    const actions = [] as IAction[];
    const fixFontPreload = await preloadFontFiles(proj);
    const addFlags = new ConfigEnvChangeAction(
      proj,
      `Add related compiler and linker flags to use Emscripten ported \`SDL2_ttf\` library and preload \`font files\` if any.`,
      {
        cflags: [{ option: "-sUSE_SDL_TTF", value: "2", type: "replace" }],
        ldflags: [
          { option: "-sUSE_SDL_TTF", value: "2", type: "replace" },
          ...fixFontPreload.opts.map((o) => {
            return { option: o, value: null, type: "replace" };
          }),
        ] as IArg[],
      }
    );

    actions.push(...[addFlags, ...fixFontPreload.actions]);
    return actions;
  }

  private async _fixCMakeSDL2ttfMissing(
    proj: IProject,
    req: ErrorAdviseRequest
  ): Promise<IAdviseResult> {
    H.assert(req.location !== null, "No file location in the error");
    const actions: IAction[] = [];
    const location = req.location?.toFileRegion() as FileRegion;
    location.file = path.join(proj.root, location.file);
    // delete find_package() statement
    actions.push(
      new FileChangeAction(
        proj.fileChangeManager,
        `Remove \`find_package()\` statement for \`SDL2_ttf\` from \`CMakeLists.txt\` at line **${location.lineStart}**`,
        location,
        null
      )
    );
    // add emscripten flags
    const addSDL2ttfFlags = await this._fixSDL2ttfCore(proj);
    actions.push(...addSDL2ttfFlags);

    return {
      handled: true,
      recipe: new Recipe(proj, "Recipe for SDL2_ttf missing issue in CMake", this, req, actions),
    };
  }

  private async _fixMakeSDL2ttfOptionNotSet(
    proj: IProject,
    req: ErrorAdviseRequest
  ): Promise<IAdviseResult> {
    const actions = await this._fixSDL2ttfCore(proj);
    return {
      handled: true,
      recipe: new Recipe(
        proj,
        "Recipe for SDL2_ttf related symbols undefined issue in Make",
        this,
        req,
        actions
      ),
    };
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  async advise(
    proj: IProject,
    req: IAdviseRequest,
    requestList: ReadonlyArray<IAdviseRequest> // one can only return newRequestQueue to change it
  ): Promise<IAdviseResult> {
    if (req instanceof ErrorAdviseRequest) {
      const errorReq = req as ErrorAdviseRequest;
      // cmake error advices
      if (errorReq.error.includes('not providing "FindSDL2.cmake"')) {
        return this._fixCMakeSDL2Missing(proj, errorReq);
      }
      if (
        errorReq.error.includes("Could NOT find SDL2_ttf") ||
        errorReq.error.includes('not providing "FindSDL2_ttf.cmake"')
      ) {
        return this._fixCMakeSDL2ttfMissing(proj, errorReq);
      }

      // make error advices
      const SDLFuncSymbols = fs.readFileSync("files/SDL2_API.txt", "utf-8").split("\n");
      // TODO. below is just a limited set of APIs, maybe we should read APIs from file instead
      const ttfFuncSymbols = [
        // freetype APIs
        "FT_Done_Face",
        "FT_Done_FreeType",
        "FT_Done_Glyph",
        "FT_Get_Glyph",
        "FT_Glyph_Stroke",
        "FT_Glyph_To_Bitmap",
        "FT_Init_FreeType",
        "FT_Load_Glyph",
        "FT_MulFix",
        "FT_Open_Face",
        "FT_Outline_Transform",
        "FT_Outline_Translate",
        "FT_Render_Glyph",
        "FT_Select_Size",
        "FT_Set_Char_Size",
        "FT_Set_Charmap",
        "FT_Stroker_Done",
        "FT_Stroker_New",
        "FT_Stroker_Set",
        // harfbuzz APIs
        "hb_buffer_add_utf8",
        "hb_buffer_create",
        "hb_buffer_destroy",
        "hb_buffer_get_glyph_infos",
        "hb_buffer_get_glyph_positions",
        "hb_buffer_set_direction",
        "hb_buffer_set_script",
        "hb_font_destroy",
        "hb_ft_font_changed",
        "hb_ft_font_create",
        "hb_ft_font_set_load_flags",
        "hb_shape",
      ];
      const lines = errorReq.error.split("\n");
      const re =
        /error: undefined symbol: (?<func>.*) \(referenced by top-level compiled C\/C\+\+ code\)/;
      for (const line of lines) {
        const m = line.match(re);
        if (m && m.groups) {
          if (SDLFuncSymbols.includes(m.groups.func.trim()))
            // SDL2 port in cache but option -sUSE_SDL=2 is not set
            return this._fixMakeSDL2OptionNotSet(proj, errorReq);
          if (ttfFuncSymbols.includes(m.groups.func.trim()))
            // SDL2_ttf port in cache but option -sUSE_SDL_TTF=2 is not set
            return this._fixMakeSDL2ttfOptionNotSet(proj, errorReq);
        }
      }
    }
    return {
      handled: false,
    };
  }
}

// loading
export default function onload() {
  registerAdvisorFactory(SDLAdvisor.__type__, new SDLAdvisorFactory());
}
