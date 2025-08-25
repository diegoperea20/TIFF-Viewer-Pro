"use client";

import { useEffect, useRef, useState } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as GeoTIFF from "geotiff";

// Define OpenSeadragon types
declare global {
  interface Window {
    OpenSeadragon: {
      (options: {
        element: HTMLElement;
        prefixUrl?: string;
        tileSources?: OpenSeadragonTileSource;
        showNavigationControl?: boolean;
        showZoomControl?: boolean;
        gestureSettingsMouse?: {
          clickToZoom?: boolean;
          dblClickToZoom?: boolean;
        };
        preserveViewport?: boolean;
        visibilityRatio?: number;
        defaultZoomLevel?: number;
        minZoomLevel?: number;
        maxZoomLevel?: number;
        zoomPerClick?: number;
        zoomPerScroll?: number;
        animationTime?: number;
        blendTime?: number;
        alwaysBlend?: boolean;
        autoHideControls?: boolean;
        immediateRender?: boolean;
        wrapHorizontal?: boolean;
        wrapVertical?: boolean;
      }): OpenSeadragonViewer;
      TileSource: new (
        options: Record<string, unknown>
      ) => OpenSeadragonTileSource;
    };
  }
}

interface OpenSeadragonTileSource {
  type?: string;
  url?: string;
  buildPyramid?: boolean;
  crossOriginPolicy?: boolean | string;
  ajaxWithCredentials?: boolean;
  loadTilesWithAjax?: boolean;
  width?: number;
  height?: number;
  tileSize?: number;
  tileOverlap?: number;
  minLevel?: number;
  maxLevel?: number;
  getTileHashKey?: (level: number, x: number, y: number) => string;
}

interface OpenSeadragonViewer {
  addHandler: (event: string, handler: (...args: unknown[]) => void) => void;
  removeHandler: (event: string, handler: (...args: unknown[]) => void) => void;
  viewport: {
    fitBounds: (bounds: {
      x: number;
      y: number;
      width: number;
      height: number;
    }) => void;
  };
  world: {
    getItemAt: (index: number) => { getBounds: () => Record<string, unknown> };
    addItem: (item: Record<string, unknown>) => void;
    removeAll: () => void;
  };
  addTiledImage: (options: Record<string, unknown>) => void;
  destroy: () => void;
}

interface TiffViewerProps {
  tiffPath: string;
  width?: string | number;
  height?: string | number;
  className?: string;
  onError?: (error: Error) => void;
  onLoad?: () => void;
}

