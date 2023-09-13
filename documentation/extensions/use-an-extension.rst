.. _use-an-extension:

How to use a Webinizer Extension
################################

Enabling and disabling extensions
*********************************

There is a ``status`` field of ``webinizerExtMeta`` property in ``package.json`` which indicates if the extension is enabled or disabled. If extension is disabled, the components of the extension will not be loaded by Webinizer. Modify the ``status`` field of ``webinizerExtMeta`` property of ``package.json`` to enable or disable the extension. After modifying the ``status`` field, Webinizer should be restarted for the changes to take effect.

Please note that it is not encouraged to modify the ``status`` from ``package.json`` directly. It is highly recommended that update the ``status`` of an extension from ``Settings`` page in the Webinizer Web UI.

Advisor Pipeline
****************

If a Webinizer extension contains advisors, besides loading the advisor factories, it also needs to add the advisor to ``advisor_pipelines.json`` under the root directory of Webinizer. Otherwise, the advisor will be never used.

Below is an example of adding TestAdvisor to ``advisor_pipelines.json``.

.. code-block:: json

    {
        "__type__": "AdvisorPipelineConfig",
        "pipelines": [
            {
                "tag": "default",
                "advisors": [{ "__type__": "ErrorsNotHandledAdvisor" }]
            },
            {
                "tag": "demo",
                "advisors": [{ "__type__": "DemoAdvisor" }]
            },

            {
                "tag": "pipeline1",
                "advisors": [{ "__type__": "advisor1" }, { "__type__": "advisor2" }, { "__type__": "advisor3" }]
            }
        ]
    } 


Things to note:

* Each advisor pipeline has a tag.
* You can add an advisor to multiple tags/pipelines. In the example above, ``DemoAdvisor`` is added to pipeline ``demo``.
* In each pipeline's advisor list, the order of the advisors is very important. When a request is sent to a pipeline, the request will be passed to each advisor in this order. In the example above, if a request is sent to ``pipeline1``, ``advisor1`` will be the first advisor that try to handle this request, then ``advisor2``, ``advisor3`` until the request is handled, or the advisor list reaches its end.
