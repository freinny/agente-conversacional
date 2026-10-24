"""Deploy only into a new dedicated resource group; never replace existing apps."""

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from app.config import Settings  # noqa: E402
from app.services.foundry_client import FoundryNL2SQLClient  # noqa: E402
from app.services.schema_registry import SchemaRegistry  # noqa: E402
from app.services.sql_guardrails import SQLGuardrails  # noqa: E402


def az(*args):
    result = subprocess.run(
        ["az", *args, "--only-show-errors", "-o", "json"], capture_output=True, text=True
    )
    if result.returncode:
        # Don't echo arguments/body or arbitrary provider response containing secrets.
        raise RuntimeError(f"Azure CLI failed: {' '.join(args[:3])}; exit {result.returncode}")
    return json.loads(result.stdout) if result.stdout.strip() else None


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--apply", action="store_true")
    p.add_argument(
        "--resume-owned", action="store_true", help="Resume only this application-tagged group"
    )
    p.add_argument("--subscription-name", default="AP Global Sandbox")
    p.add_argument("--subscription-id", required=True)
    p.add_argument("--resource-group", required=True)
    p.add_argument("--location", required=True)
    p.add_argument("--registry", required=True)
    p.add_argument("--environment", default="acae-eisa-rrhh-demo")
    p.add_argument("--app-name", default="aca-eisa-rrhh-demo")
    p.add_argument("--foundry-group", required=True)
    p.add_argument("--foundry-account", required=True)
    p.add_argument("--foundry-deployment", required=True)
    p.add_argument(
        "--settings-file",
        type=Path,
        required=True,
        help="Private JSON containing only backend seeded auth values",
    )
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    if not args.resource_group.startswith("rg-eisa-rrhh-"):
        raise RuntimeError("A new isolated rg-eisa-rrhh-* group is required")
    matches = az("account", "list", "--all", "--query", f"[?name=='{args.subscription_name}']")
    if (
        len(matches) != 1
        or matches[0]["id"] != args.subscription_id
        or matches[0]["state"] != "Enabled"
    ):
        raise RuntimeError("Subscription exact name/ID not uniquely confirmed")
    az("account", "set", "--subscription", args.subscription_id)
    effective = az("account", "show")
    if (effective["id"], effective["name"]) != (args.subscription_id, args.subscription_name):
        raise RuntimeError("Effective subscription mismatch")
    print(f"Verified subscription: {effective['name']} ({effective['id']})", flush=True)
    group_exists = az(
        "group", "exists", "-n", args.resource_group, "--subscription", args.subscription_id
    )
    if group_exists:
        group = az(
            "group", "show", "-n", args.resource_group, "--subscription", args.subscription_id
        )
        expected = {
            "application": "eisa-rrhh-demo",
            "purpose": "academic-demo",
            "owner": "freinny",
            "data": "synthetic",
        }
        if not args.resume_owned or any(
            group.get("tags", {}).get(k) != v for k, v in expected.items()
        ):
            raise RuntimeError(
                "Refusing to modify an existing group without --resume-owned and exact EISA ownership tags"
            )
        inventory = az(
            "resource", "list", "-g", args.resource_group, "--subscription", args.subscription_id
        )
        if any(
            any(resource.get("tags", {}).get(k) != v for k, v in expected.items())
            for resource in inventory
        ):
            raise RuntimeError("Refusing a group containing resources outside EISA ownership")
    elif not az(
        "acr", "check-name", "--name", args.registry, "--subscription", args.subscription_id
    )["nameAvailable"]:
        raise RuntimeError("Registry name already in use")
    account = az(
        "cognitiveservices",
        "account",
        "show",
        "-g",
        args.foundry_group,
        "-n",
        args.foundry_account,
        "--subscription",
        args.subscription_id,
    )
    deployments = az(
        "cognitiveservices",
        "account",
        "deployment",
        "list",
        "-g",
        args.foundry_group,
        "-n",
        args.foundry_account,
        "--subscription",
        args.subscription_id,
    )
    if not any(
        d["name"] == args.foundry_deployment and d["properties"]["provisioningState"] == "Succeeded"
        for d in deployments
    ):
        raise RuntimeError("Authorized real model deployment not available")
    endpoint = (
        account["properties"]["endpoints"]["OpenAI Language Model Instance API"].rstrip("/")
        + "/openai/v1/"
    )
    # Read only the user-authorized model key. Keep it in memory and send directly
    # over TLS to a secret on the NEW Container App, never a CLI argument or log.
    model_key = az(
        "cognitiveservices",
        "account",
        "keys",
        "list",
        "-g",
        args.foundry_group,
        "-n",
        args.foundry_account,
        "--subscription",
        args.subscription_id,
    )["key1"]
    auth = json.loads(args.settings_file.read_text())
    model_settings = {
        **auth,
        "FOUNDRY_OPENAI_BASE_URL": endpoint,
        "FOUNDRY_MODEL_DEPLOYMENT": args.foundry_deployment,
        "FOUNDRY_AUTH_MODE": "key",
        "FOUNDRY_API_KEY": model_key,
        "PUBLIC_ORIGIN": "https://localhost",
    }
    settings = Settings(**{k.lower(): v for k, v in model_settings.items()})
    generated = FoundryNL2SQLClient(settings).generate(
        "¿Cuántos colaboradores tenemos en septiembre de 2026?", SchemaRegistry().prompt("2026-10")
    )
    SQLGuardrails().validate(generated.sql, required_period="2026-09")
    print("Real Foundry inference and SQL guardrails passed.", flush=True)
    if not args.apply:
        print("Preflight only; no resources created. Pass --apply to deploy.", flush=True)
        return
    subprocess.run([sys.executable, "-m", "pytest", "-q"], cwd=ROOT, check=True)
    subprocess.run(["npm", "run", "test"], cwd=ROOT / "web", check=True)
    subprocess.run(["npm", "run", "build"], cwd=ROOT / "web", check=True)
    tags = [
        "purpose=academic-demo",
        "owner=freinny",
        "data=synthetic",
        "application=eisa-rrhh-demo",
    ]
    common = ["--subscription", args.subscription_id]
    az("group", "create", "-n", args.resource_group, "-l", args.location, "--tags", *tags, *common)
    print("Created dedicated resource group.", flush=True)
    registry = az(
        "acr",
        "create",
        "-n",
        args.registry,
        "-g",
        args.resource_group,
        "-l",
        args.location,
        "--sku",
        "Basic",
        "--admin-enabled",
        "true",
        "--tags",
        *tags,
        *common,
    )
    print("Building the single app image in the dedicated registry.", flush=True)
    # Remote build avoids relying on a local Docker daemon or local image storage.
    subprocess.run(
        [
            "az",
            "acr",
            "build",
            "-r",
            args.registry,
            "-g",
            args.resource_group,
            "--subscription",
            args.subscription_id,
            "-t",
            "eisa-rrhh-demo:1.0.0",
            str(ROOT),
            "--only-show-errors",
        ],
        check=True,
    )
    digest = az(
        "acr", "repository", "show", "-n", args.registry, "--image", "eisa-rrhh-demo:1.0.0", *common
    )["digest"]
    identity = az(
        "identity",
        "create",
        "-g",
        args.resource_group,
        "-n",
        "id-eisa-rrhh-demo",
        "-l",
        args.location,
        "--tags",
        *tags,
        *common,
    )
    # Contributor cannot grant RBAC. The registry is dedicated to EISA; its
    # pull password is sent only to an app secret, never a CLI argument/log.
    registry_credentials = az("acr", "credential", "show", "-n", args.registry, *common)
    env = az(
        "containerapp",
        "env",
        "create",
        "-g",
        args.resource_group,
        "-n",
        args.environment,
        "-l",
        args.location,
        "--logs-destination",
        "none",
        "--tags",
        *tags,
        *common,
    )
    origin = "https://" + args.app_name + "." + env["properties"]["defaultDomain"]
    secret_names = {
        "DEMO_PASSWORD_HASH": "demo-password-hash",
        "SESSION_SECRET": "session-secret",
        "FOUNDRY_API_KEY": "foundry-key",
    }
    env_values = {**model_settings, "PUBLIC_ORIGIN": origin}
    secrets = [{"name": secret_names[k], "value": env_values[k]} for k in secret_names]
    secrets.append(
        {"name": "acr-pull-password", "value": registry_credentials["passwords"][0]["value"]}
    )
    env_vars = [
        {"name": k, **({"secretRef": secret_names[k]} if k in secret_names else {"value": v})}
        for k, v in env_values.items()
    ]
    hostname = origin.removeprefix("https://")
    body = {
        "location": args.location,
        "tags": dict(t.split("=", 1) for t in tags),
        "identity": {"type": "UserAssigned", "userAssignedIdentities": {identity["id"]: {}}},
        "properties": {
            "managedEnvironmentId": env["id"],
            "configuration": {
                "activeRevisionsMode": "Single",
                "secrets": secrets,
                "ingress": {
                    "external": True,
                    "targetPort": 8000,
                    "transport": "auto",
                    "allowInsecure": False,
                },
                "registries": [
                    {
                        "server": registry["loginServer"],
                        "username": registry_credentials["username"],
                        "passwordSecretRef": "acr-pull-password",
                    }
                ],
            },
            "template": {
                "containers": [
                    {
                        "name": "eisa",
                        "image": registry["loginServer"] + "/eisa-rrhh-demo@" + digest,
                        "resources": {"cpu": 0.5, "memory": "1Gi"},
                        "env": env_vars,
                        "probes": [
                            {
                                "type": kind,
                                "httpGet": {
                                    "path": path,
                                    "port": 8000,
                                    "httpHeaders": [{"name": "Host", "value": hostname}],
                                },
                                "initialDelaySeconds": 10,
                                "periodSeconds": 10,
                                "timeoutSeconds": 3,
                                "failureThreshold": 12,
                            }
                            for kind, path in [("Liveness", "/healthz"), ("Readiness", "/readyz")]
                        ],
                    }
                ],
                "scale": {"minReplicas": 1, "maxReplicas": 1},
            },
        },
    }
    token = az(
        "account", "get-access-token", "--resource", "https://management.azure.com/", *common
    )["accessToken"]
    url = f"https://management.azure.com/subscriptions/{args.subscription_id}/resourceGroups/{args.resource_group}/providers/Microsoft.App/containerApps/{args.app_name}?api-version=2025-01-01"
    with httpx.Client(timeout=90) as client:
        response = client.put(url, headers={"Authorization": "Bearer " + token}, json=body)
        if response.status_code not in {200, 201, 202}:
            raise RuntimeError(
                f"Container App create failed: HTTP {response.status_code}; {response.json().get('error', {}).get('code', 'unknown')}"
            )
    for _ in range(60):
        app = az("containerapp", "show", "-g", args.resource_group, "-n", args.app_name, *common)
        properties = app["properties"]
        if properties.get("provisioningState") == "Failed":
            raise RuntimeError("Container App provisioning failed")
        if properties.get("latestReadyRevisionName"):
            break
        time.sleep(5)
    else:
        raise RuntimeError("Container App did not become ready within 5 minutes")
    actual_origin = "https://" + properties["configuration"]["ingress"]["fqdn"]
    if actual_origin != origin:
        raise RuntimeError("Unexpected ingress hostname: verify PUBLIC_ORIGIN before use")
    output = {
        "subscription": {"name": effective["name"], "id": args.subscription_id},
        "resource_group": args.resource_group,
        "location": args.location,
        "app": args.app_name,
        "url": origin,
        "revision": properties["latestReadyRevisionName"],
        "image_digest": digest,
        "registry": args.registry,
        "environment": args.environment,
        "identity": identity["name"],
        "foundry_account": args.foundry_account,
        "foundry_deployment": args.foundry_deployment,
        "foundry_base_url": endpoint,
        "replicas": 1,
        "registry_auth": "dedicated ACR admin credential in Container App secret (Contributor cannot assign AcrPull)",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(output, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    main()
