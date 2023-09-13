.. _install-an-extension:

How to install / uninstall an Extension
#######################################

Currently we install and uninstall Webinizer extensions manually.

To manually install an extension:

* Extract the extension package into ``${webinizer_root}/extensions/${extension_name}``.
* Add the advisor instances into the ``${webinizer_root}/advisor_pipelines.json``. The user could decide which tags the advisor instances will be added to and its sequence position inside the tags.
* Make sure the ``status`` field of ``webinizerExtMeta`` property in ``package.json`` is set to ``enable``.
* Add project path to the ``references`` field from the ``tsconfig.all.json`` file in ``${webinizer_root}`` as:

.. code-block:: json

  {
    "files": [],
    "include": [],
    "references": [
      { "path": "./src" },
      { "path": "./extensions/webinizer-extension-demo" },
      { "path": "./extensions/${extension_name}" },   // <-- add it here
    ]
  }

* At last, restart Webinizer to load the extensions.

To manually uninstall an extension:

* Remove the advisor instances from ``webinizer/advisor_pipelines.json``.
* Delete the ``webinizer/extensions/${extension_name}`` folder.
* Restart Webinizer to unload the extension.

Webinizer Extension Load
************************

After an extension is installed and its status is set to ``enable``, you should restart Webinizer to load the new extensions. Currently, Webinizer does not support dynamic extension loading.

Each extension will have an ``index.ts`` file which loads the extension in Webinizer. This file is used to register and load Builder Factories, Advisor Factories, Actions and other operations that should be done while loading this extension.

The ``index.ts`` of extension will be loaded by Webinizer while it starts up if the extension is enabled.
