.. _installation-setup:

Installation and setup
######################

`Webinizer` provides scripts to build a `Docker` image that will setup everything for you and make `Webinizer` ready to use out of the box.

Preparation
***********

To successfully build the docker image, the tools required are as follows;

* `Docker Engine <https://docs.docker.com/engine/install/>`_ or `Docker Desktop <https://docs.docker.com/desktop//>`_.
* `node` and `npm`
* `git`
* `curl`
* `patch`

Setup
*****

The main components in the Docker container are as follows;

* `EMSDK` :sup:`3.1.31`
* `Node` :sup:`v16.17.1`
* `Webinizer`
* `Webinizer-webclient`

These resource and toolchains will be auto installed and setup during the docker image building process.

Configure docker
----------------

Proxy settings
==============

If you have proxy settings in your system, please follow below guides to configure properly for docker.

- `Configure proxy for docker daemon guide <https://docs.docker.com/config/daemon/systemd/#httphttps-proxy>`_
- `Configure proxy for docker client guide <https://docs.docker.com/network/proxy/#configure-the-docker-client>`_

Manage docker as non-root user
==============================

- Add the docker group if it doesn't already exist:

  .. code-block:: bash

    sudo groupadd docker

- Add the connected user `$USER` to the docker group. Change the user name to match your preferred user if you do not want to use your current user:

  .. code-block:: bash

    sudo gpasswd -a $USER docker

- Either do a ``newgrp docker`` or log out/in to activate the changes to groups.

Build
-----

Clone the `webinizer-demo <https://github.com/intel/webinizer-demo>`_ repo.

.. code-block:: bash

  $ git clone https://github.com/intel/webinizer-demo.git webinizer-demo

``webinizer-demo/build/build.sh`` is the script to build docker image and pack necessary resources. Run the following command to start the building & packing process.

.. code-block:: bash

  # Please make sure that `target_folder` doesn't exist before running the command
  $ cd webinizer-demo/build
  $ ./build.sh target_folder


Check targets
-------------

``Webinizer:latest`` docker image and the following resources under ``target_folder/release`` directory will be generated once the build process successfully finishes.

.. code-block:: bash

  target_folder/release
  ├── README.md
  ├── webinizer_demo/  # the directory containing the native projects to demo and start script
  └── webinizer_img.tar # docker image archive file


List the docker images to check if ``Webinizer:Latest`` is generated successfully.

.. code-block:: bash

  $ Docker images
  REPOSITORY           TAG       IMAGE ID       CREATED              SIZE
  webinizer            latest    be719be22d18   About a minute ago   2.47GB

There is no further steps to be taken if ``Webinizer:latest`` docker image and release files are available locally.

`If you want to deploy on another clean host from the previous generated release resources, then following command should be executed.`

.. code-block:: bash

  # Load webinizer:latest docker image from archive file
  $ docker load<release/webinizer_image.tar

Starting up the server
**********************

Run following command to start the ``webinizer`` docker container, and ``webinizer`` server and ``webclient`` will start automatically with the container startup.

.. code-block:: bash

  # Ensure that you are in the directory of `target_folder/release/webinizer_demo` folder first
  $ cd release/webinizer_demo
  # Ensure that ./run.sh is executable before running
  $ ./run.sh $(pwd)/native_projects 18888

The ``run.sh`` script will guide you through some user configurations setup for `webinizer` before launching the container. Then `webinizer` is available on ``http://127.0.0.1:18888``
