# Webinizer

> [!IMPORTANT]\
> Webinizer is now in **_Beta_** trial. We'd greatly appreciate your feedback!

## About

Webinizer is a collection of tools to convert native applications, such as these programmed by
C/C++/Rust, to Web applications which are constructed by HTML/CSS/JavaScript and WebAssembly.

Webinizer consists of two parts; a core engine that analyzes the code and then either fixes or
highlights issues, and a web frontend to configure projects and display results. This repo consists
of the core engine, for the web frontend see the
[webinizer-webclient](https://github.com/intel/webinizer-webclient) repo.

We also provide the [webinizer-demo](https://github.com/intel/webinizer-demo) repo that holds the
demo projects and build scripts to setup Webinizer.

## Setting up Webinizer

### Run with Docker (recommended)

Webinizer provides scripts to build a Docker image that will setup everything for you and make
Webinizer ready to use out of the box.

Please follow the Docker installation and setup [guide](./documentation/installation-setup.rst) for
the detailed instructions.

### Run locally

The Webinizer also supports running locally `without` Docker. Currently this is validated on Linux
(`Ubuntu 20.04`).

Please follow the Run locally [guide](https://github.com/intel/webinizer-demo#run-webinizer-locally)
for the detailed instructions.

## Documentation

Webinizer User Manual is available under [documentation/](./documentation/) folder with below
structure.

### Using Webinizer

- [Installation and setup](./documentation/installation-setup.rst)
- [Build a simple project](./documentation/build-a-simple-project.rst)
- [Build and define a library](./documentation/build-a-module.rst)
- [Build a project with dependencies](./documentation/build-a-project-with-dependencies.rst)

### Extending Webinizer

Webinizer provides an extension mechanism for developers to extend the capabilities of the tool.

- [Extension Overview](./documentation/extensions/index.rst)
- [How to develop an Extension](./documentation/extensions/develop-an-extension.rst)
- [How to use an Extension](./documentation/extensions/use-an-extension.rst)
- [How to install an Extension](./documentation/extensions/install-an-extension.rst)
- [How to test an Extension](./documentation/extensions/use-an-extension.rst)

## Setting up the development environment

The steps to setup the development environment are similar to those described in
[Run Webinizer locally](#run-locally).

### Basic commands

- `npm run serve` to launch the core engine server and start at port 16666.
- `npm run test` to run the unit tests, see [tests/README.md](./tests/README.md) for details.
- `npm run lint` to format code with ESLint.
- `npm run doc` to generate the Webinizer Extension API document into `./docs`.
- `npm run swagger-autogen` to generate the swagger specification for server RESTful APIs , see
  [generate swagger specification](./documentation/api/swagger-spec.rst) for details.

### Recommended IDE setup

It's preferred to use [VS Code](https://code.visualstudio.com/) for development.

It's preferred to use Prettier formatter, along with `Format on Save`. Please setup the
[Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) and
[ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) extensions and
configure them accordingly.

NOTE that we set printWidth as 100 and tab width as 2.

## Contributing

We welcome contributions to Webinizer. You can find more details in
[CONTRIBUTING.md](CONTRIBUTING.md) .
