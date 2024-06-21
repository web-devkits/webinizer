.. _develop-an-extension:

How to develop an Extension
###########################

In this section, we will use a demo ``webinizer-extension-demo`` to demonstrate how to develop a Webinizer extension. The source code of this demo is placed in ``${webinizer_root}/extensions/webinizer-extension-demo``.

Webinizer Extension Package directory
*************************************

Below is the package directory of the ``webinizer-extension-demo``.

.. code-block:: none

  /webinizer-extension-demo
    /src
      /actions
        demo_action.ts
      /advisors
        demo_advisor.ts
      /builders
        demo_builder.ts
      index.ts
    /tests
      /assets
        /actions
          /DemoAction
            test    (test file for DemoAction)
        /advisors
          /DemoAdvisor
            /.webinizer  (project config for DemoAdvisor)
              config.json
        /builders
          /DemoBuilder   (project config for DemoBuilder)
            /.webinizer
              config.json
      demo_action_tests.ts
      demo_advisor_tests.ts
      demo_builder_tests.ts
      index.ts
      utils.ts
    package.json   
    tsconfig.json

The extension directory has the following properties;

* ``package.json`` & ``tsconfig.json`` are required to all extension packages. 
* ``package.json`` contains the npm package config data and the metadata of the extension.
* ``tsconfig.json`` contains the typescript project config data of the extension.
* ``src`` folder contains the source code of extension, while ``tests`` folder contains the test code of the extension.
* ``index.ts`` under ``src`` folder contains code that loads all the components of the extension, and this file is required to all extensions.
* The folder structure under ``tests`` can be decided by the extension developer to make it convenient for testing. 
* An extension can contain one or more actions, advisors and builders. They are placed in the corresponding folders, and they are optional. 
* ``webinizer-extension-demo`` will extend Webinizer with a DemoAction, a DemoAdvisor and a DemoBuilder.

Webinizer Extension Metadata
****************************

A Webinizer extension must contain a ``package.json`` which contains the package config data and the extension metadata. Below is an example of the metadata for ``webinizer-extension-demo``.

.. code-block:: json

  {
    "name": "webinizer-extension-demo",
    "version": "0.0.1",
    "description": "This is a demo extension for webinizer.",
    "main": "dist/index.js",
    "scripts": {
      "build": "rimraf dist && tsc -p .",
      "pretest": "npm run build",
      "test": "cross-env TS_NODE_PROJECT='./tsconfig.json' mocha -r ts-node/register tests/index.ts"
      },
    "author": "",
    "license": "ISC",
    "webinizerExtMeta": {
      "status": "enable",
      "actions": [
        {
          "__type__": "DemoAction",
          "desc": "this is demo action"
        }
      ],
      "advisors": [
        {
          "__type__": "DemoAdvisor",
          "desc": "this is demo advisor",
          "tags": [
            "demo"
          ]
        }
      ],
      "builders": [
        {
          "__type__": "DemoBuilder",
          "desc": "this is demo builder"
        }
      ]
    }
  }

Besides ``name`` & ``description``, other metadata of extension is in the property ``webinizerExtMeta``.

The details of each field of the metadata are as below:

.. list-table:: Extension Metadata fields
  :widths: 25 50 25
  :header-rows: 1

  * - Element name
    - Description
    - Required or optional
  * - name
    - The name of the extension
    - required
  * - description
    - The description of the extension
    - required 
  * - webinizerExtMeta.status
    - The status of the extension. Only when it is "enabled", the extension will be load by Webinizer.
    - required
  * - webinizerExtMeta.actions
    - Array of action items. It can be absence or empty.
    - optional 
  * - *[action]*.__type__
    - The type of an action. *[action]* means an action in the action arrary. If there is an action item in action array, the "__type__" element is required for this action item.
    - required
  * - *[action]*.desc
    - The description of an action. If there is an action item in action array, the "description" element is required for this action item.
    - required 
  * - webinizerExtMeta.advisors
    - Array of advisor items. It can be absence or empty.
    - optional
  * - *[advisor]*.__type__
    - The type of an advisor. *[advisor]* means an advisor in advisor array. If there is an advisor item in advisor array, the "__type__" element is required for this advisor item.
    - required
  * - *[advisor]*.desc
    - The description of an advisor. If there is an advisor item in advisor array, the "description" element is required for this advisor item.
    - required
  * - *[advisor]*.tags
    - The tags of the advisor pipelines that the advisor item belongs to. Each advisor pipeline has a tag to represent this pipeline. An advisor should be added to advisor pipelines, otherwise it will be never used by Webinizer. An advisor can be added to multiple advisor pipelines, thus can have multiple tags.
    - required
  * - webinizerExtMeta.builders
    - Array of builder items. It can be absence or empty.
    - optional
  * - *[builder]*.__type__
    - The type of a builder. *[builder]* means a builder in builder array. If there is a builder item in builder array, the "__type__" element is required for this builder item.
    - required
  * - *[builder]*.desc
    - The description of a builder. If there is a builder item in builder array, the "description" element is required for this builder item.
    - required

