from __future__ import annotations

from tester_qa.server.schemas import ApiRoute


ROUTES = [
    ApiRoute("GET", "/projects", "list_projects"),
    ApiRoute("GET", "/projects/{id}/health", "project_health"),
    ApiRoute("GET", "/incidents", "list_incidents"),
    ApiRoute("GET", "/reports", "list_reports"),
    ApiRoute("GET", "/evidence", "list_evidence"),
    ApiRoute("GET", "/memory/search", "search_memory"),
    ApiRoute("POST", "/browser/inspect", "browser_inspect"),
    ApiRoute("POST", "/project/healthcheck", "project_healthcheck"),
    ApiRoute("POST", "/incident/create", "incident_create"),
]


def route_manifest() -> list[dict]:
    return [route.to_dict() for route in ROUTES]
