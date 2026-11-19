/**
 * Port to the screenshots and cover images of a software on the host.
 *
 * @module
 */
import type { ImageFile, SoftwareImage } from '../model/image.model'

/**
 * Port to the images of a software through the host's admin API. Needs an admin token.
 *
 * Every member rejects with a {@link "domain/model/host-error.model".HostError} when the host answers with an error.
 */
export interface ImageRepository {
  /**
   * Lists the images of a software.
   *
   * @param softwareId - The software id.
   * @returns The images in their order.
   */
  images(softwareId: number): Promise<SoftwareImage[]>
  /**
   * Uploads an image file to a software.
   *
   * @param softwareId - The software id.
   * @param file - The file name, content type and bytes.
   * @returns The stored image.
   */
  upload(softwareId: number, file: ImageFile): Promise<SoftwareImage>
  /**
   * Changes an image: makes it the default one or moves it.
   *
   * @param id - The image id.
   * @param changes - `isDefault` and/or the new `position`.
   * @returns The image as the host stored it.
   */
  update(id: number, changes: { readonly isDefault?: boolean; readonly position?: number }): Promise<SoftwareImage>
  /**
   * Deletes an image.
   *
   * @param id - The image id.
   */
  remove(id: number): Promise<void>
}
