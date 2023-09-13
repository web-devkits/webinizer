/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

/**
 * Package dependency resolver
 * @module
 */

import { Project } from "../project";
import fs from "graceful-fs";
import path from "path";
import semver from "semver";
import * as _ from "lodash";
import * as H from "../helper";
import * as C from "../constants";
import errorCode from "../error_code";
import { getPackageFetcher, IPackageManifest } from "./fetcher";
import { buildStatus } from "../status";
import dotProp from "dot-prop";

const log = H.getLogger("package_resolver");

/**
 * Define a package specifier.
 */
export interface IPackageSpec {
  /**
   * The package name.
   */
  name: string;
  /**
   * The package version reference, this could be a version, a version range, a directory, a file path etc.
   */
  reference: string;
  /**
   * The resolved fixed package version.
   */
  version?: string;
}

/**
 * Define a raw package.
 */
export interface IRawPackage extends IPackageSpec {
  /**
   * The raw package dependencies.
   */
  dependencies: IPackageSpec[];
  /**
   * The packages that depend on this.
   */
  requiredBy?: H.Dict<string>;
}

/**
 * Define a resolved package.
 */
export interface IPackage extends Omit<IRawPackage, "dependencies"> {
  /**
   * The package dependencies.
   */
  dependencies: IPackage[];
  /**
   * The destination of this package resolved on local disk.
   */
  destination?: string;
}

export class DependencyResolver {
  root: string;
  name: string;
  version: string;
  isRootProject: boolean;
  rawDependencies: H.Dict<string>;
  resolutions: IPackage[];

  constructor(proj: Project) {
    this.root = proj.root;
    this.name = proj.config.name?.toLocaleLowerCase() || "";
    this.version = proj.config.version || "";
    this.isRootProject = proj.isRootProject;
    this.rawDependencies = _.cloneDeep(proj.config.rawDependencies) || {};
    this.resolutions = _.cloneDeep(proj.config.resolutions) || [];
  }

  /**
   * Get fixed version for a package
   * @param package a raw package
   * @param package.name package name
   * @param package.reference package version reference
   * @param resolutions the resolutions from last resolver, used for package version lock
   */
  async getFixedVersion(
    { name, reference }: IPackageSpec,
    resolutions?: IPackage[]
  ): Promise<IPackageSpec> {
    let version = "";
    // if `reference` is not a semver or semver range (i.e., a directory/file path), convert it to a
    // version number at first
    if (reference.startsWith("file:")) {
      const packageManifest = await getPackageFetcher({ name, reference }).getManifest();
      version = packageManifest.version;
    }
    if (resolutions) {
      // verify if the package is fixed in resolutions field
      const filteredRes = resolutions.filter((res) => {
        if (res.name === name) return true;
      });
      if (filteredRes.length) {
        // there should be only one version of package in the resolutions field in current implementation
        const filteredResVer = filteredRes[0].version;
        if (
          filteredResVer &&
          ((semver.valid(reference) && reference === filteredResVer) ||
            (semver.validRange(reference) && semver.satisfies(filteredResVer, reference)) ||
            (reference.startsWith("file:") &&
              version &&
              semver.valid(version) &&
              version === filteredResVer))
        ) {
          log.info(`... get fixed version for package ${name}: ${filteredResVer}`);
          return { name, reference, version: filteredResVer };
        }
        // if the fixed version in resolutions field can't meet the requirement of the package reference version, raise error
        throw new H.WError(
          `Package ${name} version ${reference} is conflict with locked version ${filteredResVer} defind in resolutions field.`,
          errorCode.WEBINIZER_PM_VER_CONFLICT
        );
      }
    }

    if (semver.validRange(reference)) {
      if (semver.valid(reference)) {
        // works for a fixed reference (1.0.0)
        version = reference;
      } else {
        // works for a range (^1.0.0)
        const packument = await getPackageFetcher({ name, reference }).getPackument();
        // currently, we always get the latest version of a package that fits the semver range
        const maxSatisfied = semver.maxSatisfying(Object.keys(packument.versions), reference);

        if (maxSatisfied === null)
          throw new H.WError(
            `Couldn't find a version matching "${reference}" for package "${name}"`,
            errorCode.WEBINIZER_PM_VER_INVALID
          );

        version = maxSatisfied;
      }
      log.info(`... get fixed version for package ${name}: ${version}`);
    }

    return { name, reference, version };
  }

