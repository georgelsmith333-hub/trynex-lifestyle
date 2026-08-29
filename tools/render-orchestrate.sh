#!/usr/bin/env bash
#
# Render orchestrator for the TryNex 4-Render multi-route topology.
#
# Modes (positional arg or $MODE):
#   inventory   list owners + TryNex services with role/plan/suspension/last deploy (read-only)
#   create      create a NEW web service cloned from the source primary, forced to
#               TRYNEX_RUNTIME_ROLE=primary, then deploy + probe it       (MUTATES; APPLY=true)
#   promote     promote an EXISTING service to primary (copy env, force role,
#               disable backup sync, deploy, probe)                     (MUTATES; APPLY=true)
#   verify      probe one URL: liveness/write-route/admin-route/sitemap (read-only)
#   selftest    build the create payload from an embedded fixture and assert masking;
#               needs no network and no key — runnable in any sandbox
#
# Environment:
#   RENDER_API_KEY       required for every mode except selftest (never printed)
#   APPLY                must be "true" for create/promote; anything else = dry run
#   SOURCE_PRIMARY       service name/id to clone env+config from (default: trynex-api)
#   APPLY_TARGET / TARGET_SERVICE   service id/name/URL to promote (default: newest TryNex)
#   NEW_SERVICE_NAME     name for create (default: trynex-api-main) — becomes the onrender subdomain
#   NEW_SERVICE_PLAN     free | starter | ... (default: free)
#   NEW_SERVICE_REGION   oregon | frankfurt | ... (default: oregon)
#   NEW_SERVICE_BRANCH   branch to build (default: main)
#   REPO_URL             repository (default: the TryNex repo)
#   CREATE_EXTRA_JSON    optional JSON object merged into the service details (schema escape hatch)
#   CREATE_SHAPE         nested (default; details under serviceDetails) | flat (all fields
#                        at the top level) — flip this if Render answers 400 on field placement
#   VERIFY_URL           target for verify mode
#   FORCE                bypass the single-write-primary guard (NOT recommended)
#
# Guarantees enforced here:
#   - never prints RENDER_API_KEY or any secret env VALUE (names + lengths only)
#   - refuses to create/promote while another LIVE service already claims the
#     primary role, unless FORCE=true (two schedulers/backup writers on one Neon
#     topology is the exact failure mode this migration exists to remove)
#   - create/promote always write TRYNEX_RUNTIME_ROLE=primary, BACKUP_SYNC_ENABLED=false
#     and never copy PORT
#
# API schema reference: https://api-docs.render.com/reference/create-service
# Runbook: docs/FOUR_RENDER_MULTI_ROUTE_CONTRACT_2026-08-29.md

set -euo pipefail

API="https://api.render.com/v1"
MODE="${1:-${MODE:-inventory}}"
APPLY="${APPLY:-false}"
SOURCE_PRIMARY="${SOURCE_PRIMARY:-trynex-api}"
NEW_SERVICE_NAME="${NEW_SERVICE_NAME:-trynex-api-main}"
NEW_SERVICE_PLAN="${NEW_SERVICE_PLAN:-free}"
NEW_SERVICE_REGION="${NEW_SERVICE_REGION:-oregon}"
NEW_SERVICE_BRANCH="${NEW_SERVICE_BRANCH:-main}"
REPO_URL="${REPO_URL:-https://github.com/georgelsmith333-hub/trynex-lifestyle}"
CREATE_EXTRA_JSON="${CREATE_EXTRA_JSON:-}"
CREATE_SHAPE="${CREATE_SHAPE:-nested}"
VERIFY_URL="${VERIFY_URL:-}"
FORCE="${FORCE:-false}"
DEPLOY_POLL_TRIES="${DEPLOY_POLL_TRIES:-40}"
DEPLOY_POLL_SLEEP="${DEPLOY_POLL_SLEEP:-15}"

# Keys whose VALUES must never reach a log.
SECRET_KEY_RE='SECRET|TOKEN|KEY|PASSWORD|PASSWD|DATABASE|REDIS|BUCKET|ACCOUNT|WEBHOOK|CHAT|CREDENTIAL|SIGNING|PRIVATE|DSN|CONNECTION|_URL'

