/**
 * Photo Optimization Utility
 * 
 * Automatically resizes, compresses, and corrects orientation of photos
 * before upload to reduce storage costs and improve performance.
 */

export interface OptimizedPhoto {
  file: File
  originalSize: number
  optimizedSize: number
  width: number
  height: number
  orientation: number
}

const MAX_WIDTH = 1920
const MAX_HEIGHT = 1920
const QUALITY = 0.85

/**
 * Get EXIF orientation from image
 */
function getOrientation(file: File): Promise<number> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const view = new DataView(e.target?.result as ArrayBuffer)
      if (view.getUint16(0, false) !== 0xffd8) {
        resolve(1) // Not a JPEG
        return
      }
      const length = view.byteLength
      let offset = 2
      while (offset < length) {
        if (view.getUint16(offset, false) === 0xffe1) {
          const marker = view.getUint16((offset += 2), false)
          if (marker === 0x4578) {
            // EXIF marker
            const little = view.getUint16((offset += 2), false) === 0x4949
            offset += view.getUint32(offset + 4, little)
            const tags = view.getUint16(offset, little)
            offset += 2
            for (let i = 0; i < tags; i++) {
              if (view.getUint16(offset + i * 12, little) === 0x0112) {
                resolve(view.getUint16(offset + i * 12 + 8, little))
                return
              }
            }
          }
        } else {
          offset += 2
        }
      }
      resolve(1) // Default orientation
    }
    reader.readAsArrayBuffer(file.slice(0, 64 * 1024))
  })
}

/**
 * Correct image orientation based on EXIF data
 */
function correctOrientation(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  orientation: number
): void {
  const width = canvas.width
  const height = canvas.height

  switch (orientation) {
    case 2:
      ctx.transform(-1, 0, 0, 1, width, 0)
      break
    case 3:
      ctx.transform(-1, 0, 0, -1, width, height)
      break
    case 4:
      ctx.transform(1, 0, 0, -1, 0, height)
      break
    case 5:
      ctx.transform(0, 1, 1, 0, 0, 0)
      break
    case 6:
      ctx.transform(0, 1, -1, 0, height, 0)
      break
    case 7:
      ctx.transform(0, -1, -1, 0, height, width)
      break
    case 8:
      ctx.transform(0, -1, 1, 0, 0, width)
      break
  }
}

/**
 * Optimize a photo file
 */
export async function optimizePhoto(file: File): Promise<OptimizedPhoto> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = async () => {
      try {
        const orientation = await getOrientation(file)

        // Calculate new dimensions
        let width = img.width
        let height = img.height

        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height)
          width = width * ratio
          height = height * ratio
        }

        // Create canvas
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        // Correct orientation
        if (orientation !== 1) {
          ctx.save()
          ctx.clearRect(0, 0, width, height)
          ctx.translate(width / 2, height / 2)
          correctOrientation(canvas, ctx, orientation)
          ctx.drawImage(img, -width / 2, -height / 2, width, height)
          ctx.restore()
        } else {
          ctx.drawImage(img, 0, 0, width, height)
        }

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob'))
              return
            }

            const optimizedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            })

            resolve({
              file: optimizedFile,
              originalSize: file.size,
              optimizedSize: optimizedFile.size,
              width,
              height,
              orientation,
            })

            URL.revokeObjectURL(url)
          },
          'image/jpeg',
          QUALITY
        )
      } catch (error) {
        URL.revokeObjectURL(url)
        reject(error)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

/**
 * Optimize multiple photos
 */
export async function optimizePhotos(files: File[]): Promise<OptimizedPhoto[]> {
  return Promise.all(files.map(optimizePhoto))
}

