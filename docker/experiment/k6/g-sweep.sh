#!/usr/bin/env bash

# 그룹 크기만 변경해 캐시 메모리 증가와 처리량 곡선 변화를 반복 측정한다.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/experiment-common.sh"

GROUP_SIZES="${1:-10 30 50 100}"
RATES="${2:-200 400 800}"
DURATION="${3:-20s}"
REPETITIONS="${4:-3}"

STAMP="$(date +%Y%m%d_%H%M%S)"
CSV="$RECORDS_DIR/gsweep_${STAMP}.csv"
echo "G,group_count,cache_key_count,blob_bytes,group_cache_memory_bytes,mode,run,rate_offered,rps_completed,dropped,failed_rate,p50_ms,p95_ms,p99_ms,max_ms,pool_pending_max,pool_active_max,eventloop_lag_max_ms,backend_cpu_cores,cache_miss_delta" > "$CSV"

restore_after_measurement=true

restore_dataset_on_exit() {
  if [ "$restore_after_measurement" = true ]; then
    restore_baseline_dataset
  fi
}

trap restore_dataset_on_exit EXIT

for group_size in $GROUP_SIZES; do
  echo "== G=$group_size 재시드 =="
  (
    cd "$BACKEND_DIR"
    NODE_ENV=development \
      DB_HOST=127.0.0.1 \
      DB_PORT=3307 \
      DB_USER=funda_exp \
      DB_PASSWORD=funda_exp_pw \
      DB_NAME=funda \
      EXP_USERS=10000 \
      EXP_G="$group_size" \
      EXP_WEEKS=1 \
      EXP_SEED=42 \
      npx ts-node src/scripts/experiment-seed-ranking.ts >/dev/null
  )

  group_count="$(mysql_query "
    SELECT COUNT(*)
    FROM ranking_groups
    INNER JOIN ranking_weeks
      ON ranking_weeks.id = ranking_groups.week_id
    WHERE ranking_weeks.week_key = '2999-01';
  ")"
  first_group_user_ids="$(read_first_group_user_ids)"
  first_user_id="$(printf '%s\n' "$first_group_user_ids" | sed -n '1p')"

  docker exec "$REDIS_CONTAINER" redis-cli FLUSHALL >/dev/null

  while IFS= read -r user_id; do
    access_token="$(mint_access_token "$user_id")"
    curl --fail --silent --output /dev/null \
      --header "Authorization: Bearer $access_token" \
      "$BACKEND_URL/api/ranking/weekly?weekKey=2999-01"
  done <<< "$first_group_user_ids"

  cache_key_count="$(docker exec "$REDIS_CONTAINER" redis-cli DBSIZE)"
  # 그룹 캐시를 사용할 때는 공유 랭킹 키의 크기를 측정한다.
  user_blob_bytes="$(docker exec "$REDIS_CONTAINER" redis-cli STRLEN "ranking:weekly:2999-01:$first_user_id")"
  if [ "${user_blob_bytes:-0}" -gt 0 ] 2>/dev/null; then
    blob_bytes="$user_blob_bytes"
  else
    first_group_key="$(docker exec "$REDIS_CONTAINER" redis-cli --scan --pattern 'ranking:weekly:2999-01:group:*' | head -1)"
    blob_bytes="$([ -n "$first_group_key" ] && docker exec "$REDIS_CONTAINER" redis-cli STRLEN "$first_group_key" || echo 0)"
  fi
  group_cache_memory_bytes=0

  while IFS= read -r cache_key; do
    cache_memory_bytes="$(docker exec "$REDIS_CONTAINER" redis-cli MEMORY USAGE "$cache_key")"
    group_cache_memory_bytes=$((group_cache_memory_bytes + cache_memory_bytes))
  done < <(docker exec "$REDIS_CONTAINER" redis-cli --scan --pattern 'ranking:weekly:2999-01:*')

  temporary_sweep_csv="/tmp/g_sweep_${group_size}_${STAMP}.csv"
  OUTPUT_CSV="$temporary_sweep_csv" \
    "$SCRIPT_DIR/run-sweep.sh" random "$RATES" "$DURATION" "$REPETITIONS"

  tail -n +2 "$temporary_sweep_csv" | while IFS= read -r sweep_row; do
    echo "$group_size,$group_count,$cache_key_count,$blob_bytes,$group_cache_memory_bytes,$sweep_row" >> "$CSV"
  done
done

restore_baseline_dataset
restore_after_measurement=false
trap - EXIT

echo "== 완료: $CSV =="
