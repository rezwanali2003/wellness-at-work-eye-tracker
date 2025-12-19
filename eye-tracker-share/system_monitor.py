import os
import psutil


def get_system_stats():
    # Short sample to avoid blocking the UI.
    cpu = psutil.cpu_percent(interval=0.05)

    process = psutil.Process(os.getpid())
    mem = process.memory_info().rss / (1024 * 1024)  # MB for this process only

    try:
        batt = psutil.sensors_battery()
    except Exception:
        batt = None

    if batt is not None and batt.percent is not None:
        power = f"{batt.percent:.0f}% battery"
    else:
        power = "AC / unknown"

    return cpu, mem, power
