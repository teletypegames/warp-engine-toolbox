/**
 * The names of release asset kinds, with the old names hosts before WECP api 6 still send.
 *
 * @module
 */
import type { Release, ReleaseAsset } from './catalog.model'
import type { AppDescription, KindDescription, PlatformDescription, WebBindingDescription } from './platform-description.model'

const ALIASES: Readonly<Record<string, string>> = { cartridge: 'package' }

/** Turns the kind names a host sends into the names of WECP api 6, so the toolbox compares one name per kind. */
export class AssetKinds {
  /**
   * The current name of a kind.
   *
   * @param name - The kind name as a host sent it.
   * @returns `package` for the old `cartridge`, the name itself otherwise.
   */
  public static canonical(name: string): string {
    return ALIASES[name] ?? name
  }

  /**
   * A platform description with every kind name in its current form: the kinds, the kinds of its variants and the
   * payload of its web runtimes.
   *
   * @param platform - The platform as the host described it.
   * @returns A copy with the names translated.
   */
  public static platform(platform: PlatformDescription): PlatformDescription {
    return {
      ...platform,
      kinds: AssetKinds.kinds(platform.kinds),
      ...(platform.apps ? { apps: platform.apps.map((app: AppDescription) => ({ ...app, kinds: AssetKinds.kinds(app.kinds) })) } : {}),
      web: platform.web.map((binding: WebBindingDescription) => ({ ...binding, payload: AssetKinds.canonical(binding.payload) }))
    }
  }

  /**
   * A release with the kind of every asset in its current form.
   *
   * @param release - The release as the host sent it.
   * @returns A copy with the asset kinds translated.
   */
  public static release(release: Release): Release {
    return { ...release, assets: release.assets.map((asset: ReleaseAsset) => ({ ...asset, kind: AssetKinds.canonical(asset.kind) })) }
  }

  private static kinds(kinds: readonly KindDescription[]): KindDescription[] {
    return kinds.map((kind: KindDescription) => ({ ...kind, name: AssetKinds.canonical(kind.name) }))
  }
}
