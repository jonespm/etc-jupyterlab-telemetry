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
    def get(self, resource):

        if resource == 'id':
            workspace_id = os.getenv("WORKSPACE_ID") if os.getenv("WORKSPACE_ID") is not None else "UNDEFINED"
            result = json.dumps(workspace_id)
            self.finish(result)

        if resource == 'config':
            with open(os.path.join(os.path.dirname(__file__), 'config.json'), 'r') as config_json:
                self.finish(config_json.read())


def setup_handlers(web_app):
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]
    route_pattern = url_path_join(base_url, "etc-jupyterlab-telemetry", "(.*)")
    handlers = [(route_pattern, RouteHandler)]
    web_app.add_handlers(host_pattern, handlers)
