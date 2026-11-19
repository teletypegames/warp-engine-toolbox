export interface SoftwareImage {
  readonly id: number
  readonly softwareId: number
  readonly imageId: number
  readonly isDefault: boolean
  readonly position: number
  readonly origin?: 'local' | 'sync'
  readonly url: string | null
}

export interface ImageFile {
  readonly name: string
  readonly contentType: string
  readonly bytes: Uint8Array
}

export class ImageTypes {
  private static readonly TYPES: Readonly<Record<string, string>> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp'
  }

  public static extensions(): string[] {
    return Object.keys(ImageTypes.TYPES)
  }

  public static of(name: string): string | null {
    const extension: string = name.split('.').pop()?.toLowerCase() ?? ''
    return ImageTypes.TYPES[extension] ?? null
  }
}
