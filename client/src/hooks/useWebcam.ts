import { useState, useRef, useCallback } from 'react';

export function useWebcam() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setIsActive(true);

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);
      
      console.log('Camera started successfully');
    } catch (err) {
      console.error('Failed to start camera:', err);
      let errorMessage = 'Failed to access camera';
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          errorMessage = 'Camera access denied. Please allow camera permissions.';
        } else if (err.name === 'NotFoundError') {
          errorMessage = 'No camera device found.';
        } else if (err.name === 'NotReadableError') {
          errorMessage = 'Camera is already in use by another application.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      setIsActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
      setStream(null);
    }
    setIsActive(false);
    console.log('Camera stopped');
  }, []);

  const capturePhoto = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!streamRef.current) {
        resolve(null);
        return;
      }

      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(null);
        return;
      }

      video.srcObject = streamRef.current;
      video.play();

      video.addEventListener('loadedmetadata', () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl);
      });
    });
  }, []);

  const switchCamera = useCallback(async (facingMode: 'user' | 'environment' = 'user') => {
    if (streamRef.current) {
      stopCamera();
    }
    
    try {
      setError(null);
      setIsActive(true);

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode
        },
        audio: false
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);
    } catch (err) {
      console.error('Failed to switch camera:', err);
      setError('Failed to switch camera');
      setIsActive(false);
    }
  }, [stopCamera]);

  return {
    stream,
    isActive,
    error,
    startCamera,
    stopCamera,
    capturePhoto,
    switchCamera
  };
}
