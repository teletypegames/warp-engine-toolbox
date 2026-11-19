import type { ImageFile, SoftwareImage } from '../model/image.model'

export interface ImageRepository {
  images(softwareId: number): Promise<SoftwareImage[]>
  upload(softwareId: number, file: ImageFile): Promise<SoftwareImage>
  update(id: number, changes: { readonly isDefault?: boolean; readonly position?: number }): Promise<SoftwareImage>
  remove(id: number): Promise<void>
}
