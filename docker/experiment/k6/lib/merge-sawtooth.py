#!/usr/bin/env python3

import csv
import json
import math
import sys
from datetime import datetime
from pathlib import Path


def percentile(values: list[float], ratio: float) -> float:
    """선형 보간으로 지정한 백분위 값을 계산한다."""
    if not values:
        return math.nan

    ordered_values = sorted(values)
    position = (len(ordered_values) - 1) * ratio
    lower_index = math.floor(position)
    upper_index = math.ceil(position)

    if lower_index == upper_index:
        return ordered_values[lower_index]

    lower_value = ordered_values[lower_index]
    upper_value = ordered_values[upper_index]
    upper_weight = position - lower_index
    return lower_value + ((upper_value - lower_value) * upper_weight)


def bucket_end(elapsed_seconds: float, step_seconds: int) -> int:
    """측정 시작 후 경과 시간을 해당 표본 구간의 끝 시각으로 변환한다."""
    return max(step_seconds, math.ceil(elapsed_seconds / step_seconds) * step_seconds)


def read_latency_buckets(
    k6_json_path: Path,
    measurement_start_epoch: float,
    step_seconds: int,
) -> dict[int, list[float]]:
    """k6 원시 출력에서 요청 지연을 표본 구간별로 모은다."""
    buckets: dict[int, list[float]] = {}

    with k6_json_path.open(encoding="utf-8") as source:
        for line in source:
            record = json.loads(line)
            if record.get("type") != "Point" or record.get("metric") != "http_req_duration":
                continue

            data = record["data"]
            request_epoch = datetime.fromisoformat(data["time"]).timestamp()
            elapsed_seconds = request_epoch - measurement_start_epoch
            target_bucket = bucket_end(elapsed_seconds, step_seconds)
            buckets.setdefault(target_bucket, []).append(float(data["value"]))

    return buckets


def read_application_buckets(
    application_csv_path: Path,
    step_seconds: int,
) -> dict[int, dict[str, float]]:
    """1초 간격 앱 메트릭을 표본 구간별 최대값으로 축약한다."""
    buckets: dict[int, dict[str, float]] = {}

    with application_csv_path.open(encoding="utf-8", newline="") as source:
        for row in csv.DictReader(source):
            target_bucket = bucket_end(float(row["elapsed_sec"]), step_seconds)
            bucket = buckets.setdefault(
                target_bucket,
                {
                    "pool_pending_max": 0,
                    "pool_active_max": 0,
                    "eventloop_lag_max_ms": 0,
                },
            )
            bucket["pool_pending_max"] = max(
                bucket["pool_pending_max"],
                float(row["pool_pending"]),
            )
            bucket["pool_active_max"] = max(
                bucket["pool_active_max"],
                float(row["pool_active"]),
            )
            bucket["eventloop_lag_max_ms"] = max(
                bucket["eventloop_lag_max_ms"],
                float(row["eventloop_lag_ms"]),
            )

    return buckets


def main() -> None:
    """시스템 시계열과 요청 지연 시계열을 하나의 측정 CSV로 병합한다."""
    system_csv_path = Path(sys.argv[1])
    application_csv_path = Path(sys.argv[2])
    k6_json_path = Path(sys.argv[3])
    output_csv_path = Path(sys.argv[4])
    measurement_start_epoch = float(sys.argv[5])
    step_seconds = int(sys.argv[6])

    latency_buckets = read_latency_buckets(
        k6_json_path,
        measurement_start_epoch,
        step_seconds,
    )
    application_buckets = read_application_buckets(application_csv_path, step_seconds)

    with system_csv_path.open(encoding="utf-8", newline="") as source:
        system_rows = list(csv.DictReader(source))

    field_names = [
        "t_sec",
        "request_count",
        "p50_ms",
        "p95_ms",
        "p99_ms",
        "max_ms",
        "db_qps",
        "cache_miss_per_s",
        "pool_pending_max",
        "pool_active_max",
        "eventloop_lag_max_ms",
    ]

    with output_csv_path.open("w", encoding="utf-8", newline="") as target:
        writer = csv.DictWriter(target, fieldnames=field_names)
        writer.writeheader()

        for system_row in system_rows:
            target_bucket = int(system_row["t_sec"])
            latencies = latency_buckets.get(target_bucket, [])
            application_metrics = application_buckets.get(target_bucket, {})
            writer.writerow(
                {
                    "t_sec": target_bucket,
                    "request_count": len(latencies),
                    "p50_ms": round(percentile(latencies, 0.50), 3),
                    "p95_ms": round(percentile(latencies, 0.95), 3),
                    "p99_ms": round(percentile(latencies, 0.99), 3),
                    "max_ms": round(max(latencies), 3) if latencies else math.nan,
                    "db_qps": system_row["db_qps"],
                    "cache_miss_per_s": system_row["cache_miss_per_s"],
                    "pool_pending_max": application_metrics.get("pool_pending_max", 0),
                    "pool_active_max": application_metrics.get("pool_active_max", 0),
                    "eventloop_lag_max_ms": round(
                        application_metrics.get("eventloop_lag_max_ms", 0),
                        3,
                    ),
                }
            )


if __name__ == "__main__":
    main()