  /**
   * Convert the raw dependencies of a package using PackageSpec interface
   * @param package a raw package
   * @param package.name package name
   * @param package.reference package version reference
   * @param package.version package fixed version
   * @returns the package dependencies
   *
   */
  async getPackageDependencies({
    name,
    reference,
    version,
  }: IPackageSpec): Promise<IPackageSpec[]> {
    const packageManifest = await getPackageFetcher({ name, reference, version }).getManifest();
    const dependencies = packageManifest.dependencies || {};
    return Object.keys(dependencies).map((name) => {
      return { name, reference: dependencies[name] };
    });
  }

  /**
   * Calculate the basic dependency tree and detect possible circular dependency
   * @param package a raw package
   * @param package.name package name
   * @param package.reference package version reference
   * @param package.version package fixed version
   * @param package.dependencies raw dependencies from package.json, in the form of PackageSpec[]
   * @param package.requiredBy the packages that depends on the current one
   * @param ancenstors ancenstor packages map
   * @returns the basic dependency tree
   */
  async getPackageDependencyTree(
    { name, reference, version, dependencies, requiredBy }: IRawPackage,
    ancenstors = new Map<string, string>(),
    resolutions?: IPackage[]
  ): Promise<IPackage> {
    return {
      name,
      reference,
      version,
      dependencies: await Promise.all(
        dependencies.map(async (dep) => {
          // `ancenstors` is a Map of [name, reference] pair, used to record the ancenstors of a package to help get rid
          // of possible circular dependency
          if (ancenstors.get(dep.name)) {
            // circular dependency pattern detected, throw exception
            throw new H.WError(
              `Circular dependency is detected for package ${dep.name}`,
              errorCode.WEBINIZER_PM_CIRCULAR_DEP
            );
          }
          // the package is not found in ancenstors, add it to the dependency tree
          const fixedDependency = await this.getFixedVersion(dep, resolutions);
          const subDependencies = await this.getPackageDependencies(fixedDependency);
          // create a new map subAncenstors from ancenstors, instead of overriding it
          const subAncenstors = new Map(ancenstors);
          if (fixedDependency.version) {
            subAncenstors.set(fixedDependency.name, fixedDependency.version);
          }
          // get the dependency tree recursively
          return this.getPackageDependencyTree(
            Object.assign({}, fixedDependency, {
              dependencies: subDependencies,
              requiredBy: { [name]: reference },
            }),
            subAncenstors,
            resolutions
          );
        })
      ),
      requiredBy,
    };
  }

