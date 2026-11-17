export interface TokenRepository {
  token(createIfNone: boolean): Promise<string | null>
}
