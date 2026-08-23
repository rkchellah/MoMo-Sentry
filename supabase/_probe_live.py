import json
import pathlib
import urllib.error
import urllib.request

env: dict[str, str] = {}
for line in pathlib.Path(__file__).resolve().parents[1].joinpath("frontend", ".env.local").read_text().splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    env[key] = value

url = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
key = env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Accept": "application/json",
}


def get(path: str) -> tuple[int, str]:
    req = urllib.request.Request(url + path, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            return response.status, response.read().decode()
    except urllib.error.HTTPError as err:
        return err.code, err.read().decode()


wanted = [
    "fraud_checks",
    "momo_profiles",
    "agent_sessions",
    "booth_agents",
    "booth_locations",
]

req = urllib.request.Request(
    url + "/rest/v1/",
    headers={**headers, "Accept": "application/openapi+json"},
)
try:
    with urllib.request.urlopen(req, timeout=20) as response:
        spec = json.loads(response.read().decode())
except Exception as exc:
    spec = None
    print("openapi_error", type(exc).__name__, exc)

if spec:
    paths = spec.get("paths", {})
    defs = spec.get("definitions") or spec.get("components", {}).get("schemas", {})
    print("=== TABLES IN REST SCHEMA ===")
    for table in wanted:
        present = f"/{table}" in paths
        props: list[str] = []
        match = None
        for name, schema in defs.items():
            if name == table or name.endswith("." + table):
                match = schema
                break
        if isinstance(match, dict):
            props = sorted((match.get("properties") or {}).keys())
        status = "present" if present else "MISSING"
        print(f"{table}: {status} cols={props}")

print()
print("=== ANON SELECT (no JWT) ===")
print("200 + [] = table exists, RLS hid rows from anon (expected after 003)")
print("404 / PGRST205 = table missing")
print("200 + rows = RLS off or a public policy (leak if fraud/booth tables)")
for table, select in [
    ("fraud_checks", "id"),
    ("momo_profiles", "user_id,role"),
    ("agent_sessions", "user_id"),
    ("booth_agents", "id,name"),
    ("booth_locations", "name"),
]:
    status, body = get(f"/rest/v1/{table}?select={select}&limit=3")
    snippet = body[:300].replace("\n", " ")
    print(f"{table}: HTTP {status} {snippet}")
