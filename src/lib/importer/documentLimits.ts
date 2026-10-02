/** Serverless requests are limited to about 4.5 MB, so a file in a bulk upload is capped a little under that. */
export const MAX_BULK_FILE_BYTES = 4 * 1024 * 1024;
/** Files are sent a few at a time, up to this much per request. */
export const MAX_BATCH_BYTES = Math.floor(4.2 * 1024 * 1024);
export const MAX_BATCH_FILES = 10;