tsconfig.json
*************

A Webinizer extension must have a ``tsconfig.json`` which is the typescript project config file. Below is an example of the ``tsconfig.json`` for ``webinizer-extension-demo``.

.. code-block:: json

  {
    "extends": "../../tsconfig.base.json",
    "include": ["src/**/*", "../../typings/webinizer.d.ts"],
    "compilerOptions": {
      "outDir": "./dist"
    }
  }

Things to note;

* It should be extended from the ``${webinizer_root}/tsconfig.base.json`` file.
* It must include file ``${webinizer_root}/typings/webinizer.d.ts`` in ``include`` field, which is the declaration file for :ref:`extension-api`.
* It should specify the ``tsc`` ``outDir`` as ``./dist``.

index.ts
********

A Webinizer extension must have an ``index.ts`` in ``src`` folder which will help to load the actions, advisors, and builders of the extension. Below is the example code of ``index.ts`` of ``webinizer-extension-demo``.

.. code-block:: typescript

  import * as webinizer from "webinizer";
  import path from "path";

  const builderPath = path.join(__dirname, "builders");
  const advisorPath = path.join(__dirname, "advisors");
  const actionPath = path.join(__dirname, "actions");
  const moduleDirectories = [builderPath, advisorPath, actionPath];

  export default async function load() {
    for (const md of moduleDirectories) {
      await webinizer.loadAllModulesInDirectory(md);
    }
  }

Things to note;

* Use ``import * as webinizer from "webinizer"`` to import the :ref:`extension-api`.
* ``index.ts`` must have an export default function ``load()`` to walk through all the module directories (builder, action, advisor and so on) and load all the modules under the directories.
* Section :ref:`extension-api` explains details on available API.

Extend Webinizer with a new builder
***********************************

Below is the example code of a new builder DemoBuilder of ``webinizer-extension-demo``.

.. code-block:: typescript

  import shlex from "shlex";
  import * as webinizer from "webinizer";

  const log = webinizer.getLogger("DemoBuilderStep");

  class DemoBuilderFactory implements webinizer.IBuilderFactory {
    name = "demo_builder";
    desc = "Demo builder for webinizer extension demo";
    /* eslint-disable @typescript-eslint/no-unused-vars */
    detect(proj: webinizer.Project): DemoBuilder | null {
      // TODO. implement detect here
      return null;
    }

    createDefault(proj: webinizer.Project, options?: webinizer.IBuilderOptions): DemoBuilder {
      return new DemoBuilder(
        proj,
        0,
        options?.rootBuildFilePath || "${projectRoot}",
        options?.args || ""
      );
    }

    fromJson(proj: webinizer.Project, o: webinizer.IJsonObject, index: number): webinizer.IBuilder {
      webinizer.checkJsonType(DemoBuilder.__type__, o);
      return new DemoBuilder(
        proj,
        index,
        o.rootBuildFilePath as string,
        o.args ? (o.args as string) : ""
      );
    }
  }

  class DemoBuilder implements webinizer.IBuilder {
    static __type__ = "DemoBuilder";
    type = DemoBuilder.__type__;
    desc = "demo builder";
    command = "demo builder";
    args: string[];
    id: number;
    private _proj: webinizer.Project;
    private _rootBuildFilePath: string;

    constructor(proj: webinizer.Project, id: number, rootBuildFilePath: string, args: string) {
      this._proj = proj;
      this.id = id;
      this.args = shlex.split(args);
      this._rootBuildFilePath = rootBuildFilePath;
    }
    toJson(): webinizer.IBuilderJson {
      return {
        __type__: this.type,
        id: this.id,
        desc: this.desc,
        command: this.command,
        args: shlex.join(this.args),
        rootBuildFilePath: this._rootBuildFilePath,
      };
    }

    private async _analyzeErrors(adviseManager: webinizer.AdviseManager, errors: string) {
      adviseManager.queueRequest(new webinizer.ErrorAdviseRequest(["demo"], errors, null, this.id));
      return;
    }

    async build(adviseManager: webinizer.AdviseManager): Promise<boolean> {
      log.info("Start the build of demo builder...");
      const error = "demo builder error";
      await this._analyzeErrors(adviseManager, error);
      return false;
    }
  }

  // loading
  export default function onload() {
    webinizer.ALL_BUILDER_FACTORIES.register(DemoBuilder.__type__, new DemoBuilderFactory());
  }

Things to note;

