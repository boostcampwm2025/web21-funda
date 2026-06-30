#!/usr/bin/env bash

# 고정 도착률 부하를 반복하고 실행별 결과를 따로 기록한다.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/experiment-common.sh"

MODE="${1:-random}"
RATES="${2:-50 100 200 400 800 1600}"
DURATION="${3:-20s}"
REPETITIONS="${4:-1}"
STABILIZATION_SECONDS=3

STAMP="$(date +%Y%m%d_%H%M%S)"
CSV="${OUTPUT_CSV:-$RECORDS_DIR/sweep_${MODE}_${STAMP}.csv}"
echo "mode,run,rate_offered,rps_completed,dropped,failed_rate,p50_ms,p95_ms,p99_ms,max_ms,pool_pending_max,pool_active_max,eventloop_lag_max_ms,backend_cpu_cores,cache_miss_delta" > "$CSV"

sampler_process_id=""

cleanup_sampler_on_exit() {
  if [ -n "$sampler_process_id" ]; then
    stop_background_process "$sampler_process_id"
  fi
}

trap cleanup_sampler_on_exit EXIT

read -r USER_MIN USER_MAX <<< "$(read_experiment_user_range)"
export USER_MIN USER_MAX

if [ "$MODE" = "samegroup" ]; then
  USER_IDS="$(read_first_group_user_ids | paste -sd, -)"
  export USER_IDS
fi

echo "== 처리량 스윕: mode=$MODE, rates=[$RATES], duration=$DURATION, repetitions=$REPETITIONS =="
echo "== 사용자 범위: $USER_MIN..$USER_MAX =="

for rate in $RATES; do
  for run in $(seq 1 "$REPETITIONS"); do
    wait_for_backend_idle
    # 직전 과부하의 CPU·GC 여파가 다음 실행에 섞이지 않도록 유휴 상태를 잠시 유지한다.
    sleep "$STABILIZATION_SECONDS"
    docker exec "$REDIS_CONTAINER" redis-cli FLUSHALL >/dev/null

    miss_before="$(read_weekly_cache_miss_total)"
    summary_file="/tmp/k6_summary_${MODE}_${rate}_${run}.json"
    application_samples_file="/tmp/app_samples_${MODE}_${rate}_${run}.csv"
    measurement_start_epoch="$(date +%s)"

    sample_application_metrics "$application_samples_file" "$measurement_start_epoch" &
    sampler_process_id=$!

    set +e
    GROUP_MODE="$MODE" \
      RATE="$rate" \
      DURATION="$DURATION" \
      SUMMARY_OUT="$summary_file" \
      k6 run --quiet "$SCRIPT_DIR/ranking_load.js" >/dev/null 2>&1
    k6_exit_code=$?
    set -e

    measurement_end_epoch="$(date +%s)"
    stop_background_process "$sampler_process_id"
    sampler_process_id=""

    if [ "$k6_exit_code" -ne 0 ]; then
      echo "k6 실행 실패: rate=$rate, run=$run" >&2
      exit "$k6_exit_code"
    fi

    miss_after="$(read_weekly_cache_miss_total)"
    backend_cpu_max="$(read_backend_cpu_max "$measurement_start_epoch" "$measurement_end_epoch")"

    python3 - \
      "$summary_file" \
      "$application_samples_file" \
      "$MODE" \
      "$run" \
      "$rate" \
      "$miss_before" \
      "$miss_after" \
      "$backend_cpu_max" \
      "$CSV" <<'PY'
import csv
import json
import sys

(
    summary_path,
    samples_path,
    mode,
    run,
    rate,
    miss_before,
    miss_after,
    backend_cpu_max,
    output_path,
) = sys.argv[1:10]

with open(summary_path, encoding="utf-8") as source:
    summary = json.load(source)

with open(samples_path, encoding="utf-8", newline="") as source:
    samples = list(csv.DictReader(source))

pool_pending_max = max(float(row["pool_pending"]) for row in samples)
pool_active_max = max(float(row["pool_active"]) for row in samples)
eventloop_lag_max_ms = max(float(row["eventloop_lag_ms"]) for row in samples)
cache_miss_delta = int(float(miss_after) - float(miss_before))

row = [
    mode,
    run,
    rate,
    summary.get("rps_completed", ""),
    summary.get("dropped_iterations", ""),
    summary.get("failed_rate", ""),
    summary.get("p50_ms", ""),
    summary.get("p95_ms", ""),
    summary.get("p99_ms", ""),
    summary.get("max_ms", ""),
    pool_pending_max,
    pool_active_max,
    round(eventloop_lag_max_ms, 3),
    backend_cpu_max,
    cache_miss_delta,
]

with open(output_path, "a", encoding="utf-8") as target:
    target.write(",".join(str(value) for value in row) + "\n")

print(
    f"  rate={rate:>5} run={run} "
    f"completed={summary.get('rps_completed', '?'):>7} "
    f"dropped={summary.get('dropped_iterations', '?'):>5} "
    f"p99={summary.get('p99_ms', '?'):>8}ms "
    f"pending={pool_pending_max:g} cpu={backend_cpu_max}"
)
PY
  done
done

trap - EXIT
echo "== 완료: $CSV =="
