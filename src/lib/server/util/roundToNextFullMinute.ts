import { MINUTE } from "$lib/util/time";
import type { UnixtimeMs } from "$lib/util/UnixtimeMs";

export function roundToNextFullMinute(timestamp: UnixtimeMs): UnixtimeMs {
    return Math.ceil(timestamp / MINUTE) * MINUTE;
}