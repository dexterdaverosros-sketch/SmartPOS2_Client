import { 
  BrowserMultiFormatReader, 
  NotFoundException, 
  DecodeHintType, 
  BarcodeFormat 
} from '@zxing/library';

export class BarcodeScanner {
  private codeReader: BrowserMultiFormatReader;
  private scanning = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 1000;
  private isReconnecting = false;
  private currentVideoElement: HTMLVideoElement | null = null;
  private currentOnResult: ((barcode: string) => void) | null = null;
  private currentOnError: ((error: Error) => void) | undefined = undefined;
  private currentMirrorMode = false;

  private createReader(): BrowserMultiFormatReader {
    const hints = new Map();
    const formats = [
      BarcodeFormat.QR_CODE,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_93,
      BarcodeFormat.ITF,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.AZTEC,
      BarcodeFormat.PDF_417
    ];
    
    hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.ASSUME_GS1, true);
    
    return new BrowserMultiFormatReader(hints);
  }

  constructor() {
    this.codeReader = this.createReader();
  }

  async startScanning(
    videoElement: HTMLVideoElement,
    onResult: (barcode: string) => void,
    onError?: (error: Error) => void,
    mirrorMode: boolean = false
  ): Promise<void> {
    if (this.scanning) return;

    // Store current parameters for reconnection
    this.currentVideoElement = videoElement;
    this.currentOnResult = onResult;
    this.currentOnError = onError;
    this.currentMirrorMode = mirrorMode;

    this.scanning = true;

    try {
      // Hint browser to allow inline playback
      try {
        videoElement.setAttribute('playsinline', 'true');
        videoElement.setAttribute('autoplay', 'true');
        videoElement.muted = true;
      } catch {}

      // Check if running in a secure context (HTTPS or localhost). Do not hard-fail in dev.
      if (!window.isSecureContext) {
        console.warn('Insecure context detected. Camera access may be blocked by the browser. Use HTTPS or localhost.');
      }
      
      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported in this browser');
      }

      // Try with preferred camera settings first (HD resolution for better scanning)
      let stream;
      try {
        const constraints = {
          video: { 
            facingMode: mirrorMode ? 'user' : 'environment',
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
            aspectRatio: { ideal: 1.7777777778 } // 16:9
          },
          audio: false,
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Try to apply advanced constraints like focus and torch
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities() as any;
        
        const advancedConstraints: any = {};
        if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
          advancedConstraints.focusMode = 'continuous';
        }
        if (capabilities.whiteBalanceMode && capabilities.whiteBalanceMode.includes('continuous')) {
          advancedConstraints.whiteBalanceMode = 'continuous';
        }
        if (capabilities.exposureMode && capabilities.exposureMode.includes('continuous')) {
          advancedConstraints.exposureMode = 'continuous';
        }

        if (Object.keys(advancedConstraints).length > 0) {
          try {
            await track.applyConstraints({ advanced: [advancedConstraints] } as any);
          } catch (e) {
            console.warn('Failed to apply advanced constraints', e);
          }
        }

      } catch (initialError) {
        // If specific camera constraints fail, try with basic video constraints
        console.warn('HD constraints failed, retrying with basic constraints');
        try {
            stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: mirrorMode ? 'user' : 'environment' },
            audio: false,
            });
        } catch (secondaryError) {
             if (initialError instanceof DOMException && 
                (initialError.name === 'OverconstrainedError' || initialError.name === 'ConstraintNotSatisfiedError')) {
              console.warn('Camera constraints not satisfied, trying with basic video');
              stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            } else {
              // Re-throw if it's not a constraints issue
              throw initialError;
            }
        }
      }

      videoElement.srcObject = stream;

      // Add stream event listeners for disconnection handling
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.addEventListener('ended', () => {
          console.warn('Camera track ended, attempting reconnection...');
          this.handleStreamDisconnection();
        });

        videoTrack.addEventListener('mute', () => {
          console.warn('Camera track muted, attempting reconnection...');
          this.handleStreamDisconnection();
        });
      }
      
      // Wait for video metadata to load and then for play to complete
      await new Promise<void>((resolve) => {
        // First wait for metadata to load (dimensions available)
        if (videoElement.readyState >= 2) { // HAVE_CURRENT_DATA or higher
          resolve();
        } else {
          videoElement.addEventListener('loadedmetadata', () => resolve(), { once: true });
        }
      });
      
      // Now wait for the play() Promise to resolve
      await videoElement.play();
      
      // Double-check that video has valid dimensions before starting to scan
      await new Promise<void>((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max (50 * 100ms)
        
        const checkDimensions = () => {
          if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
            resolve();
          } else if (attempts >= maxAttempts) {
            reject(new Error('Timeout: Camera video stream failed to initialize with valid dimensions'));
          } else {
            attempts++;
            // Check again in 100ms
            setTimeout(checkDimensions, 100);
          }
        };
        checkDimensions();
      });

      // Set up permission change detection
      navigator.permissions?.query({ name: 'camera' as PermissionName })
        .then(permissionStatus => {
          permissionStatus.onchange = () => {
            if (permissionStatus.state === 'denied') {
              this.scanning = false;
              onError?.(new Error('Camera permission was revoked'));
            }
          };
        })
        .catch(err => console.warn('Permission API not supported:', err));

      // Continuous scanning
      const scan = async () => {
        if (!this.scanning) return;

        // Check if video track is still active
        const videoTrack = (videoElement.srcObject as MediaStream)?.getVideoTracks()?.[0];
        if (!videoTrack || !videoTrack.enabled || videoTrack.readyState !== 'live') {
          if (!this.isReconnecting) {
            console.warn('Camera stream disconnected, attempting reconnection...');
            this.handleStreamDisconnection();
          }
          return;
        }

        // Skip scanning if video dimensions are invalid
        if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
          console.warn('Video dimensions not ready yet, skipping scan');
          setTimeout(scan, 100);
          return;
        }

        try {
          // Use decodeFromVideoDevice for better continuous scanning support if available
          // But stick to decodeFromVideoElement for broader compatibility
          const result = await this.codeReader.decodeFromVideoElement(videoElement);
          if (result) {
            onResult(result.getText());
            
            // Add a small delay after a successful scan to prevent rapid-fire duplicates
            // but keep scanning loop alive
            setTimeout(scan, 1500); 
            return; 
          }
        } catch (error) {
          // Don't report NotFoundException as it's expected when no barcode is found
          if (!(error instanceof NotFoundException)) {
            // Check for IndexSizeError
            if (error instanceof DOMException && error.name === 'IndexSizeError') {
              console.warn('IndexSizeError detected, video dimensions may be invalid');
            } else {
              // Only report real errors, ignore "No barcode found" noise
              // onError?.(error as Error);
            }
          }
        }

        // Scan more frequently for better responsiveness (100ms as requested)
        setTimeout(scan, 100); 
      };

      scan();
    } catch (error) {
      this.scanning = false;
      
      // Provide more specific error messages based on error type
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          onError?.(new Error('Camera access was denied. Please grant camera permission and try again.'));
        } else if (error.name === 'NotFoundError') {
          onError?.(new Error('No camera found on this device.'));
        } else if (error.name === 'NotReadableError' || error.name === 'AbortError') {
          onError?.(new Error('Camera is already in use by another application or not accessible.'));
        } else {
          onError?.(new Error(`Camera error: ${error.name}`));
        }
      } else {
        onError?.(error as Error);
      }
    }
  }

  private async handleStreamDisconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.scanning = false;
      this.isReconnecting = false;
      this.currentOnError?.(new Error('Camera stream was disconnected and reconnection failed'));
      return;
    }

    if (this.isReconnecting) {
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);

    // Pause current scanning loop
    this.scanning = false;
    
    // Wait before attempting reconnection
    await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));

    // Attempt to restart scanning with stored parameters
    if (this.currentVideoElement && this.currentOnResult) {
      try {
        await this.startScanning(
          this.currentVideoElement,
          this.currentOnResult,
          this.currentOnError,
          this.currentMirrorMode
        );
        // Reset reconnect attempts on successful reconnection
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        console.log('Camera reconnected successfully');
      } catch (error) {
        console.error('Reconnection attempt failed:', error);
        // Try again with exponential backoff
        this.isReconnecting = false;
        this.reconnectDelay *= 1.5;
        await this.handleStreamDisconnection();
      }
    } else {
      // No stored parameters; cannot reconnect
      this.isReconnecting = false;
      this.scanning = false;
      this.currentOnError?.(new Error('Unable to reconnect: no video element bound'));
    }
  }

  stopScanning(): void {
    this.scanning = false;
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000; // Reset delay
    
    // Clear stored parameters
    this.currentVideoElement = null;
    this.currentOnResult = null;
    this.currentOnError = undefined;
    
    try {
      // Reset the internal reader and recreate it to ensure a clean state
      try {
        this.codeReader.reset();
      } catch (e) {
        console.warn('codeReader.reset() threw:', e);
      }
      // Recreate reader instance to avoid lingering internal state that can
      // cause errors when starting again after a stop.
      this.codeReader = this.createReader();
      // Also stop all media streams to prevent memory leaks
      if (typeof document !== 'undefined') {
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
          if (video.srcObject) {
            const stream = video.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            video.srcObject = null;
          }
        });
      }
    } catch (error) {
      console.error('Error stopping scanner:', error);
    }
  }

  isScanning(): boolean {
    return this.scanning;
  }

  private async preprocessImage(imageUrl: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageUrl);
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Grayscale and Contrast Enhancement
        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          // Increase contrast: pull values towards 0 or 255
          const contrast = 1.5;
          let color = avg;
          color = (color - 128) * contrast + 128;
          color = Math.min(255, Math.max(0, color));
          
          data[i] = color;
          data[i + 1] = color;
          data[i + 2] = color;
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = () => resolve(imageUrl);
      img.src = imageUrl;
    });
  }

  async decodeFromImageFile(file: File): Promise<string> {
    const imageUrl = URL.createObjectURL(file);
    try {
      // Attempt 1: Original image
      try {
        const result = await this.codeReader.decodeFromImageUrl(imageUrl);
        return result.getText();
      } catch (e) {
        console.log("Initial decode failed, trying pre-processed image...");
      }

      // Attempt 2: Pre-processed image (Grayscale + Contrast)
      const processedUrl = await this.preprocessImage(imageUrl);
      try {
        const result = await this.codeReader.decodeFromImageUrl(processedUrl);
        return result.getText();
      } catch (e) {
        throw new Error("Could not read barcode from image even after enhancement.");
      }
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  }

  async decodeFromVideoElement(videoElement: HTMLVideoElement) {
    try {
      return await this.codeReader.decodeFromVideoElement(videoElement);
    } catch (e) {
      // For video elements, we can't easily preprocess individual frames in this loop
      // without affecting performance, but the 'TRY_HARDER' hint is already enabled.
      throw e;
    }
  }
}
