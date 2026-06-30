#!/usr/bin/env bash

# 동일 그룹에 부하를 유지하며 TTL 경계의 DB QPS·miss·p99 변화를 같은 시간축에 기록한다.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/experiment-common.sh"

RATE="${1:-200}"
TOTAL_SECONDS="${2:-180}"
STEP_SECONDS="${3:-5}"

STAMP="$(date +%Y%m%d_%H%M%S)"
CSV="$RECORDS_DIR/sawtooth_${STAMP}.csv"
SUMMARY_JSON="$RECORDS_DIR/sawtooth_${STAMP}_summary.json"
SYSTEM_SAMPLES_FILE="/tmp/sawtooth_system_${STAMP}.csv"
APPLICATION_SAMPLES_FILE="/tmp/sawtooth_application_${STAMP}.csv"
K6_TIMESERIES_FILE="/tmp/sawtooth_k6_${STAMP}.json"

sampler_process_id=""
k6_process_id=""

cleanup_measurement_on_exit() {
  if [ -n "$sampler_process_id" ]; then
    stop_background_process "$sampler_process_id"
  fi

  if [ -n "$k6_process_id" ]; then
    stop_background_process "$k6_process_id"
  fi
}

trap cleanup_measurement_on_exit EXIT

read -r USER_MIN USER_MAX <<< "$(read_experiment_user_range)"
USER_IDS="$(read_first_group_user_ids | paste -sd, -)"
export USER_MIN USER_MAX USER_IDS

echo "== TTL 톱니 측정: rate=$RATE, total=${TOTAL_SECONDS}s, step=${STEP_SECONDS}s =="
echo "== 동일 그룹 사용자: $USER_IDS =="

wait_for_backend_idle
docker exec "$REDIS_CONTAINER" redis-cli FLUSHALL >/dev/null

echo "t_sec,db_qps,cache_miss_per_s" > "$SYSTEM_SAMPLES_FILE"
measurement_start_epoch="$(date +%s)"

sample_application_metrics "$APPLICATION_SAMPLES_FILE" "$measurement_start_epoch" &
sampler_process_id=$!

GROUP_MODE=samegroup \
  RATE="$RATE" \
  DURATION="${TOTAL_SECONDS}s" \
  SUMMARY_OUT="$SUMMARY_JSON" \
  k6 run --quiet --out "json=$K6_TIMESERIES_FILE" "$SCRIPT_DIR/ranking_load.js" \
  >/dev/null 2>&1 &
k6_process_id=$!

questions_before="$(mysql_query "SHOW GLOBAL STATUS LIKE 'Questions';" | awk '{ print $2 }')"
misses_before="$(read_weekly_cache_miss_total)"
elapsed_seconds=0

while [ "$elapsed_seconds" -lt "$TOTAL_SECONDS" ]; do
  sleep "$STEP_SECONDS"
  elapsed_seconds=$((elapsed_seconds + STEP_SECONDS))

  questions_after="$(mysql_query "SHOW GLOBAL STATUS LIKE 'Questions';" | awk '{ print $2 }')"
  misses_after="$(read_weekly_cache_miss_total)"

  python3 - \
    "$elapsed_seconds" \
    "$STEP_SECONDS" \
    "$questions_before" \
    "$questions_after" \
    "$misses_before" \
    "$misses_after" \
    "$SYSTEM_SAMPLES_FILE" <<'PY'
import sys

(
    elapsed_seconds,
    step_seconds,
    questions_before,
    questions_after,
    misses_before,
    misses_after,
    output_path,
) = sys.argv[1:8]

# SHOW GLOBAL STATUS 자체가 Questions를 1 증가시키므로 관측 쿼리 한 건을 제외한다.
database_query_delta = max(int(questions_after) - int(questions_before) - 1, 0)
database_qps = database_query_delta / int(step_seconds)
cache_miss_per_second = (float(misses_after) - float(misses_before)) / int(step_seconds)

with open(output_path, "a", encoding="utf-8") as target:
    target.write(
        f"{elapsed_seconds},{database_qps:.3f},{cache_miss_per_second:.3f}\n"
    )
PY

  questions_before="$questions_after"
  misses_before="$misses_after"
done

wait "$k6_process_id"
k6_process_id=""
stop_background_process "$sampler_process_id"
sampler_process_id=""

python3 "$SCRIPT_DIR/lib/merge-sawtooth.py" \
  "$SYSTEM_SAMPLES_FILE" \
  "$APPLICATION_SAMPLES_FILE" \
  "$K6_TIMESERIES_FILE" \
  "$CSV" \
  "$measurement_start_epoch" \
  "$STEP_SECONDS"

rm -f "$K6_TIMESERIES_FILE"

trap - EXIT
echo "== 완료: $CSV =="
echo "== 전체 요약: $SUMMARY_JSON =="
