/**
 * The images of a software in the catalog and the image file types it accepts.
 *
 * @module
 */
/** An image attached to a software in the host's catalog. */
export interface SoftwareImage {
  /** The attachment's id on the host. */
  readonly id: number
  /** The id of the software it belongs to. */
  readonly softwareId: number
  /** The id of the stored image file. */
  readonly imageId: number
  /** Whether it is the software's default (cover) image. */
  readonly isDefault: boolean
  /** Its place in the software's image order. */
  readonly position: number
  /** Whether it was uploaded on this host or arrived by sync from a paired engine, when the host sends it. */
  readonly origin?: 'local' | 'sync'
  /** The address the image is served at, or `null`. */
  readonly url: string | null
}

/** An image file read from disk, ready to upload. */
export interface ImageFile {
  /** The file name. */
  readonly name: string
  /** The MIME type, from {@link ImageTypes.of}. */
  readonly contentType: string
  /** The file content. */
  readonly bytes: Uint8Array
}

/** The image file types the catalog accepts. */
export class ImageTypes {
  private static readonly TYPES: Readonly<Record<string, string>> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp'
  }

  /**
   * The accepted file extensions, without dots.
   *
   * @returns The extensions, e.g. for a file dialog's filter.
   */
  public static extensions(): string[] {
    return Object.keys(ImageTypes.TYPES)
  }

  /**
   * The MIME type of a file, from its extension (case-insensitive).
   *
   * @param name - The file name.
   * @returns The MIME type, or `null` when the extension is not accepted.
   */
  public static of(name: string): string | null {
    const extension: string = name.split('.').pop()?.toLowerCase() ?? ''
    return ImageTypes.TYPES[extension] ?? null
  }
}
