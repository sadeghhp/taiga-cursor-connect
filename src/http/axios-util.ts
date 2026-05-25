import axios, { type AxiosError } from "axios";
import { TaigaError } from "./errors.js";

export function wrapAxiosError(
  err: unknown,
  context?: Record<string, string | number>
): TaigaError {
  if (err instanceof TaigaError) return err;
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<{ detail?: string; _error_message?: string }>;
    const status = ax.response?.status;
    const body = ax.response?.data;
    const detail =
      (typeof body === "object" && body !== null
        ? body.detail ?? body._error_message
        : undefined) ?? ax.message;
    const ctxStr = context
      ? ` — ${Object.entries(context)
          .map(([k, v]) => `${k}=${v}`)
          .join(" ")}`
      : "";
    return new TaigaError(
      `Taiga API error (${status ?? "network"}): ${detail}${ctxStr}`,
      status,
      context
    );
  }
  return new TaigaError(err instanceof Error ? err.message : String(err), undefined, context);
}
