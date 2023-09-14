.. _test-an-extension:

How to test an Extension
########################

The developers of the extensions can develop test cases for their extensions. All the test related code should be placed in folder ``${extension_root}/tests``.

How to develop a test for an Extension
***************************************

First, the extension tests should have an ``index.ts`` to initialize Webinizer and the extension for testing.

An example code of an ``index.ts`` for testing ``webinizer-extension-demo`` is below.

.. code-block:: typescript

  import * as webinizer from "webinizer";

  async function initTests() {
    try {
      await webinizer.init();
    } catch (e) {
      // stop running tests if initialization failed.
      process.exit();
    }
  }

  initTests();

  import "./demo_action_tests";
  import "./demo_advisor_tests";
  import "./demo_builder_tests";

Things to note;

* Use ``import * as webinizer from "webinizer"`` to import the :ref:`extension-api`.
* Function ``webinizer.init()`` would initialize Webinizer and all extensions.
* You can develop test cases in ``index.ts``, but it is recommended that to write test cases in other files and import them in ``index.ts``. For example, ``import ./demo_action_tests`` imports all the test cases in ``./demo_action_tests.ts``.

Some example test cases in ``demo_action_tests.ts`` of the tests of ``webinizer-extension-demo`` are below;

.. code-block:: typescript

  import * as webinizer from "webinizer";
  import { expect } from "chai";
  import path from "path";
  import { backupFolderSync, deleteFolder, renameFolder } from "./utils";
  import { DemoAction } from "../src/actions/demo_action";

  const DEMO_ACTION_ASSETS_DIR = path.join(__dirname, "assets", "actions");

  describe("action", () => {
    before(() => {
      //Backup the "assets/actions" folder
      backupFolderSync(DEMO_ACTION_ASSETS_DIR, path.join(__dirname, "assets", ".actions"));
    });

    after(() => {
      //Delete the older "assets/actions" and restore it from backup
      deleteFolder(DEMO_ACTION_ASSETS_DIR);
      renameFolder(path.join(__dirname, "assets", ".actions"), DEMO_ACTION_ASSETS_DIR);
    });

    it("DemoActionTest", async () => {
      const action = new DemoAction("Demo Action Test");
      const result = await (action as webinizer.IAction).apply();

      expect(result).to.equal(false);
    });
  });

Things to note:

* ``describe()`` defines a test category which can contain multiple test cases.
* ``it()`` defines a single test case.
* ``before()`` and ``after()`` are used to do some actions before and after running the test cases. In the example above, we backup the test assets files before running tests and restore them after running the tests.
* ``assets`` folder contains the files that the test cases would use, however other directories can be defined to achieve this. 


How to run the test of an extension
***********************************

To run the test cases of an extension, first add a ``pretest`` field and a ``test`` field into the ``scripts`` property of ``package.json``.

An example ``package.json`` of ``webinizer-extension-demo`` is below;

.. code-block:: json

  {
    //...skip some other fileds 
    "scripts": {
      "build": "rimraf dist && tsc -p .",
      "pretest": "npm run build",
      "test": "cross-env TS_NODE_PROJECT='./tsconfig.json' mocha -r ts-node/register tests/index.ts"
    }
    //...skip some other fileds
  }

Tings to note;

* Before running the test cases, you should go to ``${webinizer_root}`` and run command ``npm run build`` to build the Webinizer project. Every time you change the Webinizer code, you should run this command to recompile Webinizer project.
* After adding ``pretest`` & ``test`` into ``package.json``, you can go to ``${extension_root}`` and run ``npm run test`` or ``npm test`` to execute the test cases of the extension.
* The ``pretest`` command in ``package.json`` of ``webinizer-extension-demo`` is automatically exectued while running ``npm test``.
* To run the test cases of category ``action`` only, go to  ``${extension_root}`` and run ``npm run test -- --grep "action"``. To run test cases of multiple category, use command ``npm run test -- --grep "(action|builder)"``.
* To run a single case, go to  ``${extension_root}`` and run ``npm run test -- --grep "DemoActionTest"``. To run multiple cases, use command ``npm run test -- --grep "(DemoActionTest|DemoBuilderTest)"``.
