import type { Software } from '../model/catalog.model'
import { ImageTypes, type ImageFile, type SoftwareImage } from '../model/image.model'
import { DomainError, msg } from '../model/message.model'
import type { ImageRepository } from '../repository/image.repository'
import type { AdminRepositories } from '../repository/warp-engine.gateway'
import type { ConnectionService } from './connection.service'

export type Direction = -1 | 1

export class ImageService {
  public constructor(private readonly connection: ConnectionService) {}

  public async images(software: Software): Promise<SoftwareImage[]> {
    return ImageService.ordered(await (await this.repository()).images(software.id))
  }

  public async add(software: Software, name: string, bytes: Uint8Array): Promise<SoftwareImage> {
    const contentType: string | null = ImageTypes.of(name)
    if (!contentType) throw new DomainError(msg('{0} is not an image the catalog takes ({1}).', name, ImageTypes.extensions().join(', ')))
    const file: ImageFile = { name: name.split(/[\\/]/).pop() ?? name, contentType, bytes }
    return (await this.repository()).upload(software.id, file)
  }

  public async makeDefault(image: SoftwareImage): Promise<SoftwareImage> {
    return (await this.repository()).update(image.id, { isDefault: true })
  }

  public async move(software: Software, image: SoftwareImage, direction: Direction): Promise<boolean> {
    const repository: ImageRepository = await this.repository()
    const gallery: SoftwareImage[] = ImageService.ordered(await repository.images(software.id))
    const index: number = gallery.findIndex((item: SoftwareImage) => item.id === image.id)
    const target: number = index + direction
    if (index < 0 || target < 0 || target >= gallery.length) return false
    const reordered: SoftwareImage[] = [...gallery]
    reordered.splice(index, 1)
    reordered.splice(target, 0, image)
    for (const [position, item] of reordered.entries()) {
      if (item.position !== position) await repository.update(item.id, { position })
    }
    return true
  }

  public async remove(image: SoftwareImage): Promise<void> {
    await (await this.repository()).remove(image.id)
  }

  private static ordered(images: readonly SoftwareImage[]): SoftwareImage[] {
    return [...images].sort((a: SoftwareImage, b: SoftwareImage) => a.position - b.position || a.id - b.id)
  }

  private async repository(): Promise<ImageRepository> {
    const admin: AdminRepositories | null = await this.connection.admin(false)
    if (!admin) throw new DomainError(msg('Sign in first.'))
    return admin.images
  }
}
