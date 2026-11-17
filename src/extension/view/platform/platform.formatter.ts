import type { KindDescription, WebBindingDescription } from '../../../domain/model/platform-description.model'
import type { Platform } from '../../../domain/model/platform.model'
import { t } from '../../ui/l10n'

export class PlatformFormatter {
  public static describe(platform: Platform): string {
    return [
      `**${platform.label}** (\`${platform.name}\`)`,
      '',
      `- ${t('Publishes')}: ${PlatformFormatter.kinds(platform)}`,
      `- ${t('Metadata')}: ${PlatformFormatter.metadata(platform)}`,
      `- ${t('Version from')}: ${platform.versionFromCommand ? `\`${platform.versionCommand ?? ''}\`` : t('the metadata')}`,
      `- ${t('Plays on the web')}: ${PlatformFormatter.web(platform)}`,
      platform.releaseRule ? `- ${t('Releases only on')}: ${platform.releaseRule}` : '',
      platform.builder ? `- ${t('Builder image')}: \`${platform.builder}\`` : ''
    ].filter(Boolean).join('\n')
  }

  public static summary(platform: Platform): string {
    const web: string = platform.web.length > 0 ? ` · ${t('plays on the web')}` : ''
    const template: string = platform.templateUrl ? '' : ` · ${t('no template on this host')}`
    return `${platform.kinds.map((kind: KindDescription) => kind.name).join(', ')}${web}${template}`
  }

  private static kinds(platform: Platform): string {
    return platform.kinds.map((kind: KindDescription) => `\`${kind.upload}\`${kind.required ? ` (${t('required')})` : ''}`).join(', ')
  }

  private static metadata(platform: Platform): string {
    switch (platform.metadataFormat) {
      case 'json': return `\`${platform.metadataFile}\``
      case 'lua': return t('Lua header comments')
      case 'custom': return t('host-specific')
    }
  }

  private static web(platform: Platform): string {
    if (platform.web.length === 0) return t('from its html build')
    return platform.web.map((binding: WebBindingDescription) => `${binding.label ?? binding.runtime}${binding.default ? ` (${t('default')})` : ''}`).join(', ')
  }
}
