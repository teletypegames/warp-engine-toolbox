/**
 * A platform's description as text for tooltips and pickers.
 *
 * @packageDocumentation
 */

import type { KindDescription, WebBindingDescription } from '../../../domain/model/platform-description.model'
import type { Platform } from '../../../domain/model/platform.model'
import { t } from '../../ui/l10n'

/** Turns the host's description of a platform into the texts the views show. */
export class PlatformFormatter {
  /**
   * Describes a platform in Markdown: what it publishes, where its metadata and version live, how it plays on the web, its release rule and its builder image.
   *
   * @param platform - The platform.
   * @returns The Markdown text, for the platform node's tooltip.
   */
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

  /**
   * Summarizes a platform in one line: the kinds it publishes, whether it plays on the web, and a note when the host has no template for it.
   *
   * @param platform - The platform.
   * @returns The one-line summary.
   */
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