mask_value() {
  local key="$1" value="${2:-}"
  if echo "$key" | grep -qiE "$SECRET_KEY_RE"; then
    printf '*** (masked: %s chars) ***' "${#value}"
  else
    printf '%s' "$value"
  fi
}

need_key() {
  if [ -z "${RENDER_API_KEY:-}" ]; then
    echo "ERROR: RENDER_API_KEY is empty/unset. Add it as a GitHub Actions repository secret." >&2
    exit 2
  fi
}

api_get() {
  curl -fsS --max-time 45 -H "Authorization: Bearer ${RENDER_API_KEY}" -H 'accept: application/json' "${API}$1"
}

# api_mutate METHOD PATH JSON -> prints "HTTP_CODE\nBODY"; never aborts on 4xx so
# the caller can show Render's own field-level error message.
api_mutate() {
  local method="$1" path="$2" data="$3"
  local out code body
  out=$(curl -sS --max-time 120 -X "$method" \
    -H "Authorization: Bearer ${RENDER_API_KEY}" -H 'content-type: application/json' -H 'accept: application/json' \
    -w $'\n%{http_code}' -d "$data" "${API}${path}" 2>&1) || { printf '000\n%s\n' "$out"; return 1; }
  code=$(printf '%s' "$out" | tail -1)
  body=$(printf '%s' "$out" | sed '$d')
  printf '%s\n%s\n' "$code" "$body"
  case "$code" in 2*) return 0 ;; *) return 1 ;; esac
}

# ── env helpers ──────────────────────────────────────────────────────────────
# Canonical JSON array [{"key":..,"value":..}, ...] for one service.
service_env_array() {
  api_get "/services/$1/env-vars" \
    | jq -c '[.envVars[]? | (.envVar // .) | {key: (.key // ""), value: (.value // null)}]'
}

role_of_env() { jq -r 'map(select(.key=="TRYNEX_RUNTIME_ROLE"))[0].value // "unset"' 2>/dev/null | head -1; }

# Keys the source service stores as secret FILES cannot be read as values, so a
# clone would silently boot without them. Detect instead of guessing.
uncloneable_keys() { jq -r 'map(select(.value==null)) | map(.key) | join(" ")'; }