// Helper function to load OpenSeadragon
const loadOpenSeadragon = (): Promise<typeof window.OpenSeadragon> => {
  return new Promise((resolve, reject) => {
    if (window.OpenSeadragon) {
      resolve(window.OpenSeadragon);
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/openseadragon@3.1.0/build/openseadragon/openseadragon.min.js";
    script.async = true;
    script.onload = () => {
      if (window.OpenSeadragon) {
        resolve(window.OpenSeadragon);
      } else {
        reject(new Error("OpenSeadragon not loaded"));
      }
    };
    script.onerror = (error) => {
      reject(new Error(`Failed to load OpenSeadragon: ${error}`));
    };
    document.head.appendChild(script);
  });
};

// Helper function to validate TIFF buffer and get file info
const validateTiff = (
  buffer: ArrayBuffer
): { isValid: boolean; message: string } => {
  try {
    if (buffer.byteLength < 8) {
      return {
        isValid: false,
        message: "File is too small to be a valid TIFF",
      };
    }

    const view = new DataView(buffer);
    const byte1 = view.getUint8(0);
    const byte2 = view.getUint8(1);
    const byteOrder = String.fromCharCode(byte1, byte2);

    if (byteOrder !== "II" && byteOrder !== "MM") {
      return {
        isValid: false,
        message: `Invalid TIFF byte order marker: 0x${byte1
          .toString(16)
          .padStart(2, "0")}${byte2.toString(16).padStart(2, "0")}`,
      };
    }

    // Check TIFF magic number (42)
    const magicNumber = view.getUint16(2, byteOrder === "II");
    if (magicNumber !== 42) {
      return {
        isValid: false,
        message: `Invalid TIFF magic number: ${magicNumber} (expected 42)`,
      };
    }

    return { isValid: true, message: "Valid TIFF file" };
  } catch (error) {
    return {
      isValid: false,
      message: `Error validating TIFF: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
};

// Helper function to load and process TIFF
const loadAndProcessTiff = async (
  url: string,
  onProgress?: (progress: number, stage: string, estimatedTime?: number) => void
): Promise<ImageData> => {
  const startTime = Date.now();

  try {
    // Fetch the TIFF file
    console.log("Fetching TIFF from URL:", url);
    onProgress?.(5, "Downloading TIFF file...");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch TIFF: ${response.status} ${response.statusText}`
      );
    }

    // Get content length for progress tracking
    const contentLength = response.headers.get("content-length");
    const totalSize = contentLength ? parseInt(contentLength, 10) : null;

    // Provide initial estimate based on file size
    if (totalSize) {
      // Estimate: ~1MB/s download + processing time
      const downloadTimeEstimate = Math.ceil(totalSize / (1024 * 1024)); // seconds for download
      const processingTimeEstimate = Math.ceil(totalSize / (5 * 1024 * 1024)); // seconds for processing (faster)
      const totalEstimate = Math.max(
        3,
        downloadTimeEstimate + processingTimeEstimate
      ); // minimum 3 seconds
      onProgress?.(5, "Downloading TIFF file...", totalEstimate);
    } else {
      // Generic estimate when size is unknown
      onProgress?.(5, "Downloading TIFF file...", 15); // Generic 15 second estimate
    }

    let downloadedSize = 0;
    const chunks: Uint8Array[] = [];
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error("Could not get stream reader");
    }

    onProgress?.(10, "Downloading data...");

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      chunks.push(value);
      downloadedSize += value.length;

      if (totalSize) {
        const downloadProgress = Math.min(
          (downloadedSize / totalSize) * 50,
          50
        );
        const elapsed = Date.now() - startTime;
        const downloadSpeed = downloadedSize / elapsed; // bytes per ms
        const remainingBytes = totalSize - downloadedSize;
        const estimatedDownloadTime = remainingBytes / downloadSpeed; // ms

        // Add processing time estimate (usually 20-30% of total time)
        const processingTimeEstimate = (totalSize / (10 * 1024 * 1024)) * 1000; // ms, ~10MB/s processing
        const totalEstimatedTime =
          estimatedDownloadTime + processingTimeEstimate;

        const estimatedSeconds = Math.ceil(totalEstimatedTime / 1000);
        const showEstimate = downloadedSize > 1024 && elapsed > 500; // 1KB downloaded and 500ms elapsed

        console.log(
          `Progress: ${downloadProgress.toFixed(
            1
          )}%, Downloaded: ${downloadedSize}/${totalSize}, Estimated: ${estimatedSeconds}s, Show: ${showEstimate}`
        );

        onProgress?.(
          10 + downloadProgress,
          "Downloading data...",
          showEstimate
            ? Math.max(1, estimatedSeconds)
            : totalSize
            ? Math.ceil(
                totalSize / (1024 * 1024) + totalSize / (5 * 1024 * 1024)
              )
            : 15
        );
      } else {
        // If we don't know total size, show decreasing estimate based on elapsed time
        const elapsed = Date.now() - startTime;
        const baseEstimate = 15; // Start with 15 seconds
        const adjustedEstimate = Math.max(
          3,
          baseEstimate - Math.floor(elapsed / 1000)
        ); // Decrease by elapsed seconds
        onProgress?.(20, "Downloading data...", adjustedEstimate);
      }
    }

    // Combine chunks into ArrayBuffer
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const arrayBuffer = new ArrayBuffer(totalLength);
    const uint8Array = new Uint8Array(arrayBuffer);
    let offset = 0;

    for (const chunk of chunks) {
      uint8Array.set(chunk, offset);
      offset += chunk.length;
    }

    console.log("Fetched TIFF file size:", arrayBuffer.byteLength, "bytes");
    onProgress?.(60, "Validating TIFF file...");

    // Validate the buffer before processing
    const validation = validateTiff(arrayBuffer);
    if (!validation.isValid) {
      console.error("TIFF validation failed:", validation.message);
      console.log(
        "First 8 bytes of file:",
        Array.from(new Uint8Array(arrayBuffer.slice(0, 8)))
      );
      throw new Error(`Invalid TIFF file: ${validation.message}`);
    }

    onProgress?.(70, "Processing TIFF image...");

    try {
      // Parse the TIFF
      const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
      onProgress?.(75, "Reading image metadata...");

      const image = await tiff.getImage(0);
      onProgress?.(80, "Extracting pixel data...");

      // Get image dimensions and samples per pixel
      const width = image.getWidth();
      const height = image.getHeight();
      const samplesPerPixel = image.getSamplesPerPixel();
      const bitsPerSample = image.getBitsPerSample();

      console.log(
        `Image info: ${width}x${height}, ${samplesPerPixel} samples/pixel, ${bitsPerSample} bits/sample`
      );

      // Detailed logging for different image types
      const bitsPerSampleValue = Array.isArray(bitsPerSample)
        ? bitsPerSample[0]
        : bitsPerSample;
      let imageType = "Unknown";

      if (samplesPerPixel === 1) {
        if (bitsPerSampleValue === 1) {
          imageType = "Bitonal (1-bit black & white)";
        } else if (bitsPerSampleValue === 8) {
          imageType = "8-bit grayscale or indexed color";
        } else if (bitsPerSampleValue === 16) {
          imageType = "16-bit high-precision grayscale (medical/scientific)";
        } else if (bitsPerSampleValue === 32) {
          imageType = "32-bit float grayscale (scientific analysis)";
        }
      } else if (samplesPerPixel === 3) {
        if (bitsPerSampleValue === 8) {
          imageType = "24-bit true color (8 bits per RGB channel)";
        } else if (bitsPerSampleValue === 16) {
          imageType = "48-bit high-precision color (16 bits per RGB channel)";
        } else if (bitsPerSampleValue === 32) {
          imageType = "96-bit float color (scientific)";
        }
      } else if (samplesPerPixel === 4) {
        if (bitsPerSampleValue === 8) {
          imageType = "32-bit RGBA color (8 bits per channel + alpha)";
        } else if (bitsPerSampleValue === 16) {
          imageType = "64-bit RGBA color (16 bits per channel + alpha)";
        }
      }

      console.log(`Detected image type: ${imageType}`);
      console.log(`Bits per sample (corrected): ${bitsPerSampleValue}`);

      // Log additional info for medical images
      if (bitsPerSampleValue >= 16 && samplesPerPixel === 1) {
        console.log(
          "Detected high-bit depth grayscale image (likely medical/radiography)"
        );
      } else if (bitsPerSampleValue >= 16 && samplesPerPixel >= 3) {
        console.log(
          "Detected high-bit depth color image (scientific/professional)"
        );
      }

      let data: Uint8Array | Uint16Array | Float32Array;
      let pixelData: Uint8ClampedArray;

      // Handle different numbers of samples per pixel
      if (samplesPerPixel === 1) {
        // Single band (grayscale) image - Common for medical/radiography images
        console.log("Processing single-band (grayscale) image");
        const bitsPerSampleValue = Array.isArray(bitsPerSample)
          ? bitsPerSample[0]
          : bitsPerSample;
        console.log(
          `Bits per sample: ${bitsPerSampleValue}, Image type: ${
            bitsPerSampleValue === 1
              ? "Bitonal (1-bit)"
              : bitsPerSampleValue === 8
              ? "Standard grayscale (8-bit)"
              : bitsPerSampleValue === 16
              ? "High-precision grayscale (16-bit Medical/Radiography)"
              : bitsPerSampleValue === 32
              ? "Scientific float grayscale (32-bit)"
              : `${bitsPerSampleValue}-bit grayscale`
          }`
        );

        let progressMessage = "Processing grayscale image...";
        if (bitsPerSampleValue === 1) {
          progressMessage = "Processing bitonal (black & white) image...";
        } else if (bitsPerSampleValue === 16) {
          progressMessage = "Processing medical/radiography image...";
        } else if (bitsPerSampleValue === 32) {
          progressMessage = "Processing scientific analysis image...";
        }

        onProgress?.(85, progressMessage);

        data = (await image.readRasters({
          interleave: true,
          samples: [0], // Only first channel
          width,
          height,
          resampleMethod: "nearest",
        })) as Uint8Array | Uint16Array | Float32Array;

        onProgress?.(90, "Converting to display format...");

        // Create RGBA from grayscale
        pixelData = new Uint8ClampedArray(width * height * 4);

        // Enhanced normalization for medical images (16-bit radiography)
        const normalizedData = normalizeToUint8Enhanced(
          data,
          bitsPerSampleValue
        );

        for (let i = 0; i < normalizedData.length; i++) {
          const value = normalizedData[i];
          const pixelIndex = i * 4;
          pixelData[pixelIndex] = value; // R
          pixelData[pixelIndex + 1] = value; // G
          pixelData[pixelIndex + 2] = value; // B
          pixelData[pixelIndex + 3] = 255; // A
        }
      } else if (samplesPerPixel >= 3) {
        // Multi-band image (RGB or more)
        console.log("Processing multi-band image");
        const bitsPerSampleValue = Array.isArray(bitsPerSample)
          ? bitsPerSample[0]
          : bitsPerSample;
        console.log(
          `Bits per sample: ${bitsPerSampleValue}, Samples per pixel: ${samplesPerPixel}`
        );

        let progressMessage = "Processing multi-channel image...";
        if (bitsPerSampleValue === 8 && samplesPerPixel === 3) {
          progressMessage = "Processing 24-bit true color image...";
        } else if (bitsPerSampleValue === 16 && samplesPerPixel === 3) {
          progressMessage = "Processing 48-bit high-precision color image...";
        } else if (bitsPerSampleValue === 16) {
          progressMessage = "Processing high-precision color image...";
        } else if (bitsPerSampleValue === 32) {
          progressMessage = "Processing scientific color analysis image...";
        }

        onProgress?.(85, progressMessage);

        // Use only first 3 bands for RGB
        const samplesToRead = [0, 1, 2];
        data = (await image.readRasters({
          interleave: true,
          samples: samplesToRead,
          width,
          height,
          resampleMethod: "nearest",
        })) as Uint8Array | Uint16Array | Float32Array;

        onProgress?.(90, "Converting RGB to display format...");

        // Create RGBA
        pixelData = new Uint8ClampedArray(width * height * 4);

        // Use enhanced normalization for better quality, especially for 16-bit
        const normalizedData =
          bitsPerSampleValue >= 16
            ? normalizeToUint8Enhanced(data, bitsPerSampleValue)
            : normalizeToUint8(data, bitsPerSampleValue);

        // Convert RGB to RGBA
        for (let i = 0, j = 0; i < normalizedData.length; i += 3, j += 4) {
          pixelData[j] = normalizedData[i]; // R
          pixelData[j + 1] = normalizedData[i + 1]; // G
          pixelData[j + 2] = normalizedData[i + 2]; // B
          pixelData[j + 3] = 255; // A
        }
      } else {
        throw new Error(
          `Unsupported number of samples per pixel: ${samplesPerPixel}`
        );
      }

      onProgress?.(95, "Creating final image...");

      // Create and return the ImageData object
      const finalImageData = new ImageData(pixelData, width, height);
      onProgress?.(100, "Loading completed!");

      return finalImageData;
    } catch (parseError) {
      console.error("Error parsing TIFF:", parseError);
      console.error("Parse error details:", {
        name: parseError instanceof Error ? parseError.name : "Unknown",
        message:
          parseError instanceof Error ? parseError.message : String(parseError),
        stack: parseError instanceof Error ? parseError.stack : undefined,
      });
      throw new Error(
        `Failed to parse TIFF image: ${
          parseError instanceof Error ? parseError.message : String(parseError)
        }`
      );
    }
  } catch (error) {
    console.error("Error loading TIFF:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to load TIFF image: ${error.message}`);
    }
    throw new Error("Failed to load TIFF image: Unknown error");
  }
};

