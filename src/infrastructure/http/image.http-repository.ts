import type { ImageFile, SoftwareImage } from '../../domain/model/image.model'
import type { ImageRepository } from '../../domain/repository/image.repository'
import type { WarpEngineHttpClient } from './warp-engine.http-client'

export class HttpImageRepository implements ImageRepository {
  public constructor(private readonly client: WarpEngineHttpClient) {}

  public async images(softwareId: number): Promise<SoftwareImage[]> {
    return this.client.admin<SoftwareImage[]>('GET', `/softwares/${String(softwareId)}/images`)
  }

  public async upload(softwareId: number, file: ImageFile): Promise<SoftwareImage> {
    const form: FormData = new FormData()
    form.append('file', new Blob([new Uint8Array(file.bytes)], { type: file.contentType }), file.name)
    return this.client.adminForm<SoftwareImage>(`/softwares/${String(softwareId)}/images/upload`, form)
  }

  public async update(id: number, changes: { readonly isDefault?: boolean; readonly position?: number }): Promise<SoftwareImage> {
    return this.client.admin<SoftwareImage>('PATCH', `/software_images/${String(id)}`, changes)
  }

  public async remove(id: number): Promise<void> {
    await this.client.json<unknown>('DELETE', `/api/admin/v1/software_images/${String(id)}`)
  }
}
