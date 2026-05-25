export class TaigaError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly context?: Record<string, string | number>
  ) {
    super(message);
    this.name = "TaigaError";
  }
}
