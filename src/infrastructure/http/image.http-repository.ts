/**
 * The {@link domain/repository/image.repository!ImageRepository} port implemented on the WarpEngine admin API.
 *
 * @module
 */
import type { ImageFile, SoftwareImage } from '../../domain/model/image.model'
import type { ImageRepository } from '../../domain/repository/image.repository'
import type { WarpEngineHttpClient } from './warp-engine.http-client'

/**
 * The images (screenshots, covers) of a software over `/api/admin/v2`.
 *
 * The requests throw a `WarpEngineError` when the host fails or cannot be reached.
 */
export class HttpImageRepository implements ImageRepository {
  /**
   * Creates the repository.
   *
   * @param client - The client of the host, with an administrator's token.
   */
  public constructor(private readonly client: WarpEngineHttpClient) {}

  /**
   * Lists the images of a software (`GET /api/admin/v2/softwares/:id/images`).
   *
   * @param softwareId - The software id.
   * @returns The images.
   */
  public async images(softwareId: number): Promise<SoftwareImage[]> {
    return this.client.admin<SoftwareImage[]>('GET', `/softwares/${String(softwareId)}/images`)
  }

  /**
   * Uploads an image as a multipart `file` field (`POST /api/admin/v2/softwares/:id/images/upload`).
   *
   * @param softwareId - The software id.
   * @param file - The image's name, content type and bytes.
   * @returns The stored image.
   */
  public async upload(softwareId: number, file: ImageFile): Promise<SoftwareImage> {
    const form: FormData = new FormData()
    form.append('file', new Blob([new Uint8Array(file.bytes)], { type: file.contentType }), file.name)
    return this.client.adminForm<SoftwareImage>(`/softwares/${String(softwareId)}/images/upload`, form)
  }

  /**
   * Makes an image the default or moves it (`PATCH /api/admin/v2/software_images/:id`).
   *
   * @param id - The image id.
   * @param changes - The new default flag or position.
   * @returns The updated image.
   */
  public async update(id: number, changes: { readonly isDefault?: boolean; readonly position?: number }): Promise<SoftwareImage> {
    return this.client.admin<SoftwareImage>('PATCH', `/software_images/${String(id)}`, changes)
  }

  /**
   * Deletes an image (`DELETE /api/admin/v2/software_images/:id`).
   *
   * @param id - The image id.
   */
  public async remove(id: number): Promise<void> {
    await this.client.json<unknown>('DELETE', `/api/admin/v2/software_images/${String(id)}`)
  }
}
