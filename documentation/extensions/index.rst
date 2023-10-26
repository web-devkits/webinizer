.. _extension-index:

Extensions Overview
###################

Webinizer provides an extension mechanism for developers to extend the capabilities of the tool. Using this mechanism, developers can develop new builders which adapt new build tools to build native applications, and new advisors and actions to handle more complex and varied types of the build issues/errors.

A ``builder`` represents a type of build tool (i.e., cmake, autotools, etc.) used during the whole build process. It is responsible for executing the build command, analyzing error messages produced in the process, and sending requests to ``AdviseManager`` with one or more tags, indicating which categories or stages the build issue belongs to.

An ``advisor`` is responsible for resolving a set of specific build issues occured during the process. It will be invoked by ``AdviseManager`` with a matched tag, conduct a more detailed global analysis among the whole project database, and finally produce a recipe containing one or more ``actions`` to suggest manual or automatic fixes to resolve the build issue.

An ``action`` represents a type of recommendation result from ``advisors``. It could be either a suggestion that requires users' manual involvement or a automatic fix, to help convert native code to Webassembly successfully.
