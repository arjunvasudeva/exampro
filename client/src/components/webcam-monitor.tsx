import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface WebcamMonitorProps {
  className?: string;
  showControls?: boolean;
  onStreamReady?: (stream: MediaStream) => void;
  stream?: MediaStream | null;
  isActive?: boolean;
  error?: string | null;
  onStartCamera?: () => void;
  onStopCamera?: () => void;
}

export default function WebcamMonitor({ 
  className = "", 
  showControls = false, 
  onStreamReady,
  stream,
  isActive = false,
  error,
  onStartCamera,
  onStopCamera
}: WebcamMonitorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Set video stream when available
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      onStreamReady?.(stream);
    }
  }, [stream, onStreamReady]);

  // Handle errors
  useEffect(() => {
    if (error) {
      toast({
        title: "Camera Error",
        description: error,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const handleFullscreen = async () => {
    if (!videoRef.current) return;

    try {
      if (isFullscreen) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } else {
        await videoRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch (error) {
      console.error("Fullscreen error:", error);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div className="video-feed bg-black rounded-lg overflow-hidden" style={{ aspectRatio: "16/9" }}>
        {stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            data-testid="webcam-video"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white">
            {error ? (
              <div className="text-center">
                <i className="fas fa-exclamation-triangle text-red-400 text-2xl mb-2"></i>
                <p className="text-red-400">Camera Error</p>
                <p className="text-xs opacity-75">{error}</p>
              </div>
            ) : isActive ? (
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-2"></div>
                <p>Starting camera...</p>
              </div>
            ) : (
              <div className="text-center">
                <i className="fas fa-video-slash text-muted-foreground text-2xl mb-2"></i>
                <p className="text-muted-foreground">Camera inactive</p>
                {showControls && (
                  <Button 
                    className="mt-2" 
                    onClick={onStartCamera}
                    data-testid="button-start-camera"
                  >
                    Start Camera
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Camera status overlay */}
        {stream && (
          <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs flex items-center space-x-1">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span>LIVE</span>
          </div>
        )}

        {/* Controls overlay */}
        {showControls && stream && (
          <div className="absolute bottom-2 right-2 flex space-x-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleFullscreen}
              data-testid="button-fullscreen"
            >
              <i className={`fas ${isFullscreen ? 'fa-compress' : 'fa-expand'}`}></i>
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={onStopCamera}
              data-testid="button-stop-camera"
            >
              <i className="fas fa-stop"></i>
            </Button>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">
            <i className="fas fa-exclamation-circle mr-1"></i>
            {error}
          </p>
          <Button 
            size="sm" 
            className="mt-2" 
            onClick={onStartCamera}
            data-testid="button-retry-camera"
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