* DemoBuilder must implement interface ``IBuilder``, implement the functions ``build()`` and ``toJson()``.
* DemoBuilder must have a factory class ``DemoBuilderFactory`` which implements interface ``IBuilderFactory`` and implements the functions ``detect()`` and ``createDefault()``.
* It should have an export default function ``onload()`` which will register the ``DemoBuilderFactory`` with DemoBuilder's type at loading time.
* Section :ref:`extension-api` explains details on available API.

Extending Webinizer with a new advisor
**************************************

Below is the example code of a new advisor DemoAdvisor of ``webinizer-extension-demo``.

.. code-block:: typescript

  import * as webinizer from "webinizer";

  class DemoAdvisorFactory implements webinizer.IAdvisorFactory {
    name = "DemoAdvisorFactory";
    desc = "Use this factory class to create DemoAdvisor instance";

    createAdvisor(): webinizer.IAdvisor {
      return new DemoAdvisor();
    }
  }

  class DemoAdvisor implements webinizer.IAdvisor {
    static __type__ = "DemoAdvisor";
    type = DemoAdvisor.__type__;
    desc = "Demo advisor for Webinizer extension demo";

    private _getSuggestionExample(): webinizer.SuggestionExample {
      const before = `This is demo advisor for Webinizer Extension Demo`;
      const after = `This is demo advisor for Webinizer Extension Demo!!!!!!`;
      return new webinizer.SuggestionExample(before, after);
    }

    private async _generateTestAdvise(
      proj: webinizer.Project,
      req: webinizer.ErrorAdviseRequest
    ): Promise<webinizer.IAdviseResult> {
      const action = new webinizer.ShowSuggestionAction(
        "error",
        `Demo Advisor for Webinizer Extension Demo.`,
        this._getSuggestionExample(),
        null
      );

      return {
        handled: true,
        recipe: new webinizer.Recipe(
          proj,
          "Recipe for demo advisor of Webinizer extension demo",
          this,
          req,
          action
        ),
      };
    }

    /* eslint-disable @typescript-eslint/no-unused-vars */
    async advise(
      proj: webinizer.Project,
      req: webinizer.IAdviseRequest,
      requestList: ReadonlyArray<webinizer.IAdviseRequest> // one can only return newRequestQueue to change it
    ): Promise<webinizer.IAdviseResult> {
      if (req instanceof webinizer.ErrorAdviseRequest) {
        const errorReq = req as webinizer.ErrorAdviseRequest;
        if (errorReq.error.includes("demo builder error")) {
          return this._generateTestAdvise(proj, errorReq);
        }
      }
      return {
        handled: false,
      };
    }
  }

  // loading
  export default function onload() {
    webinizer.registerAdvisorFactory(DemoAdvisor.__type__, new DemoAdvisorFactory());
  }


Things to note;

* DemoAdvisor must implement interface ``IAdvisor``, and implement the function ``advise()``.
* DemoAdvisor must have a factory class ``DemoAdvisorFactory`` which implements interface ``IAdvisorFactory`` and implements the function ``createAdvisor()``.
* It should have an export default function ``onload()`` which will register the ``DemoAdvisorFactory`` with DemoAdvisor's type at loading time.
* Section :ref:`extension-api` explains details on available API.

Extending Webinizer with a new action
*************************************

Below is the example code of a new action DemoAction of ``webinizer-extension-demo``

.. code-block:: typescript

  import * as webinizer from "webinizer";

  export class DemoAction implements webinizer.IAction {
    static __type__ = "DemoAction";
    type: string = DemoAction.__type__;
    desc: string;

    constructor(desc: string) {
      this.desc = desc;
    }

    async apply(): Promise<boolean> {
      return false;
    }
    toJson(): webinizer.IJsonObject {
      return {
        __type__: DemoAction.__type__,
        desc: this.desc,
      };
    }

    static fromJson(proj: webinizer.Project, o: webinizer.IJsonObject): DemoAction {
      webinizer.checkJsonType(DemoAction.__type__, o);
      return new DemoAction(o.desc as string);
    }
  }

  export default function onload() {
    webinizer.ALL_ACTION_FACTORIES.register(DemoAction.__type__, DemoAction.fromJson);
  }

Things to note;

* DemoAction must implement interface ``IAction``, and implement function ``apply()``.
* It should have an export default function ``onload()`` which will register the DemoAction with its type at loading time.
* Section :ref:`extension-api` explains details on available API.

.. _extension-api:

Webinizer Extension API
***********************

To view API details for Webinizer Extension, run ``npm run doc`` command from the ``${webinizer_root}`` directory and the API documentation will be generated under the ``docs`` folder.

Launch the file ``${webinizer_root}/docs/index.html`` in the browser to view the API documentation interactively.
