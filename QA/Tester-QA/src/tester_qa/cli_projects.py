"""CLI commands for multi-project management."""
from __future__ import annotations

import json
import sys
from pathlib import Path

from tester_qa.projects.project_indexer import ProjectIndexer
from tester_qa.projects.scanner import MultiProjectScanner


def cmd_scan(args) -> None:  # noqa: ANN001
    """Scan a path for projects."""
    path = args.path if hasattr(args, "path") and args.path else "."
    print(f"[Tester-QA] Scanning: {Path(path).resolve()}")

    indexer = ProjectIndexer()
    results = indexer.index_and_save(path)

    print(f"[Tester-QA] Found {len(results)} project(s):\n")
    for project in results:
        name = project.get("name", "unknown")
        ptype = project.get("type", "standalone")
        risk = project.get("risk_level", "medium")
        frameworks = ", ".join(project.get("frameworks", []))
        print(f"  • {name} [{ptype}] risk={risk}")
        if frameworks:
            print(f"    frameworks: {frameworks}")
        runtimes = project.get("runtimes", [])
        if runtimes:
            ports = [str(r.get("port", "?")) for r in runtimes if r.get("port")]
            if ports:
                print(f"    ports: {', '.join(ports)}")
        print()

    print(f"[Tester-QA] Saved to config/projects.json")


def cmd_list(args) -> None:  # noqa: ANN001
    """List registered projects."""
    indexer = ProjectIndexer()
    projects = indexer.list_projects()

    if not projects:
        print("[Tester-QA] No projects registered. Run: tester-qa projects scan <path>")
        return

    print(f"[Tester-QA] {len(projects)} registered project(s):\n")
    for project in projects:
        name = project.get("name") or project.get("id", "unknown")
        path = project.get("path", "?")
        risk = project.get("risk_level", "?")
        enabled = project.get("enabled", True)
        status = "✓" if enabled else "✗"
        print(f"  {status} {name} ({risk}) — {path}")


def cmd_register(args) -> None:  # noqa: ANN001
    """Register a project manually."""
    project_id = args.id
    path = args.path
    tags = args.tags.split(",") if hasattr(args, "tags") and args.tags else []

    indexer = ProjectIndexer()
    entry = indexer.register_project(project_id, path, tags=tags)
    print(f"[Tester-QA] Registered: {entry['id']} → {entry['path']}")


def cmd_remove(args) -> None:  # noqa: ANN001
    """Remove a project from registry."""
    project_id = args.id
    indexer = ProjectIndexer()
    if indexer.remove_project(project_id):
        print(f"[Tester-QA] Removed: {project_id}")
    else:
        print(f"[Tester-QA] Not found: {project_id}")
        sys.exit(1)


def cmd_inspect(args) -> None:  # noqa: ANN001
    """Inspect a specific project."""
    project_id = args.id
    indexer = ProjectIndexer()
    project = indexer.get_project(project_id)

    if not project:
        print(f"[Tester-QA] Project not found: {project_id}")
        print("[Tester-QA] Run: tester-qa projects list")
        sys.exit(1)

    print(json.dumps(project, indent=2, ensure_ascii=False, default=str))


def cmd_server(args) -> None:  # noqa: ANN001
    """Start the Control Center API server."""
    port = int(args.port) if hasattr(args, "port") and args.port else 7700
    host = args.host if hasattr(args, "host") and args.host else "0.0.0.0"

    from tester_qa.server.control_center_api import start_server
    start_server(host=host, port=port)


def register_project_commands(subparsers) -> None:  # noqa: ANN001
    """Register multi-project CLI subcommands."""
    # projects group
    projects_parser = subparsers.add_parser("projects", help="Multi-project management")
    projects_sub = projects_parser.add_subparsers(dest="projects_cmd")

    # scan
    scan_parser = projects_sub.add_parser("scan", help="Scan path for projects")
    scan_parser.add_argument("path", nargs="?", default=".", help="Path to scan")
    scan_parser.set_defaults(func=cmd_scan)

    # list
    list_parser = projects_sub.add_parser("list", help="List registered projects")
    list_parser.set_defaults(func=cmd_list)

    # register
    reg_parser = projects_sub.add_parser("register", help="Register a project")
    reg_parser.add_argument("id", help="Project ID")
    reg_parser.add_argument("path", help="Project path")
    reg_parser.add_argument("--tags", default="", help="Comma-separated tags")
    reg_parser.set_defaults(func=cmd_register)

    # remove
    rm_parser = projects_sub.add_parser("remove", help="Remove a project")
    rm_parser.add_argument("id", help="Project ID")
    rm_parser.set_defaults(func=cmd_remove)

    # inspect
    inspect_parser = projects_sub.add_parser("inspect", help="Inspect a project")
    inspect_parser.add_argument("id", help="Project ID")
    inspect_parser.set_defaults(func=cmd_inspect)

    # server
    server_parser = subparsers.add_parser("server", help="Start Control Center API")
    server_parser.add_argument("--port", default="7700", help="Port (default: 7700)")
    server_parser.add_argument("--host", default="0.0.0.0", help="Host (default: 0.0.0.0)")
    server_parser.set_defaults(func=cmd_server)
