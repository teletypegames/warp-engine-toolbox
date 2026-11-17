import * as vscode from 'vscode'
import { TOOL_SCOPES } from '../../domain/model/sign-in.model'
import type { TokenRepository } from '../../domain/repository/token.repository'

export class AuthenticationTokenRepository implements TokenRepository {
  public constructor(private readonly providerId: string) {}

  public async token(createIfNone: boolean): Promise<string | null> {
    const options: vscode.AuthenticationGetSessionOptions = createIfNone ? { createIfNone: true } : { silent: true }
    const session: vscode.AuthenticationSession | undefined = await vscode.authentication.getSession(this.providerId, [...TOOL_SCOPES], options)
    return session?.accessToken ?? null
  }
}