# ── payload construction (shared by create; pure so selftest can exercise it) ─
# args: SOURCE_ENV_JSON(as text) SOURCE_SERVICE_JSON(as text) OUT_PAYLOAD_FILE
build_create_payload() {
  local env_json="$1" service_json="$2" out="$3"

  # Copy only readable values; drop per-service/identity fields and the role/scheduler trio
  # which are forced below.
  local copied
  copied=$(printf '%s' "$env_json" | jq -c '[
      .[]
      | select(.value != null)
      | select(.key | test("^(PORT|TRYNEX_RUNTIME_ROLE|SCHEDULER_ENABLED|BACKUP_SYNC_ENABLED|RENDER_API_KEY)$") | not)
      | {key, value}
    ]')

  # Service-detail fields worth cloning (missing/blank ones are dropped).
  local details
  details=$(printf '%s' "$service_json" | jq -c '{
      buildCommand:    (.serviceDetails.buildCommand // .buildCommand // null),
      startCommand:    (.serviceDetails.startCommand // .startCommand // null),
      runtime:         (.serviceDetails.runtime // .runtime // null),
      healthCheckPath: (.serviceDetails.healthCheckPath // null),
      dockerfilePath:  (.serviceDetails.dockerfilePath // null),
      dockerCommand:   (.serviceDetails.dockerCommand // null),
      dockerContext:   (.serviceDetails.dockerContext // null)
    } | with_entries(select(.value != null and .value != ""))')
  # rootDir is a documented TOP-LEVEL create field, not a serviceDetails field.
  local root_dir
  root_dir=$(printf '%s' "$service_json" | jq -r '.rootDir // .serviceDetails.rootDir // empty')
  if [ -n "$CREATE_EXTRA_JSON" ]; then
    details=$(jq -cn --argjson d "$details" --argjson x "$CREATE_EXTRA_JSON" '$d + $x')
  fi
  # Region/plan belong to the service, not the blueprint copy of the old one.
  local plan region
  plan="${NEW_SERVICE_PLAN:-$(printf '%s' "$service_json" | jq -r '.plan // .serviceDetails.planName // "free"')}"
  region="${NEW_SERVICE_REGION:-$(printf '%s' "$service_json" | jq -r '.region // .serviceDetails.region // "oregon"')}"

  local forced
  forced=$(jq -cn --argjson env "$copied" '
      $env
      + [ {key:"TRYNEX_RUNTIME_ROLE", value:"primary"},
          {key:"BACKUP_SYNC_ENABLED", value:"false"},
          {key:"SCHEDULER_ENABLED",   value:"true"} ]
      | unique_by(.key)')

  jq -cn --arg name "$NEW_SERVICE_NAME" --arg repo "$REPO_URL" --arg branch "$NEW_SERVICE_BRANCH" \
         --argjson env "$forced" --argjson d "$details" --arg plan "$plan" --arg region "$region" \
         --arg shape "$CREATE_SHAPE" --arg rootDir "$root_dir" '
    { type: "web_service", name: $name, repo: $repo, branch: $branch,
      autoDeploy: "yes", envVars: $env, region: $region }
    + (if $rootDir == "" then {} else { rootDir: $rootDir } end)
    + (if $shape == "flat"
       then ($d + {planName: $plan})
       else { serviceDetails: ($d + {planName: $plan, region: $region}) }
       end)' > "$out"
}

# Masked, human-readable preview of a create payload (never contains secret values).
describe_create_payload() {
  local payload="$1"
  echo "  name      : $(jq -r '.name' "$payload")"
  echo "  repo      : $(jq -r '.repo' "$payload")  branch=$(jq -r '.branch' "$payload")"
  echo "  plan      : $(jq -r '(.planName // .serviceDetails.planName // "?")' "$payload")  region=$(jq -r '(.region // .serviceDetails.region // "?")' "$payload")"
  echo "  build/start: $(jq -r '(.serviceDetails.buildCommand // .buildCommand // "<repo default>")' "$payload")  |  $(jq -r '(.serviceDetails.startCommand // .startCommand // "<repo default>")' "$payload")"
  echo "  env keys copied: $(jq -r '[.envVars[].key] | sort | join(" ")' "$payload")"
  echo "  role/scheduler : $(jq -r '[.envVars[] | select(.key|test("TRYNEX_RUNTIME_ROLE|SCHEDULER_ENABLED|BACKUP_SYNC_ENABLED")) | "\(.key)=\(.value)"] | join(" ")' "$payload")"
}

# ── probes ───────────────────────────────────────────────────────────────────
probe_url() {
  local url="$1"
  echo "  probing $url"
  echo "  -- /api/health/liveness (expect runtimeRole=primary) --"
  curl -fsS --max-time 45 "$url/api/health/liveness" 2>/dev/null | head -c 400 || echo "    (not answering yet)"
  echo
  echo "  -- POST /api/__probe (expect 404 JSON from the API: writes are accepted by this origin) --"
  curl -sS -o /dev/null -w '    HTTP %{http_code}\n' --max-time 45 -X POST \
    -H 'content-type: application/json' -d '{}' "$url/api/__probe" 2>/dev/null || echo "    HTTP 000 (unreachable)"
  echo "  -- /api/admin/system/health (expect 401/403, never 5xx) --"
  curl -sS -o /dev/null -w '    HTTP %{http_code}\n' --max-time 45 "$url/api/admin/system/health" 2>/dev/null || echo "    HTTP 000 (unreachable)"
  echo "  -- /api/sitemap.xml (expect 200) --"
  curl -sS -o /dev/null -w '    HTTP %{http_code}\n' --max-time 45 "$url/api/sitemap.xml" 2>/dev/null || echo "    HTTP 000 (unreachable)"
}

wait_for_live() {
  local service_id="$1" deploy_id="$2" i status
  for i in $(seq 1 "$DEPLOY_POLL_TRIES"); do
    sleep "$DEPLOY_POLL_SLEEP"
    status=$(api_get "/services/${service_id}/deploys/${deploy_id}" | jq -r '.deploy.status // "unknown"')
    echo "  deploy status: $status"
    case "$status" in
      live) return 0 ;;
      build_failed|update_failed|canceled|deactivated) echo "  FAILED deploy ($status)"; return 1 ;;
    esac
  done
  echo "  timed out waiting for the deploy to go live"
  return 1
}

trigger_deploy() {
  local service_id="$1" code body resp
  resp=$(api_mutate POST "/services/${service_id}/deploys" '{"clearCache":false,"git":{"branch":"main","ref":"main"}}' 2>/dev/null) \
    || resp=$(api_mutate POST "/services/${service_id}/deploys" '{"clearCache":false}')
  code=$(printf '%s' "$resp" | sed -n 1p)
  body=$(printf '%s' "$resp" | tail -n +2)
  echo "  deploy request HTTP $code"
  DEPLOY_ID=$(printf '%s' "$body" | jq -r '.deploy.id // empty' 2>/dev/null || true)
  echo "  deploy id: ${DEPLOY_ID:-<none>}"
}

# ── guards ───────────────────────────────────────────────────────────────────
# Refuse a second live writer. args: ALL_SERVICES_JSON  (services list)
guard_single_writer() {
  local all="$1"
  if [ "$FORCE" = "true" ]; then
    echo "!! FORCE=true — single-write-primary guard bypassed"
    return 0
  fi
  local live_names
  live_names=$(printf '%s' "$all" | jq -r '[.services[]
      | select((.suspended // "not_suspended") | tostring | test("suspended") | not)
      | select(.name | test("trynex"; "i"))
      | "\(.name)"] | join(", ")')
  echo "== live TryNex services: ${live_names:-none}"
  # Check each live TryNex service's role.
  local offenders=""
  while read -r sid; do
    [ -z "$sid" ] && continue
    local role
    role=$(service_env_array "$sid" | role_of_env)
    case "$role" in
      primary|promoted|unset)
        # `unset` defaults to primary inside the app (app.ts), so it counts.
        local suspended
        suspended=$(printf '%s' "$all" | jq -r --arg id "$sid" '.services[] | select(.id==$id) | (.suspended|tostring)')
        if [ "$suspended" != "suspended" ]; then
          offenders+="  - $(printf '%s' "$all" | jq -r --arg id "$sid" '.services[] | select(.id==$id) | .name') (role=${role}) id=$sid\n"
        fi ;;
    esac
  done < <(printf '%s' "$all" | jq -r '.services[] | select(.name | test("trynex"; "i")) | .id')

  if [ -n "$offenders" ]; then
    echo "ERROR: refusing to create/promote a primary while another LIVE service already writes:"
    printf '%b' "$offenders"
    echo "Re-run with FORCE=true only after the old primary is suspended or re-roled to standby."
    return 1
  fi
  echo "== guard: no live service currently claims the primary role — safe to proceed"
}

# ── selftest (no network, no key) ────────────────────────────────────────────
run_selftest() {
  local tmp fixture_env fixture_service payload fail=0
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' RETURN

  cat > "$tmp/service.json" <<'JSON'
{"id":"srv-old","name":"trynex-api","type":"web_service","rootDir":"artifacts/api-server",
 "plan":"free","region":"oregon","suspended":"suspended",
 "serviceDetails":{"buildCommand":"pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server build",
                   "startCommand":"node dist/index.mjs","runtime":"node","healthCheckPath":"/api/healthz"}}
JSON
  cat > "$tmp/env.json" <<'JSON'
[{"key":"DATABASE_URL","value":"postgres://user:SUPERSECRETPASSWORD@ep-old.us-east-2.aws.neon.tech/db"},
 {"key":"JWT_SECRET","value":"jwt-top-secret-value"},
 {"key":"NODE_ENV","value":"production"},
 {"key":"PORT","value":"10000"},
 {"key":"TRYNEX_RUNTIME_ROLE","value":"primary"},
 {"key":"BACKUP_SYNC_ENABLED","value":"true"},
 {"key":"SCHEDULER_ENABLED","value":"true"},
 {"key":"SITE_URL","value":"https://trynex-lifestyle-shop.pages.dev"}]
JSON

  payload="$tmp/payload.json"
  build_create_payload "$(cat "$tmp/env.json")" "$(cat "$tmp/service.json")" "$payload"

  check() { # desc, condition already evaluated via jq expression
    local desc="$1" expr="$2"
    if jq -e "$expr" >/dev/null < "$payload"; then echo "  PASS  $desc"; else echo "  FAIL  $desc"; fail=1; fi
  }

  echo "== selftest: create payload construction + secret masking"
  check "type is web_service"            '.type == "web_service"'
  check "name uses the configured new name" '.name == "trynex-api-main"'
  check "PORT is not copied"             '[.envVars[].key] | index("PORT") == null'
  check "role forced to primary"         '[.envVars[] | select(.key=="TRYNEX_RUNTIME_ROLE")][0].value == "primary"'
  check "backup sync forced off"         '[.envVars[] | select(.key=="BACKUP_SYNC_ENABLED")][0].value == "false"'
  check "scheduler forced on"            '[.envVars[] | select(.key=="SCHEDULER_ENABLED")][0].value == "true"'
  check "non-secret env copied"          '[.envVars[] | select(.key=="NODE_ENV")][0].value == "production"'
  check "build/start cloned"             '((.serviceDetails // .).startCommand == "node dist/index.mjs") and (((.serviceDetails // .).buildCommand // "")|length) > 0'
  check "plan/region present"            '((.serviceDetails // .).planName == "free") and (((.serviceDetails // .).region // "")|length) > 0'
  check "rootDir is top level"           '.rootDir == "artifacts/api-server" and ((.serviceDetails | has("rootDir")) | not)'

  echo "== selftest: payload shapes"
  local flat saved_shape
  flat="$tmp/flat.json"
  saved_shape="$CREATE_SHAPE"
  CREATE_SHAPE=flat
  build_create_payload "$(cat "$tmp/env.json")" "$(cat "$tmp/service.json")" "$flat"
  CREATE_SHAPE="$saved_shape"
  if jq -e '(.serviceDetails == null) and (.buildCommand != null) and (.planName == "free")
            and ([.envVars[].key] | index("TRYNEX_RUNTIME_ROLE") != null)' > /dev/null < "$flat"; then
    echo "  PASS  CREATE_SHAPE=flat yields a top-level details body"
  else
    echo "  FAIL  CREATE_SHAPE=flat payload: $(cat "$flat")"; fail=1
  fi
  if jq -e '(.region == "oregon") and (.type == "web_service")' > /dev/null < "$flat"; then
    echo "  PASS  flat shape keeps region/type"
  else
    echo "  FAIL  flat shape lost region/type"; fail=1
  fi
  check "no duplicate env keys"          '([.envVars[].key] | length) == ([.envVars[].key] | unique | length)'

  echo "== selftest: masking"
  preview=$( { describe_create_payload "$payload"; } 2>&1 )
  if printf '%s' "$preview" | grep -qF 'SUPERSECRETPASSWORD'; then
    echo "  FAIL  secret value leaked into the preview"; fail=1
  else
    echo "  PASS  DATABASE_URL value never appears in the preview (keys listed only)"
  fi
  if printf '%s' "$preview" | grep -qF 'jwt-top-secret-value'; then
    echo "  FAIL  JWT_SECRET value leaked into the preview"; fail=1
  else
    echo "  PASS  JWT_SECRET value never appears in the preview"
  fi
  if printf '%s' "$preview" | grep -qF 'SITE_URL'; then
    echo "  PASS  env key NAMES are printed for operator review"
  else
    echo "  FAIL  preview did not list env key names"; fail=1
  fi

  echo "== selftest: uncloneable (secret-file) detection"
  missing=$(printf '%s' '[{"key":"R2_SECRET_FILE","value":null}]' | uncloneable_keys)
  if [ "$missing" = "R2_SECRET_FILE" ]; then
    echo "  PASS  null-valued keys are detected (would block a silent incomplete clone)"
  else
    echo "  FAIL  uncloneable_keys returned '$missing'"; fail=1
  fi

  echo "== selftest: role parsing"
  if [ "$(printf '%s' '[{"key":"TRYNEX_RUNTIME_ROLE","value":"standby"}]' | role_of_env)" = "standby" ]; then
    echo "  PASS  role_of_env reads standby"
  else
    echo "  FAIL  role_of_env"; fail=1
  fi
  if [ "$(printf '%s' '[{"key":"NODE_ENV","value":"production"}]' | role_of_env)" = "unset" ]; then
    echo "  PASS  role_of_env defaults to unset (app treats unset as primary)"
  else
    echo "  FAIL  role_of_env unset"; fail=1
  fi

  if [ "$fail" -eq 0 ]; then echo "== selftest OK"; else echo "== selftest FAILED"; exit 1; fi
}

# ── main ─────────────────────────────────────────────────────────────────────
if [ "$MODE" = "selftest" ]; then
  run_selftest
  exit 0
fi

need_key

if [ "$MODE" = "verify" ]; then
  [ -n "$VERIFY_URL" ] || { echo "ERROR: VERIFY_URL is required for verify mode" >&2; exit 2; }
  echo "== verify $VERIFY_URL"
  probe_url "${VERIFY_URL%/}"
  exit 0
fi

OWNERS_JSON=$(api_get "/owners")
OWNER_ID=$(echo "$OWNERS_JSON" | jq -r '.owner.id // .[0].owner.id // empty')
[ -n "$OWNER_ID" ] || { echo "ERROR: could not determine Render owner"; echo "$OWNERS_JSON" | head -c 400 >&2; exit 1; }
echo "== owner: $(echo "$OWNERS_JSON" | jq -r '.owner.name // .[0].owner.name // "unknown"') (id=$OWNER_ID)"

ALL_SERVICES=$(api_get "/services?ownerId=${OWNER_ID}&limit=100")
echo "== services in workspace: $(echo "$ALL_SERVICES" | jq '.services | length')"

find_service_json() {
  local q="$1"
  [ -z "$q" ] && return 0
  printf '%s' "$ALL_SERVICES" | jq -c --arg q "$q" \
    '.services[]? | select(.id==$q or .name==$q or ((.serviceDetails.url // "")==$q) or ((.serviceDetails.publicUrl // "")==$q))' | head -1
}

print_inventory() {
  local sid name url plan region susp created env role dep url_of
  while read -r sid; do
    [ -z "$sid" ] && continue
    name=$(printf '%s' "$ALL_SERVICES" | jq -r --arg id "$sid" '.services[] | select(.id==$id) | .name')
    case "$name" in trynex*|*api*) ;; *) continue ;; esac
    url=$(printf '%s' "$ALL_SERVICES" | jq -r --arg id "$sid" '.services[] | select(.id==$id) | (.serviceDetails.url // .serviceDetails.publicUrl // "")')
    plan=$(printf '%s' "$ALL_SERVICES" | jq -r --arg id "$sid" '.services[] | select(.id==$id) | (.plan // .serviceDetails.planName // "?")')
    region=$(printf '%s' "$ALL_SERVICES" | jq -r --arg id "$sid" '.services[] | select(.id==$id) | (.region // "?")')
    susp=$(printf '%s' "$ALL_SERVICES" | jq -r --arg id "$sid" '.services[] | select(.id==$id) | (.suspended|tostring)')
    created=$(printf '%s' "$ALL_SERVICES" | jq -r --arg id "$sid" '.services[] | select(.id==$id) | .createdAt')
    env=$(service_env_array "$sid" || echo '[]')
    role=$(printf '%s' "$env" | role_of_env)
    dep=$(api_get "/services/${sid}/deploys?limit=1" | jq -r '.deploys[0].status // "none"' 2>/dev/null || echo "unknown")
    printf -- '- id=%s\n  name=%s\n  url=%s\n  plan=%s region=%s suspended=%s created=%s\n  role=%s lastDeploy=%s\n' \
      "$sid" "$name" "${url:-<none>}" "$plan" "$region" "$susp" "$created" "${role:-unset}" "$dep"
  done < <(printf '%s' "$ALL_SERVICES" | jq -r '.services[] | .id')
}

print_inventory

TARGET_JSON=""
case "$MODE" in
  create)
    echo "== MODE create — new primary will be named '$NEW_SERVICE_NAME'"
    guard_single_writer "$ALL_SERVICES" || exit 3
    SOURCE_JSON=$(find_service_json "$SOURCE_PRIMARY")
    [ -n "$SOURCE_JSON" ] || { echo "ERROR: source service '$SOURCE_PRIMARY' not found in this workspace" >&2; exit 1; }
    SOURCE_ID=$(printf '%s' "$SOURCE_JSON" | jq -r '.id')
    echo "== env/config source: $(printf '%s' "$SOURCE_JSON" | jq -r '.name') ($SOURCE_ID)"
    SOURCE_ENV=$(service_env_array "$SOURCE_ID")
    SOURCE_FULL=$(api_get "/services/${SOURCE_ID}")
    MISSING=$(printf '%s' "$SOURCE_ENV" | uncloneable_keys)
    if [ -n "$MISSING" ]; then
      echo "WARNING: these source keys are secret FILES and cannot be cloned by the API:"
      echo "  $MISSING"
      echo "  The new service will be created WITHOUT them; add them in the Render dashboard"
      echo "  before promoting the service to receive traffic (or the boot will misbehave)."
    fi
    PAYLOAD=/tmp/render-create-payload.json
    build_create_payload "$SOURCE_ENV" "$SOURCE_FULL" "$PAYLOAD"
    describe_create_payload "$PAYLOAD"
    if [ "$APPLY" != "true" ]; then
      echo "== DRY RUN — pass APPLY=true to create '$NEW_SERVICE_NAME'. Nothing was changed."
    else
      echo "== creating service..."
      if out=$(api_mutate POST "/services?ownerId=${OWNER_ID}" "$(cat "$PAYLOAD")"); then
        code=$(printf '%s' "$out" | sed -n 1p); body=$(printf '%s' "$out" | tail -n +2)
        NEW_ID=$(printf '%s' "$body" | jq -r '.service.id // empty' 2>/dev/null || true)
        NEW_URL=$(printf '%s' "$body" | jq -r '.service.serviceDetails.url // .service.serviceDetails.publicUrl // empty' 2>/dev/null || true)
        echo "  created HTTP $code id=${NEW_ID:-<none>} url=${NEW_URL:-<none>}"
        if [ -n "${NEW_ID:-}" ]; then TARGET_ID="$NEW_ID"; TARGET_NAME="$NEW_SERVICE_NAME"; TARGET_URL="$NEW_URL"; fi
        if [ -n "${NEW_ID:-}" ]; then
          trigger_deploy "$NEW_ID" || echo "  deploy trigger did not return a deploy id; Render auto-deploys new services anyway"
          [ -n "${DEPLOY_ID:-}" ] && { wait_for_live "$NEW_ID" "$DEPLOY_ID" || true; }
          [ -n "${NEW_URL:-}" ] && probe_url "$NEW_URL"
        fi
      else
        code=$(printf '%s' "$out" | sed -n 1p); body=$(printf '%s' "$out" | tail -n +2)
        echo "ERROR: Render rejected the create request (HTTP $code)." >&2
        echo "$body" | jq . 2>/dev/null || echo "$body" >&2
        echo "Hint: fix the field names with CREATE_EXTRA_JSON, or use mode=promote on a" >&2
        echo "service you created in the dashboard (runbook Path B)." >&2
        exit 4
      fi
    fi
    ;;
  promote)
    echo "== MODE promote"
    TARGET_JSON=$(find_service_json "${APPLY_TARGET:-${TARGET_SERVICE:-}}")
    if [ -z "$TARGET_JSON" ]; then
      TARGET_JSON=$(printf '%s' "$ALL_SERVICES" | jq -c '[.services[] | select(.name | test("trynex"; "i"))] | sort_by(.createdAt) | reverse | .[0] // empty')
    fi
    [ -n "$TARGET_JSON" ] && [ "$TARGET_JSON" != "null" ] || { echo "ERROR: no TryNex service to target" >&2; exit 1; }
    TARGET_ID=$(printf '%s' "$TARGET_JSON" | jq -r '.id')
    TARGET_NAME=$(printf '%s' "$TARGET_JSON" | jq -r '.name')
    TARGET_URL=$(printf '%s' "$TARGET_JSON" | jq -r '.serviceDetails.url // .serviceDetails.publicUrl // empty')
    echo "== target: $TARGET_NAME ($TARGET_ID) -> ${TARGET_URL:-no-URL}"
    if [ "$APPLY" != "true" ]; then
      echo "== DRY RUN — pass APPLY=true to promote $TARGET_NAME to PRIMARY."
    else
      guard_single_writer "$ALL_SERVICES" || exit 3
      SOURCE_JSON=$(find_service_json "$SOURCE_PRIMARY")
      if [ -n "$SOURCE_JSON" ]; then
        SOURCE_ID=$(printf '%s' "$SOURCE_JSON" | jq -r '.id')
        SOURCE_ENV=$(service_env_array "$SOURCE_ID")
        NEWENV=$(printf '%s' "$SOURCE_ENV" | jq -c '
          [ .[] | select(.value != null)
            | select(.key | test("^(PORT|RENDER_API_KEY)$") | not)
            + {} ] as $base
          | ($base | map(select(.key|test("TRYNEX_RUNTIME_ROLE|SCHEDULER_ENABLED|BACKUP_SYNC_ENABLED")|not)))
            + [ {key:"TRYNEX_RUNTIME_ROLE", value:"primary"},
                {key:"BACKUP_SYNC_ENABLED", value:"false"},
                {key:"SCHEDULER_ENABLED", value:"true"} ]
          | unique_by(.key)')
        echo "  env keys to apply: $(printf '%s' "$NEWENV" | jq -r '[.[].key] | sort | join(" ")')"
        out=$(api_mutate POST "/services/${TARGET_ID}/env-vars" "$(jq -cn --argjson e "$NEWENV" '{envVars:$e}')") || true
        echo "  env apply: HTTP $(printf '%s' "$out" | sed -n 1p)"
      fi
      trigger_deploy "$TARGET_ID"
      wait_for_live "$TARGET_ID" "${DEPLOY_ID:-}" || true
      [ -n "$TARGET_URL" ] && probe_url "$TARGET_URL"
    fi
    ;;
  *)
    echo "== DRY RUN (inventory) — no environment changes or deploys performed"
    TARGET_JSON=$(find_service_json "${APPLY_TARGET:-${TARGET_SERVICE:-}}")
    TARGET_ID=$(printf '%s' "${TARGET_JSON:-null}" | jq -r '.id // empty')
    TARGET_NAME=$(printf '%s' "${TARGET_JSON:-null}" | jq -r '.name // empty')
    TARGET_URL=$(printf '%s' "${TARGET_JSON:-null}" | jq -r '.serviceDetails.url // .serviceDetails.publicUrl // empty')
    ;;
esac

# ── machine-readable summary (consumed by the workflow) ──────────────────────
SUM_READS=$(printf '%s' "$ALL_SERVICES" | jq -c '[.services[] | select(.name | test("standby"; "i")) | {id, name, url: (.serviceDetails.url // .serviceDetails.publicUrl // "")}]')
SUM_PRIMARY=$(jq -cn --arg id "${TARGET_ID:-}" --arg name "${TARGET_NAME:-}" --arg url "${TARGET_URL:-}" \
  --argjson all "$ALL_SERVICES" '
  ($all.services[]? | select(.id==$id) | {id, name, url: (.serviceDetails.url // .serviceDetails.publicUrl // "")})
  // (if $id == "" then null else {id:$id, name:$name, url:$url} end)')
{
  echo "### RENDER_SUMMARY_JSON_BEGIN"
  jq -cn --argjson primary "${SUM_PRIMARY:-null}" --argjson reads "$SUM_READS" \
    '{primary: $primary, reads: $reads, mode: (env.MODE // "inventory"), apply: (env.APPLY // "false")}'
  echo "### RENDER_SUMMARY_JSON_END"
} >&2
echo "== done"