  /**
   * Convert the dependency tree from nested to flat, and eliminate any possible version conflicts
   * across different sub-trees
   * @param package a resolved package
   * @param package.name package name
   * @param package.reference package version reference
   * @param package.version fixed package version
   * @param package.dependencies the basic dependency tree from `getPackageDependencyTree`
   * @param package.requiredBy the packages that depends on the current one
   * @returns the optimized dependency tree
   * */
  optimizeDependencyTree({
    name,
    reference,
    version,
    dependencies,
    requiredBy,
  }: IPackage): IPackage {
    // transverse the tree from bottom to top recursively, and merge the optimized results together
    dependencies = dependencies.map((dep) => this.optimizeDependencyTree(dep));

    for (const dep of dependencies.slice()) {
      for (const subDep of dep.dependencies.slice()) {
        /**
         *          A
         *       /     \
         *      B       C    <-- dependencies
         *     /  \    /  \
         *    D    E  F    G <-- dep.dependencies
         */

        // to find if `D` is in [B, C]
        const availableDep = dependencies.find((dependency) => subDep.name === dependency.name);

        if (!availableDep) {
          // if no availableDep found for subDep (means `D` is not in [B, C]), level it up and remove
          // it from dep.dependencies
          dependencies.push(subDep);
          dep.dependencies.splice(
            dep.dependencies.findIndex((dependency) => dependency.name === subDep.name),
            1
          );
        } else {
          if (availableDep.version === subDep.version) {
            // if availableDep found and it's the same reference version as subDep, merge requiredBy of both deps
            availableDep.requiredBy = Object.assign({}, availableDep.requiredBy, subDep.requiredBy);
            // remove the node from dep.dependencies and only keep the one in dependencies
            dep.dependencies.splice(
              dep.dependencies.findIndex((dependency) => dependency.name === availableDep.name),
              1
            );
          } else {
            // version conflict, throw exception, this will catch version conflicts in different sub-trees
            throw new H.WError(
              `Version conflict! ${subDep.name}: ${subDep.version} vs. ${availableDep.version}`,
              errorCode.WEBINIZER_PM_VER_CONFLICT
            );
          }
        }
      }
    }

    return { name, reference, version, dependencies, requiredBy };
  }

  /**
   * Compare native libraries info of different dependencies to eliminate different ports for the same native library
   * @param deps an optimized dependency tree
   */
  async validateNativeLibraryInDependencyTree(deps: Readonly<IPackage[]>): Promise<void> {
    const nativeLibs = new Map<string, IPackageManifest>();
    for (const dep of deps) {
      const packageManifest = await getPackageFetcher(
        {
          name: dep.name,
          reference: dep.reference,
          version: dep.version,
        },
        { fullMetadata: true } // fetch full metadata file
      ).getManifest();
      if (
        dotProp.get(packageManifest, "webinizer.nativeLibrary.name") &&
        dotProp.get(packageManifest, "webinizer.nativeLibrary.version")
      ) {
        // get the native library name and ignore letter case
        const nativeLibName = (
          dotProp.get(packageManifest, "webinizer.nativeLibrary.name") as string
        ).toLocaleLowerCase();
        if (nativeLibs.get(nativeLibName)) {
          throw new H.WError(
            `Different ports (${dep.name} vs. ${dotProp.get(
              nativeLibs.get(nativeLibName),
              "name"
            )}) of the same native library ${nativeLibName} is detected in the dependency graph and is NOT allowed.`,
            errorCode.WEBINIZER_PM_PORT_CONFLICT
          );
        } else {
          nativeLibs.set(nativeLibName, packageManifest);
        }
      } else {
        throw new H.WError(
          `No valid field nativeLibrary is defined in the package manifest of ${dep.name}`,
          errorCode.WEBINIZER_META_FIELD_UNDEFINED
        );
      }
    }
  }