// Enhanced helper function to normalize different data types to Uint8 with comprehensive bit depth support
const normalizeToUint8Enhanced = (
  data: Uint8Array | Uint16Array | Float32Array,
  bitsPerSample: number
): Uint8Array => {
  if (data instanceof Uint8Array) {
    if (bitsPerSample === 1) {
      // 1-bit bitonal images - convert to full grayscale range
      console.log("Converting 1-bit bitonal image to grayscale display");
      const result = new Uint8Array(data.length);
      for (let i = 0; i < data.length; i++) {
        // For 1-bit images, each byte contains 8 pixels
        // Convert any non-zero value to white (255), zero to black (0)
        result[i] = data[i] > 0 ? 255 : 0;
      }
      return result;
    } else {
      // 8-bit images - direct copy
      return new Uint8Array(data);
    }
  }

  const result = new Uint8Array(data.length);

  if (data instanceof Uint16Array) {
    // Enhanced 16-bit to 8-bit conversion for medical/radiography images
    console.log(
      `Processing ${bitsPerSample}-bit data, array length: ${data.length}`
    );

    // Find actual data range for better contrast
    let minValue = data[0];
    let maxValue = data[0];
    for (let i = 1; i < data.length; i++) {
      if (data[i] < minValue) minValue = data[i];
      if (data[i] > maxValue) maxValue = data[i];
    }

    console.log(`Data range: ${minValue} - ${maxValue}`);

    // Use actual range for better contrast in medical images
    const dataRange = maxValue - minValue;

    if (dataRange > 0) {
      // Apply histogram stretching for better visualization
      for (let i = 0; i < data.length; i++) {
        const normalizedValue = ((data[i] - minValue) / dataRange) * 255;
        result[i] = Math.round(Math.max(0, Math.min(255, normalizedValue)));
      }
    } else {
      // Fallback: all pixels have the same value
      const fallbackValue = Math.round(
        (minValue / ((1 << bitsPerSample) - 1)) * 255
      );
      result.fill(fallbackValue);
    }

    console.log(`Normalized range: 0 - 255 (enhanced for medical imaging)`);
  } else if (data instanceof Float32Array) {
    // Enhanced Float32 to 8-bit conversion for scientific analysis
    console.log(
      `Processing ${bitsPerSample}-bit float data, array length: ${data.length}`
    );

    // Find actual data range, handling NaN and infinite values
    let minValue = Number.POSITIVE_INFINITY;
    let maxValue = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < data.length; i++) {
      if (isFinite(data[i])) {
        // Only consider finite values
        if (data[i] < minValue) minValue = data[i];
        if (data[i] > maxValue) maxValue = data[i];
      }
    }

    // Handle edge case where no finite values found
    if (!isFinite(minValue) || !isFinite(maxValue)) {
      console.log("No finite values found in float32 data, filling with zeros");
      result.fill(0);
      return result;
    }

    console.log(`32-bit float data range: ${minValue} - ${maxValue}`);

    const dataRange = maxValue - minValue;

    if (dataRange > 0) {
      for (let i = 0; i < data.length; i++) {
        if (isFinite(data[i])) {
          const normalizedValue = ((data[i] - minValue) / dataRange) * 255;
          result[i] = Math.round(Math.max(0, Math.min(255, normalizedValue)));
        } else {
          // Handle NaN or infinite values - set to black
          result[i] = 0;
        }
      }
    } else {
      // Fallback for uniform data (all pixels same value)
      const fallbackValue = isFinite(minValue)
        ? Math.round(Math.abs(minValue) > 1 ? 255 : Math.abs(minValue) * 255)
        : 0;
      result.fill(fallbackValue);
    }

    console.log(
      `Normalized 32-bit float range: 0 - 255 (enhanced for scientific imaging)`
    );
  }

  return result;
};

