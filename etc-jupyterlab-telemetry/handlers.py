import json
import os
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado

class RouteHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server

    @tornado.web.authenticated
    def get(self):
        print("get")

        #self.finish(json.dumps({"data":os.environ}))
        # self.finish(json.dumps({"data":type(os.environ)}))

        # if resource == 'environ':
        result = json.dumps(dict(os.environ))
        print(result)
        self.finish(result)

        # if resource == 'id':
        #     workspace_id = os.getenv("WORKSPACE_ID") if os.getenv("WORKSPACE_ID") is not None else "UNDEFINED"
        #     result = json.dumps({"workspace_id": workspace_id})
        #     print(result)
        #     self.finish(result)


def setup_handlers(web_app):
    try:
        print("setup_handlers")
        host_pattern = ".*$"
        print("web_app.settings: ", dict(web_app.settings))
        print("json.dumps(dict(os.environ)): ", json.dumps(dict(os.environ), skipkeys=True, check_circular=True, indent=4))
        base_url = web_app.settings["base_url"]
        print("base_url: ", base_url)
        # route_pattern = url_path_join(base_url, "etc-jupyterlab-telemetry", "(.*)")
        route_pattern = url_path_join(base_url, "etc-jupyterlab-telemetry", "environ")
        print("route_pattern: ", route_pattern)
        handlers = [(route_pattern, RouteHandler)]
        web_app.add_handlers(host_pattern, handlers)
    except Exception as e:
        print("Exception: ", e)
        raise e