  /**
   * Save the dependency packages on local disk according to the optimized tree
   * @param package a resolved and optimized package
   * @param package.name package name
   * @param package.reference package version reference
   * @param package.version fixed package version
   * @param package.dependencies the optimized dependency tree from `optimizedDependencyTree`
   * @param package.destination the destination to store the dependencies, default is ${projectRoot}/webinizer_deps
   * @param package.requiredBy the packages that depend on the current one
   * @param rootPath the root path of main project
   * @param isRoot is the project a main/root project or not
   * @returns updated dependencies with destination info
   *  */
  private async _localizeDependencies(
    { name, reference, version, dependencies, destination, requiredBy }: IPackage,
    rootPath: string,
    isRoot: boolean
  ): Promise<IPackage> {
    if (destination) {
      if (!isRoot) {
        if (!fs.existsSync(destination)) {
          log.info(`... fetching package ${name}@${reference}@${version} to local disk.`);
          // we don't need to fetch the root project, but all the other dependencies.
          try {
            await getPackageFetcher({ name, reference, version }).fetchPackage(destination);
            // git init for each dependency
            // FIXME. should we include config.json into git tree or not?
            const gitInitResults = await H.runCommand(
              "git init && git add . && git commit -m 'first commit'",
              { cwd: destination, silent: true }
            );
            if (gitInitResults.code !== 0) {
              throw new H.WError(
                `Initialize the project with git failed.`,
                errorCode.WEBINIZER_PROJ_INIT_FAIL
              );
            }
          } catch (err) {
            // if errors happend in fetching the package to local disk, remove the package repo before throw the error.
            fs.rmSync(destination, { recursive: true, force: true });
            throw err as Error;
          }
          // convert package.json to config.json if config.json doesn't exist after all
          // dependencies are localized successfully
        }

        return {
          name,
          reference,
          version,
          dependencies,
          destination: path.relative(rootPath, destination),
          requiredBy,
        };
      }

      return {
        name,
        reference,
        version,
        dependencies: await Promise.all(
          dependencies
            .slice()
            .map(async ({ name, reference, version, dependencies, requiredBy }) => {
              const destTarget = path.join(
                destination,
                C.dependencyDir,
                `${name.toLocaleLowerCase()}`
              );
              return this._localizeDependencies(
                { name, reference, version, dependencies, destination: destTarget, requiredBy },
                rootPath,
                false
              );
            })
        ),
      };
    }
    return { name, reference, version, dependencies, requiredBy };
  }

  /**
   * Remove packages from local disk
   * @param deleted deleted package list
   * @param root project root
   */
  private _cleanupDependencies(deleted: IPackage[], root: string) {
    deleted.forEach((pkg) => {
      log.info(`... removing package ${pkg.name} from local disk.`);
      const pkgRoot = pkg.destination
        ? path.join(root, pkg.destination)
        : path.join(root, C.dependencyDir, pkg.name);
      fs.rmSync(pkgRoot, {
        recursive: true,
        force: true,
      });
      // reset the build status of the dependency to `idle_default`
      buildStatus.setBuildStatus(pkgRoot, "idle_default");
    });
  }

  /**
   * Compare resolutions and get outdated packages
   * @param oldResolutions old resolutions
   * @param newResolutions new resolutions
   * @returns resolutions of outdated packages
   */
  private _generateOutdatedResolutions(
    oldResolutions: IPackage[] | undefined,
    newResolutions: IPackage[] | undefined
  ): IPackage[] {
    const outdated: IPackage[] = [];
    if (!oldResolutions || !oldResolutions.length) {
      return [];
    } else if (!newResolutions || !newResolutions.length) {
      outdated.push(...(oldResolutions || []));
    } else {
      const isSameResolution = (a: IPackage, b: IPackage) =>
        a.name === b.name && a.version === b.version && a.reference === b.reference;
      const compareRes = (
        oldRes: IPackage[],
        newRes: IPackage[],
        compareFn: (a: IPackage, b: IPackage) => boolean
      ) => {
        return oldRes.filter(
          (oldResVal) => !newRes.some((newResVal) => compareFn(oldResVal, newResVal))
        );
      };
      outdated.push(...compareRes(oldResolutions, newResolutions, isSameResolution));
    }
    return outdated;
  }

  /**
   * Update (delete and add) dependency packages
   * @param newResolutions new resolutions
   * @param proj the root project
   * @returns new resolutions field with dependencies' dest info
   */
  async finalizeDependencies(
    newResolutions: IPackage[] | undefined
  ): Promise<IPackage[] | undefined> {
    if (this.isRootProject) {
      const outdated = this._generateOutdatedResolutions(this.resolutions, newResolutions);
      // delete outdated packages
      this._cleanupDependencies(outdated, this.root);
      // add newly added packages
      const updatedNewResolutions = (
        await this._localizeDependencies(
          {
            name: this.name,
            reference: this.version,
            dependencies: newResolutions || [],
            destination: this.root,
          },
          this.root,
          this.isRootProject
        )
      ).dependencies;
      return updatedNewResolutions;
    }
    // resolutions are generated for main project only
    return undefined;
  }

