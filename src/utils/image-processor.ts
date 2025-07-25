import sharp from 'sharp';

export interface ImageOptimizationOptions {
  quality?: number;
  format?: 'png' | 'jpeg' | 'webp';
  maxWidth?: number;
  maxHeight?: number;
  background?: string;
}

export class ImageProcessor {
  static async optimizeScreenshot(
    buffer: Buffer,
    options: ImageOptimizationOptions = {}
  ): Promise<string> {
    const {
      quality = 90,
      format = 'png',
      maxWidth = 1920,
      maxHeight = 1080,
      background = '#ffffff',
    } = options;

    try {
      let pipeline = sharp(buffer);

      // Resize if too large
      const metadata = await pipeline.metadata();
      if (metadata.width && metadata.height) {
        if (metadata.width > maxWidth || metadata.height > maxHeight) {
          pipeline = pipeline.resize(maxWidth, maxHeight, {
            fit: 'inside',
            withoutEnlargement: true,
          });
        }
      }

      // Convert format and optimize
      switch (format) {
        case 'jpeg':
          pipeline = pipeline.jpeg({ quality });
          break;
        case 'webp':
          pipeline = pipeline.webp({ quality });
          break;
        case 'png':
        default:
          // PNG uses compression level (0-9) instead of quality (0-100)
          const compressionLevel = Math.round(9 - (quality / 100) * 9);
          pipeline = pipeline.png({ 
            compressionLevel: Math.max(0, Math.min(9, compressionLevel)),
            progressive: false
          });
          break;
      }

      // Add background if transparent
      if (format === 'jpeg') {
        pipeline = pipeline.flatten({ background });
      }

      const optimizedBuffer = await pipeline.toBuffer();
      return `data:image/${format};base64,${optimizedBuffer.toString('base64')}`;
    } catch (error) {
      console.error('Image optimization failed:', error);
      // Fallback to original
      return `data:image/png;base64,${buffer.toString('base64')}`;
    }
  }

  static async optimizeScreenshotToBase64(
    buffer: Buffer,
    options: ImageOptimizationOptions = {}
  ): Promise<string> {
    const dataUri = await this.optimizeScreenshot(buffer, options);
    // Extract just the base64 part from the data URI
    const base64Data = dataUri.split(',')[1];
    return base64Data;
  }

  static async cropToElement(
    buffer: Buffer,
    bounds: { x: number; y: number; width: number; height: number },
    padding: number = 10
  ): Promise<Buffer> {
    try {
      const { x, y, width, height } = bounds;
      
      // Add padding but ensure we don't go negative or exceed image bounds
      const metadata = await sharp(buffer).metadata();
      const imageWidth = metadata.width || 0;
      const imageHeight = metadata.height || 0;

      const cropX = Math.max(0, x - padding);
      const cropY = Math.max(0, y - padding);
      const cropWidth = Math.min(imageWidth - cropX, width + (padding * 2));
      const cropHeight = Math.min(imageHeight - cropY, height + (padding * 2));

      return await sharp(buffer)
        .extract({
          left: cropX,
          top: cropY,
          width: cropWidth,
          height: cropHeight,
        })
        .toBuffer();
    } catch (error) {
      console.error('Image cropping failed:', error);
      return buffer; // Return original if cropping fails
    }
  }

  static async createDiffImage(
    beforeBuffer: Buffer,
    afterBuffer: Buffer,
    threshold: number = 0.1
  ): Promise<string> {
    try {
      // Use sharp to create a visual diff
      // This is a simplified version - for production, consider using a specialized diff library
      const beforeImage = sharp(beforeBuffer);
      const afterImage = sharp(afterBuffer);

      // Get metadata to ensure images are same size
      const beforeMeta = await beforeImage.metadata();
      const afterMeta = await afterImage.metadata();

      if (beforeMeta.width !== afterMeta.width || beforeMeta.height !== afterMeta.height) {
        // Resize to match
        const targetWidth = Math.min(beforeMeta.width || 0, afterMeta.width || 0);
        const targetHeight = Math.min(beforeMeta.height || 0, afterMeta.height || 0);
        
        await beforeImage.resize(targetWidth, targetHeight);
        await afterImage.resize(targetWidth, targetHeight);
      }

      // For now, return a composite image showing before and after side by side
      const beforeProcessed = await beforeImage.toBuffer();
      const afterProcessed = await afterImage.toBuffer();

      const composite = await sharp({
        create: {
          width: (beforeMeta.width || 0) * 2,
          height: beforeMeta.height || 0,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .composite([
          { input: beforeProcessed, left: 0, top: 0 },
          { input: afterProcessed, left: beforeMeta.width || 0, top: 0 },
        ])
        .png()
        .toBuffer();

      return `data:image/png;base64,${composite.toString('base64')}`;
    } catch (error) {
      console.error('Diff image creation failed:', error);
      return `data:image/png;base64,${beforeBuffer.toString('base64')}`;
    }
  }

  static calculateImageSize(base64Image: string): number {
    // Remove data URL prefix and calculate size
    const base64Data = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
    return Buffer.from(base64Data, 'base64').length;
  }

  static async compressForTokens(
    buffer: Buffer,
    maxSizeKB: number = 100
  ): Promise<string> {
    let quality = 90;
    let result = await this.optimizeScreenshot(buffer, { quality, format: 'jpeg' });
    
    // Iteratively reduce quality until under size limit
    while (this.calculateImageSize(result) > maxSizeKB * 1024 && quality > 20) {
      quality -= 10;
      result = await this.optimizeScreenshot(buffer, { quality, format: 'jpeg' });
    }

    return result;
  }
}
