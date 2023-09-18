.. _swagger:

Swagger
######################

This section will describe how to set up swagger specification auto-generation tool ``swagger-autogen``, how to use it to generate spec file and how to try the requests execution with the ``VSCode-extension(Swagger Viewer)`` which is a swagger spec previewer tool like ``Swagger UI``.

Generation
**********

In ``package.json``, the ``"swagger-autogen": "^2.23.5"`` npm package definition has been added in ``devDependencies``, and the ``"swagger-autogen": "node ./swagger.js"`` script command has been added in ``scripts``.

.. code-block:: shell

   $ npm install # to install the dependencies.
   $ npm run swagger-autogen # to generate the swagger specification file

The ``swagger.js`` in root is the key configuration file of the ``swagger-autogen`` tool, including the target file, endpoints source file and the schemas definitions. More details are available `here
<https://github.com/swagger-autogen/swagger-autogen#usage-with-optionals>`_.

Testing
*******





