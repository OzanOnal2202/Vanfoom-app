import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, Zap, ZapOff, ScanLine, Eye, Loader2 } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastOcrAttemptRef = useRef<number>(0);
  const isStoppedRef = useRef<boolean>(false);
  
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrAttempts, setOcrAttempts] = useState(0);

  // Capture a frame from the video and return as base64
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    // Set canvas size to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw current video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to base64 JPEG (smaller than PNG)
    return canvas.toDataURL('image/jpeg', 0.85);
  }, []);

  // Stop camera - defined early so it can be used by other callbacks
  const stopCamera = useCallback(() => {
    isStoppedRef.current = true;
    setIsScanning(false);
    
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch (e) {
        console.log('Error stopping controls:', e);
      }
      controlsRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.log('Error stopping track:', e);
        }
      });
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Perform OCR on captured frame
  const performOcr = useCallback(async (manualTrigger = false) => {
    // Check if already stopped
    if (isStoppedRef.current) return;
    
    // Debounce OCR attempts (min 1.5 seconds between attempts, skip for manual)
    const now = Date.now();
    if (!manualTrigger && now - lastOcrAttemptRef.current < 1500) return;
    lastOcrAttemptRef.current = now;
    
    const imageBase64 = captureFrame();
    if (!imageBase64) {
      console.log('Could not capture frame for OCR');
      return;
    }
    
    setIsOcrProcessing(true);
    setOcrAttempts(prev => prev + 1);
    
    try {
      console.log('Attempting OCR for frame number...');
      
      const { data, error: fnError } = await supabase.functions.invoke('ocr-frame-number', {
        body: { imageBase64 }
      });
      
      if (fnError) {
        console.error('OCR function error:', fnError);
        toast({
          title: t('error'),
          description: fnError.message || 'OCR failed',
          variant: 'destructive',
        });
        return;
      }
      
      if (data?.frameNumber && data.frameNumber.length >= 3) {
        console.log('OCR detected frame number:', data.frameNumber);
        toast({
          title: t('textDetected'),
          description: data.frameNumber,
        });
        onScan(data.frameNumber);
        stopCamera();
      } else {
        console.log('OCR could not find frame number, raw:', data?.raw);
        if (manualTrigger) {
          toast({
            title: t('error'),
            description: data?.raw || 'No frame number found',
            variant: 'destructive',
          });
        }
      }
    } catch (err) {
      console.error('OCR error:', err);
      if (manualTrigger) {
        toast({
          title: t('error'),
          description: err instanceof Error ? err.message : 'OCR failed',
          variant: 'destructive',
        });
      }
    } finally {
      setIsOcrProcessing(false);
    }
  }, [captureFrame, onScan, stopCamera, t]);

  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;
    isStoppedRef.current = false;
    
    try {
      setError(null);
      
      // Configure hints for optimal barcode recognition
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.CODE_93,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.ITF,
        BarcodeFormat.CODABAR,
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.QR_CODE,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      hints.set(DecodeHintType.PURE_BARCODE, false);
      hints.set(DecodeHintType.ASSUME_CODE_39_CHECK_DIGIT, false);
      hints.set(DecodeHintType.CHARACTER_SET, 'UTF-8');

      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 100,
        delayBetweenScanSuccess: 500,
      });
      
      // Get list of video devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      
      // Find rear camera
      let selectedDeviceId: string | undefined;
      for (const device of videoDevices) {
        const label = device.label.toLowerCase();
        if (label.includes('back') || label.includes('rear') || label.includes('environment') || label.includes('achter')) {
          selectedDeviceId = device.deviceId;
          break;
        }
      }
      
      if (!selectedDeviceId && videoDevices.length > 0) {
        selectedDeviceId = videoDevices[videoDevices.length - 1].deviceId;
      }

      setIsScanning(true);

      // Track time for OCR fallback
      const startTime = Date.now();
      const OCR_DELAY_MS = 1500; // Start OCR after 1.5 seconds
      let ocrTriggered = false;

      const controls = await reader.decodeFromVideoDevice(
        selectedDeviceId,
        videoRef.current,
        (result) => {
          if (isStoppedRef.current) return;
          
          if (result) {
            const code = result.getText();
            console.log('Barcode detected:', code, 'Format:', result.getBarcodeFormat());
            onScan(code);
            stopCamera();
            return;
          }
          
          // Check if we should try OCR (after 1.5 seconds of no barcode)
          const elapsed = Date.now() - startTime;
          if (!ocrTriggered && elapsed >= OCR_DELAY_MS && !isStoppedRef.current) {
            ocrTriggered = true;
            performOcr(false);
            
            // Schedule next OCR attempt
            setTimeout(() => {
              ocrTriggered = false;
            }, 2000);
          }
        }
      );

      controlsRef.current = controls;

      // Get the stream for camera optimizations
      const stream = videoRef.current.srcObject as MediaStream;
      if (stream) {
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        
        if (track) {
          const capabilities = track.getCapabilities?.();
          
          if (capabilities && 'torch' in capabilities) {
            setTorchSupported(true);
          }

          const advancedConstraints: MediaTrackConstraintSet[] = [];
          
          // Apply zoom
          if (capabilities && 'zoom' in capabilities) {
            const zoomCapabilities = capabilities as MediaTrackCapabilities & { zoom?: { min: number; max: number } };
            if (zoomCapabilities.zoom) {
              const minZoom = zoomCapabilities.zoom.min || 1;
              const maxZoom = zoomCapabilities.zoom.max || 1;
              const targetZoom = Math.min(1.5, maxZoom);
              const actualZoom = Math.max(minZoom, targetZoom);
              advancedConstraints.push({ zoom: actualZoom } as MediaTrackConstraintSet);
            }
          }
          
          // Set focus mode to continuous
          if (capabilities && 'focusMode' in capabilities) {
            const focusModes = (capabilities as MediaTrackCapabilities & { focusMode?: string[] }).focusMode;
            if (focusModes?.includes('continuous')) {
              advancedConstraints.push({ focusMode: 'continuous' } as MediaTrackConstraintSet);
            }
          }
          
          // Set exposure mode to continuous
          if (capabilities && 'exposureMode' in capabilities) {
            const exposureModes = (capabilities as MediaTrackCapabilities & { exposureMode?: string[] }).exposureMode;
            if (exposureModes?.includes('continuous')) {
              advancedConstraints.push({ exposureMode: 'continuous' } as MediaTrackConstraintSet);
            }
          }

          if (advancedConstraints.length > 0) {
            try {
              await track.applyConstraints({ advanced: advancedConstraints } as MediaTrackConstraints);
            } catch (constraintErr) {
              console.log('Some camera optimizations not supported:', constraintErr);
            }
          }
        }
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError(t('cameraPermissionDenied'));
      setIsScanning(false);
    }
  }, [t, onScan, stopCamera, performOcr]);

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) return;
    
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const newTorchState = !torchEnabled;
      await track.applyConstraints({
        advanced: [{ torch: newTorchState } as MediaTrackConstraintSet]
      } as MediaTrackConstraints);
      setTorchEnabled(newTorchState);
    } catch (err) {
      console.error('Torch toggle error:', err);
    }
  }, [torchEnabled]);

  // Manual OCR trigger button
  const triggerManualOcr = useCallback(() => {
    if (!isOcrProcessing) {
      performOcr(true);
    }
  }, [isOcrProcessing, performOcr]);

  const handleClose = useCallback(() => {
    stopCamera();
    onClose();
  }, [stopCamera, onClose]);

  useEffect(() => {
    startCamera();
    
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  return (
    <Card className="w-full max-w-md mx-auto overflow-hidden">
      <CardContent className="p-0 relative">
        {/* Hidden canvas for frame capture */}
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 left-2 z-20 bg-black/50 hover:bg-black/70 text-white rounded-full"
          onClick={handleClose}
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Torch button - top right */}
        {torchSupported && (
          <Button
            variant="ghost"
            size="icon"
            className={`absolute top-2 right-2 z-20 rounded-full ${
              torchEnabled 
                ? 'bg-yellow-500 hover:bg-yellow-600 text-black' 
                : 'bg-black/50 hover:bg-black/70 text-white'
            }`}
            onClick={toggleTorch}
          >
            {torchEnabled ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
          </Button>
        )}

        {/* Manual OCR button - below torch or in torch position if no torch */}
        <Button
          variant="ghost"
          size="icon"
          className={`absolute ${torchSupported ? 'top-14' : 'top-2'} right-2 z-20 bg-black/50 hover:bg-black/70 text-white rounded-full`}
          onClick={triggerManualOcr}
          disabled={isOcrProcessing}
          title={t('readTextManually')}
        >
          {isOcrProcessing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Eye className="h-5 w-5" />
          )}
        </Button>

        {/* Video container with 1.5x visual zoom */}
        <div className="relative aspect-[4/3] bg-black overflow-hidden">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: 'scale(1.5)', transformOrigin: 'center center' }}
            playsInline
            muted
            autoPlay
          />
          
          {/* Scanning overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Scan guide box */}
            <div className="relative w-3/4 h-1/3 border-2 border-white/70 rounded-lg">
              {/* Corner accents */}
              <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
              <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
              <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
              <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />
              
              {/* Scanning line animation */}
              {isScanning && !isOcrProcessing && (
                <div className="absolute left-2 right-2 h-0.5 bg-primary" 
                     style={{ 
                       animation: 'scanLine 1.5s ease-in-out infinite',
                       top: '50%'
                     }} 
                />
              )}
            </div>
          </div>

          {/* OCR Processing overlay */}
          {isOcrProcessing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="flex flex-col items-center gap-2 text-white">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-sm">{t('readingText')}</span>
              </div>
            </div>
          )}

          {/* Status indicator */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <div className="flex items-center gap-2 bg-black/60 text-white px-4 py-2 rounded-full text-sm">
              {isOcrProcessing ? (
                <>
                  <Eye className="h-4 w-4" />
                  <span>{t('readingText')}</span>
                </>
              ) : (
                <>
                  <ScanLine className="h-4 w-4 animate-pulse" />
                  <span>{t('scanningBarcode')}</span>
                  {ocrAttempts > 0 && (
                    <span className="text-xs opacity-75">• {t('ocrActive')}</span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-4 bg-destructive/10 text-destructive text-center text-sm">
            {error}
          </div>
        )}

        {/* Instructions */}
        <div className="p-4 text-center text-sm text-muted-foreground space-y-1">
          <p>{t('holdCameraSteady')}</p>
          <p className="text-xs opacity-75">{t('scannerTipOcr')}</p>
        </div>
      </CardContent>

      <style>{`
        @keyframes scanLine {
          0%, 100% { transform: translateY(-30px); opacity: 0.3; }
          50% { transform: translateY(30px); opacity: 1; }
        }
      `}</style>
    </Card>
  );
}
