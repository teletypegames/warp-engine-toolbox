import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import type { Software } from '../../../../src/domain/model/catalog.model'
import type { ImageFile, SoftwareImage } from '../../../../src/domain/model/image.model'
import { DomainError } from '../../../../src/domain/model/message.model'
import type { ImageRepository } from '../../../../src/domain/repository/image.repository'
import type { AdminRepositories } from '../../../../src/domain/repository/warp-engine.gateway'
import type { ConnectionService } from '../../../../src/domain/service/connection.service'
import { ImageService } from '../../../../src/domain/service/image.service'

class Gallery implements ImageRepository {
  public uploaded: ImageFile[] = []
  public updates: [number, number | undefined][] = []
  public constructor(public list: SoftwareImage[]) {}
  public async images(): Promise<SoftwareImage[]> { return Promise.resolve(this.list) }
  public async upload(softwareId: number, file: ImageFile): Promise<SoftwareImage> {
    this.uploaded.push(file)
    return Promise.resolve({ id: 99, softwareId, imageId: 1, isDefault: false, position: 9, url: null })
  }
  public async update(id: number, changes: { readonly position?: number }): Promise<SoftwareImage> {
    this.updates.push([id, changes.position])
    const found: SoftwareImage | undefined = this.list.find((image: SoftwareImage) => image.id === id)
    return found ? Promise.resolve(found) : Promise.reject(new Error('no image'))
  }
  public async remove(): Promise<void> { return Promise.resolve() }
}

function image(id: number, position: number): SoftwareImage {
  return { id, softwareId: 1, imageId: id, isDefault: false, position, url: `/api/image/${String(id)}` }
}

function service(gallery: Gallery): ImageService {
  const connection = { admin: async () => Promise.resolve({ images: gallery } as unknown as AdminRepositories) } as unknown as ConnectionService
  return new ImageService(connection)
}

const SOFTWARE = { id: 1, name: 'game', title: 'Game' } as Software

describe('ImageService', () => {
  it('lists the gallery in order', async () => {
    const images: SoftwareImage[] = await service(new Gallery([image(2, 5), image(1, 1)])).images(SOFTWARE)

    assert.deepEqual(images.map((item: SoftwareImage) => item.id), [1, 2])
  })

  it('uploads an image under its file name and type, and refuses what is no image', async () => {
    const gallery: Gallery = new Gallery([])

    await service(gallery).add(SOFTWARE, '/work/shots/Title.PNG', new Uint8Array([1]))

    assert.deepEqual(gallery.uploaded.map((file: ImageFile) => [file.name, file.contentType]), [['Title.PNG', 'image/png']])
    await assert.rejects(service(gallery).add(SOFTWARE, 'notes.txt', new Uint8Array()), DomainError)
  })

  it('moves an image by renumbering the gallery, and not past its ends', async () => {
    const gallery: Gallery = new Gallery([image(1, 0), image(2, 1), image(3, 2)])

    assert.equal(await service(gallery).move(SOFTWARE, image(3, 2), -1), true)
    assert.deepEqual(gallery.updates, [[3, 1], [2, 2]])
    assert.equal(await service(gallery).move(SOFTWARE, image(1, 0), -1), false)
  })
})
