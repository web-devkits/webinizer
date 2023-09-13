.. _webinizer_docs:

Welcome to Webinizer's documentation!
=====================================

Webinizer is a tool to help you bring applications to the Web. The initial functionality accelerates the process of converting native code (such as C, C++) to build for Webassembly (WASM). It can be used to analyze your codebase and provide advice and in some cases automatically convert both build configuration and code to enable WASM builds. Webinizer can be extended with new build tools, languages, and code analyzers and advisors. In future Webinizer will check dependencies and search for WASM conversions in shared repositories (both public and private). Below is an overview of our documentation.

.. toctree::
   :maxdepth: 1
   :caption: Using Webinizer

   installation-setup.rst
   build-a-simple-project.rst
   build-a-module.rst
   build-a-project-with-dependencies.rst

.. toctree::
   :maxdepth: 1
   :caption: Extending Webinizer

   extensions/index.rst
   extensions/develop-an-extension.rst
   extensions/use-an-extension.rst
   extensions/install-an-extension.rst
   extensions/test-an-extension.rst
   