  /**
   * Update the resolutions based on the top-level dependencies at first to ensure
   * the direct installed dependencies meet user's requirement
   * @returns the package resolutions adjusted based on top-level dependencies
   */
  async adjustToplevelDepResolutions(): Promise<IPackage[]> {
    const oldResolutions = _.cloneDeep(this.resolutions);
    if (this.rawDependencies && !H.isObjectEmpty(this.rawDependencies)) {
      for (const dep in this.rawDependencies) {
        for (const idx in oldResolutions) {
          if (oldResolutions[idx].name === dep) {
            // package `dep` has locked version
            if (this.rawDependencies[dep].startsWith("file:")) {
              const packageManifest = await getPackageFetcher({
                name: dep,
                reference: this.rawDependencies[dep],
              }).getManifest();
              const depVer = packageManifest.version;
              if (depVer && semver.valid(depVer) && oldResolutions[idx].version !== depVer) {
                oldResolutions[idx].reference = this.rawDependencies[dep];
                oldResolutions[idx].version = depVer;
              }
            } else if (
              (semver.valid(this.rawDependencies[dep]) &&
                oldResolutions[idx].version !== this.rawDependencies[dep]) ||
              (semver.validRange(this.rawDependencies[dep]) &&
                oldResolutions[idx].version &&
                !semver.satisfies(oldResolutions[idx].version || "", this.rawDependencies[dep]))
            ) {
              const newRes = await this.getFixedVersion({
                name: dep,
                reference: this.rawDependencies[dep],
              });
              oldResolutions[idx].name = newRes.name;
              oldResolutions[idx].reference = newRes.reference;
              oldResolutions[idx].version = newRes.version;
            }
          }
        }
      }
    }
    return oldResolutions;
  }

  /**
   * Generate the final optimized dependency tree
   * @returns An optimized (flatten) dependency tree.
   */
  async getDependencyResolutions(): Promise<IPackage[]> {
    if (this.rawDependencies && !H.isObjectEmpty(this.rawDependencies)) {
      // adjust resolutions for first-level dependencies
      let adjustedResolutions: IPackage[] = [];
      if (this.resolutions && this.resolutions.length) {
        adjustedResolutions = await this.adjustToplevelDepResolutions();
      }
      log.info(
        `... original resolutions is:\n${this.resolutions?.map((n) => JSON.stringify(n, null, 2))}`
      );
      log.info(
        `... resolutions adjusted for top-level dependencies is:\n${adjustedResolutions.map((n) =>
          JSON.stringify(n, null, 2)
        )}`
      );
      // construct the base tree
      const baseTree = await this.getPackageDependencyTree(
        {
          name: this.name,
          reference: this.version,
          dependencies: Object.keys(this.rawDependencies).map((name) => {
            return { name, reference: this.rawDependencies?.[name] || "" };
          }),
          requiredBy: {}, // root project has empty requiredBy property
        },
        new Map<string, string>([[this.name, this.version]]),
        adjustedResolutions
      );
      // generate the optimized/flatten tree
      if (baseTree.dependencies && baseTree.dependencies.length) {
        const optTree = this.optimizeDependencyTree({
          name: this.name,
          reference: this.version,
          dependencies: _.cloneDeep(baseTree.dependencies),
        });
        await this.validateNativeLibraryInDependencyTree(optTree.dependencies);
        return optTree.dependencies;
      }
    }
    return [];
  }

  /**
   * Resolve project dependencies and finalize the project on local disk
   * @returns the resolved project dependency tree
   */
  async resolveDependencies(): Promise<IPackage[] | undefined> {
    const newResolutions = await this.getDependencyResolutions();
    log.info(`... new resolutions is:\n${newResolutions?.map((n) => JSON.stringify(n, null, 2))}`);
    // delete and add dependency packages
    return this.finalizeDependencies(newResolutions);
  }
}
