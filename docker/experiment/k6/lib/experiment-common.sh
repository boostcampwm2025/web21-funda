#!/usr/bin/env bash

# 여러 측정 스크립트가 같은 데이터 범위와 자원 수집 방식을 사용하도록 공통 동작을 모은다.
EXPERIMENT_K6_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPOSITORY_DIR="$(cd "$EXPERIMENT_K6_DIR/../../.." && pwd)"
WORKSPACE_DIR="$(cd "$REPOSITORY_DIR/.." && pwd)"
BACKEND_DIR="$REPOSITORY_DIR/apps/backend"
RECORDS_DIR="$WORKSPACE_DIR/실험_측정기록/raw"

BACKEND_URL="${BACKEND_URL:-http://localhost:3100}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9091}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-funda-exp-mysql}"
REDIS_CONTAINER="${REDIS_CONTAINER:-funda-exp-redis}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-funda-exp-backend}"
BACKEND_CONTAINER_ID="$(docker inspect "$BACKEND_CONTAINER" --format '{{.Id}}')"

mkdir -p "$RECORDS_DIR"

mysql_query() {
  local query="$1"

  docker exec "$MYSQL_CONTAINER" \
    mysql -ufunda_exp -pfunda_exp_pw funda -N -e "$query" 2>/dev/null
}

read_experiment_user_range() {
  mysql_query "SELECT MIN(id), MAX(id) FROM users WHERE provider_user_id LIKE 'exp-%';"
}

read_first_group_user_ids() {
  mysql_query "
    SELECT ranking_group_members.user_id
    FROM ranking_group_members
    INNER JOIN ranking_weeks
      ON ranking_weeks.id = ranking_group_members.week_id
    WHERE ranking_weeks.week_key = '2999-01'
      AND ranking_group_members.group_id = (
        SELECT MIN(ranking_groups.id)
        FROM ranking_groups
        INNER JOIN ranking_weeks AS first_week
          ON first_week.id = ranking_groups.week_id
        WHERE first_week.week_key = '2999-01'
      )
    ORDER BY ranking_group_members.user_id;
  "
}

mint_access_token() {
  local user_id="$1"

  node -e '
    const crypto = require("crypto");
    const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const header = encode({ alg: "HS256", typ: "JWT" });
    const payload = encode({
      sub: Number(process.argv[1]),
      role: "user",
      provider: "github",
      iat: now,
      exp: now + 7200,
    });
    const signature = crypto
      .createHmac("sha256", "experiment-access-secret")
      .update(`${header}.${payload}`)
      .digest("base64url");
    console.log(`${header}.${payload}.${signature}`);
  ' "$user_id"
}

read_weekly_cache_miss_total() {
  curl --fail --silent "$BACKEND_URL/api/metrics" | awk '
    $1 == "ranking_cache_requests_total{cache=\"weekly\",result=\"miss\"}" {
      print $2;
      found = 1;
    }
    END {
      if (!found) {
        print 0;
      }
    }
  '
}

read_db_pool_pending() {
  curl --fail --silent "$BACKEND_URL/api/metrics" | awk '
    $1 == "db_pool_connections{state=\"pending\"}" {
      print $2;
      found = 1;
    }
    END {
      if (!found) {
        print 0;
      }
    }
  '
}

wait_for_backend_idle() {
  local maximum_wait_seconds=60
  local waited_seconds=0

  while [ "$waited_seconds" -lt "$maximum_wait_seconds" ]; do
    local pending_connections
    pending_connections="$(read_db_pool_pending)"

    if [ "$pending_connections" = "0" ]; then
      return 0
    fi

    sleep 1
    waited_seconds=$((waited_seconds + 1))
  done

  echo "DB 풀 대기열이 ${maximum_wait_seconds}초 안에 비워지지 않았습니다." >&2
  return 1
}

sample_application_metrics() {
  local output_file="$1"
  local measurement_start_epoch="$2"

  echo "elapsed_sec,pool_pending,pool_active,eventloop_lag_ms" > "$output_file"

  while true; do
    local current_epoch
    local elapsed_seconds
    local metrics

    current_epoch="$(date +%s)"
    elapsed_seconds=$((current_epoch - measurement_start_epoch))
    metrics="$(curl --fail --silent "$BACKEND_URL/api/metrics")"

    printf '%s\n' "$metrics" | awk -v elapsed="$elapsed_seconds" '
      $1 == "db_pool_connections{state=\"pending\"}" {
        pending = $2;
      }
      $1 == "db_pool_connections{state=\"active\"}" {
        active = $2;
      }
      $1 == "nodejs_eventloop_lag_seconds" {
        lagMilliseconds = $2 * 1000;
      }
      END {
        print elapsed "," pending + 0 "," active + 0 "," lagMilliseconds + 0;
      }
    ' >> "$output_file"

    sleep 1
  done
}

stop_background_process() {
  local process_id="$1"

  if kill -0 "$process_id" 2>/dev/null; then
    kill "$process_id" 2>/dev/null || true
    wait "$process_id" 2>/dev/null || true
  fi
}

read_backend_cpu_max() {
  local measurement_start_epoch="$1"
  local measurement_end_epoch="$2"
  local query

  query="rate(container_cpu_usage_seconds_total{id=\"/docker/${BACKEND_CONTAINER_ID}\"}[10s])"

  curl --fail --silent --get "$PROMETHEUS_URL/api/v1/query_range" \
    --data-urlencode "query=$query" \
    --data-urlencode "start=$measurement_start_epoch" \
    --data-urlencode "end=$measurement_end_epoch" \
    --data-urlencode "step=1" | python3 -c '
import json
import sys

response = json.load(sys.stdin)
series = response.get("data", {}).get("result", [])
values = [float(point[1]) for item in series for point in item.get("values", [])]
print(max(values) if values else "NaN")
'
}

restore_baseline_dataset() {
  echo "== 베이스라인 데이터셋 복원: N=10000, G=10, 4주차 =="

  (
    cd "$BACKEND_DIR"
    NODE_ENV=development \
      DB_HOST=127.0.0.1 \
      DB_PORT=3307 \
      DB_USER=funda_exp \
      DB_PASSWORD=funda_exp_pw \
      DB_NAME=funda \
      EXP_USERS=10000 \
      EXP_G=10 \
      EXP_WEEKS=4 \
      EXP_SEED=42 \
      npx ts-node src/scripts/experiment-seed-ranking.ts >/dev/null
  )

  # 이전 G 스윕의 사용자별 키가 남으면 복원된 데이터셋과 맞지 않으므로 캐시도 함께 초기화한다.
  docker exec "$REDIS_CONTAINER" redis-cli FLUSHALL >/dev/null
}