// Original helper function to normalize different data types to Uint8 (kept for compatibility)
const normalizeToUint8 = (
  data: Uint8Array | Uint16Array | Float32Array,
  bitsPerSample: number
): Uint8Array => {
  if (data instanceof Uint8Array) {
    return data;
  }

  const result = new Uint8Array(data.length);

  if (data instanceof Uint16Array) {
    // 16-bit to 8-bit conversion
    const maxValue = (1 << bitsPerSample) - 1;
    for (let i = 0; i < data.length; i++) {
      result[i] = Math.floor((data[i] / maxValue) * 255);
    }
  } else if (data instanceof Float32Array) {
    // Float32 to 8-bit conversion (assuming 0-1 range)
    for (let i = 0; i < data.length; i++) {
      result[i] = Math.floor(Math.max(0, Math.min(1, data[i])) * 255);
    }
  }

  return result;
};

const TiffViewer: React.FC<TiffViewerProps> = ({
  tiffPath,
  width = "100%",
  height = "500px",
  className = "",
  onError,
  onLoad,
}) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerInstance = useRef<OpenSeadragonViewer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [loadingStage, setLoadingStage] = useState<string>("Initializing...");
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    let isMounted = true;

    // Reset progress states when tiffPath changes
    setLoadingProgress(0);
    setEstimatedTime(15); // Start with initial estimate immediately
    setLoadingStage("Initializing...");
    startTimeRef.current = Date.now();

    const initViewer = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setLoadingProgress(0);
        setEstimatedTime(15); // Start with 15 second estimate
        setLoadingStage("Initializing...");
        startTimeRef.current = Date.now();

        // Load OpenSeadragon
        setLoadingStage("Loading OpenSeadragon...");
        setLoadingProgress(2);
        setEstimatedTime(12); // Reduce estimate as we progress
        const OpenSeadragon = await loadOpenSeadragon();

        // Load and process TIFF with progress tracking
        const imageData = await loadAndProcessTiff(
          tiffPath,
          (progress, stage, estimatedTime) => {
            setLoadingProgress(progress);
            setLoadingStage(stage);

            if (estimatedTime && estimatedTime > 0) {
              setEstimatedTime(estimatedTime);
            } else {
              // Always provide an estimate based on progress
              if (progress >= 60 && progress < 100) {
                // Processing stages: estimate based on remaining percentage
                const processingEstimate = Math.max(
                  1,
                  Math.ceil((100 - progress) / 15)
                ); // Faster processing estimate
                setEstimatedTime(processingEstimate);
              } else if (progress < 60) {
                // Download stages: provide fallback estimate
                const downloadEstimate = Math.max(
                  2,
                  Math.ceil((60 - progress) / 10)
                );
                setEstimatedTime(downloadEstimate);
              } else {
                // Final stages
                setEstimatedTime(1);
              }
            }
          }
        );

        // Create a canvas to hold the image data
        setLoadingStage("Preparing viewer...");
        setLoadingProgress(98);

        const canvas = document.createElement("canvas");
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create canvas context");
        ctx.putImageData(imageData, 0, 0);

        // Create a custom tile source to avoid cache warnings
        const customTileSource = {
          type: "image",
          url: canvas.toDataURL(),
          buildPyramid: false,
          crossOriginPolicy: false,
          ajaxWithCredentials: false,
          loadTilesWithAjax: false,
          width: imageData.width,
          height: imageData.height,
          tileSize: Math.min(imageData.width, imageData.height, 512),
          tileOverlap: 0,
          minLevel: 0,
          maxLevel: 0,
          getTileHashKey: function (level: number, x: number, y: number) {
            return `${level}-${x}-${y}`;
          },
        };

        // Initialize OpenSeadragon viewer
        if (viewerRef.current && isMounted) {
          // Remove any existing viewer
          while (viewerRef.current.firstChild) {
            viewerRef.current.removeChild(viewerRef.current.firstChild);
          }

          // Create new viewer
          viewerInstance.current = OpenSeadragon({
            element: viewerRef.current,
            prefixUrl:
              "https://cdn.jsdelivr.net/npm/openseadragon@3.1.0/build/openseadragon/images/",
            tileSources: customTileSource,
            showNavigationControl: true,
            showZoomControl: true,
            gestureSettingsMouse: {
              clickToZoom: false,
              dblClickToZoom: true,
            },
            // Additional options to reduce warnings
            preserveViewport: false,
            visibilityRatio: 0.5,
            defaultZoomLevel: 0,
            minZoomLevel: 0.1,
            maxZoomLevel: 10,
            zoomPerClick: 2,
            zoomPerScroll: 1.2,
            animationTime: 1.2,
            blendTime: 0.0,
            alwaysBlend: false,
            autoHideControls: true,
            immediateRender: false,
            wrapHorizontal: false,
            wrapVertical: false,
          });

          // Call onLoad if provided
          if (onLoad && viewerInstance.current) {
            viewerInstance.current.addHandler("open", onLoad);
          }
        }

        setLoadingStage("Image loaded successfully!");
        setLoadingProgress(100);
        setTimeout(() => {
          setIsLoading(false);
        }, 500); // Small delay to show 100%
      } catch (err) {
        console.error("Error initializing TIFF viewer:", err);
        setError("Failed to load TIFF image");
        if (onError) {
          onError(err instanceof Error ? err : new Error("Unknown error"));
        }
        setIsLoading(false);
      }
    };

    initViewer();

    // Cleanup function
    return () => {
      isMounted = false;
      if (viewerInstance.current) {
        viewerInstance.current.destroy();
        viewerInstance.current = null;
      }
    };
  }, [tiffPath, onError, onLoad]);

  return (
    <div
      className={`tiff-viewer-container ${className}`}
      style={{ width, height, position: "relative" }}
    >
      {isLoading && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background:
              "linear-gradient(135deg, rgba(15, 15, 16, 0.95) 0%, rgba(26, 64, 20, 0.98) 100%)",
            backdropFilter: "blur(10px)",
            color: "#5FD93D",
            padding: "40px",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              maxWidth: "450px",
              width: "100%",
              textAlign: "center",
              background: "rgba(26, 26, 28, 0.9)",
              padding: "40px",
              borderRadius: "24px",
              boxShadow: "0 20px 40px rgba(30, 140, 13, 0.2)",
              border: "1px solid rgba(95, 217, 61, 0.3)",
            }}
          >
            {/* Icon */}
            <div
              style={{
                marginBottom: "24px",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  background:
                    "linear-gradient(135deg, #1E8C0D 0%, #5FD93D 100%)",
                  borderRadius: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 8px 24px rgba(30, 140, 13, 0.3)",
                }}
              >
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21,15 16,10 5,21" />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h3
              style={{
                marginBottom: "20px",
                fontSize: "24px",
                fontWeight: "700",
                color: "#5FD93D",
                background: "linear-gradient(135deg, #5FD93D 0%, #1E8C0D 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Loading TIFF Image
            </h3>

            {/* Progress bar container */}
            <div
              style={{
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "12px",
                  background:
                    "linear-gradient(90deg, #f0f0f0 0%, #e8e8e8 100%)",
                  borderRadius: "8px",
                  overflow: "hidden",
                  position: "relative",
                  border: "1px solid rgba(30, 140, 13, 0.2)",
                  boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.1)",
                }}
              >
                {/* Progress fill */}
                <div
                  style={{
                    width: `${Math.min(loadingProgress, 100)}%`,
                    height: "100%",
                    background:
                      loadingProgress >= 100
                        ? "linear-gradient(90deg, #1E8C0D 0%, #5FD93D 50%, #1E8C0D 100%)"
                        : "linear-gradient(90deg, #17590C 0%, #1E8C0D 50%, #5FD93D 100%)",
                    borderRadius:
                      loadingProgress >= 100 ? "8px" : "8px 0 0 8px",
                    transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                    boxShadow: "0 0 10px rgba(95, 217, 61, 0.5)",
                    position: "relative",
                  }}
                >
                  {/* Shimmer effect */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: "-100%",
                      width: "100%",
                      height: "100%",
                      background:
                        "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)",
                      animation: "shimmer 2s infinite",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Percentage and status */}
            <div style={{ marginBottom: "16px" }}>
              <div
                style={{
                  fontSize: "28px",
                  fontWeight: "800",
                  color: "#1E8C0D",
                  marginBottom: "8px",
                  textShadow: "0 2px 4px rgba(30, 140, 13, 0.3)",
                }}
              >
                {loadingProgress >= 100
                  ? "100"
                  : Math.round(Math.min(loadingProgress, 99))}
                %
              </div>

              <div
                style={{
                  fontSize: "14px",
                  color: "#17590C",
                  fontWeight: "600",
                  minHeight: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ marginRight: "8px" }}>🔄</span>
                {loadingStage}
              </div>
            </div>

            {/* Estimated time */}
            {estimatedTime && estimatedTime > 0 && (
              <div
                style={{
                  fontSize: "14px",
                  color: "#1E8C0D",
                  fontWeight: "700",
                  marginBottom: "12px",
                  padding: "8px 16px",
                  background:
                    "linear-gradient(135deg, rgba(95, 217, 61, 0.15) 0%, rgba(30, 140, 13, 0.1) 100%)",
                  borderRadius: "12px",
                  border: "1px solid rgba(95, 217, 61, 0.3)",
                  boxShadow: "0 4px 8px rgba(95, 217, 61, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ marginRight: "6px" }}>⏱️</span>
                Estimated time: {estimatedTime} second
                {estimatedTime !== 1 ? "s" : ""} remaining
              </div>
            )}

            {/* Animated elements */}
            <div
              style={{
                marginTop: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
              }}
            >
              {/* Main spinner */}
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  border: "3px solid rgba(30, 140, 13, 0.2)",
                  borderTop: "3px solid #1E8C0D",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />

              {/* Pulsing dots */}
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: "8px",
                    height: "8px",
                    backgroundColor: "#5FD93D",
                    borderRadius: "50%",
                    animation: `pulse 1.5s ease-in-out ${
                      i * 0.2
                    }s infinite alternate`,
                  }}
                />
              ))}
            </div>
          </div>

          {/* CSS for animations */}
          <style jsx>{`
            @keyframes spin {
              0% {
                transform: rotate(0deg);
              }
              100% {
                transform: rotate(360deg);
              }
            }
            @keyframes pulse {
              0% {
                opacity: 0.4;
                transform: scale(0.8);
              }
              100% {
                opacity: 1;
                transform: scale(1.2);
              }
            }
            @keyframes shimmer {
              0% {
                left: -100%;
              }
              100% {
                left: 100%;
              }
            }
          `}</style>
        </div>
      )}
      {error && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "linear-gradient(135deg, rgba(255, 243, 243, 0.95) 0%, rgba(254, 240, 240, 0.98) 100%)",
            backdropFilter: "blur(10px)",
            padding: "20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              maxWidth: "400px",
              width: "100%",
              background: "rgba(255, 255, 255, 0.9)",
              padding: "40px",
              borderRadius: "20px",
              boxShadow: "0 20px 40px rgba(220, 38, 38, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
            }}
          >
            {/* Error Icon */}
            <div
              style={{
                marginBottom: "24px",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  background:
                    "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
                  borderRadius: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 8px 24px rgba(220, 38, 38, 0.3)",
                }}
              >
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
            </div>

            <h3
              style={{
                fontSize: "24px",
                fontWeight: "700",
                color: "#dc2626",
                marginBottom: "16px",
              }}
            >
              Loading Error
            </h3>

            <p
              style={{
                fontSize: "16px",
                color: "#7f1d1d",
                lineHeight: "1.5",
              }}
            >
              {error}
            </p>
          </div>
        </div>
      )}
      <div
        ref={viewerRef}
        className="tiff-viewer"
        style={{
          width: "100%",
          height: "100%",
          display: isLoading || error ? "none" : "block",
        }}
      />
    </div>
  );
};

export default TiffViewer;
