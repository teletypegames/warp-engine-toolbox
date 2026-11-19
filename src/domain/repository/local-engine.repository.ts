export interface LocalEngineRepository {
  port(): Promise<number | null>
  tokenFile(): Promise<string | null>
  tokenFromContainer(): Promise<string | null>
}
