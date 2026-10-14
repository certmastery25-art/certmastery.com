// Raw events older than this are deleted by the daily cron; DailyStat keeps the rollups.
export const EVENT_RETENTION_DAYS = 90;

// Requests slower than this are highlighted in the admin logs.
export const SLOW_REQUEST_MS = 1000;
