import type { ConnectionService } from '../../domain/service/connection.service'
import type { WarpEngineAuthProvider } from '../auth/warp-engine.auth-provider'
import type { RefreshController } from './refresh.controller'

export class SignInController {
  public constructor(private readonly connection: ConnectionService, private readonly auth: WarpEngineAuthProvider, private readonly refresh: RefreshController) {}

  public async signIn(): Promise<void> {
    await this.connection.token(true)
    await this.refresh.refresh()
  }

  public async signOut(): Promise<void> {
    await this.auth.signOut()
    await this.refresh.refresh()
  }
}
