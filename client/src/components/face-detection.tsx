import { useEffect, useState } from "react";
import { useFaceDetection } from "@/hooks/useFaceDetection";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface FaceDetectionProps {
  onDetectionChange?: (detection: {
    faceDetected: boolean;
    multipleFaces: boolean;
    lookingAway: boolean;
    confidence: number;
  }) => void;
  showVisualization?: boolean;
  className?: string;
  stream?: MediaStream | null;
}

export default function FaceDetection({ 
  onDetectionChange, 
  showVisualization = true, 
  className = "",
  stream
}: FaceDetectionProps) {
  const { 
    faceDetected, 
    multipleFaces, 
    lookingAway, 
    confidence, 
    isLoading, 
    error 
  } = useFaceDetection(stream);

  const [detectionHistory, setDetectionHistory] = useState<boolean[]>([]);
  const [alertCount, setAlertCount] = useState(0);

  // Update detection history for stability
  useEffect(() => {
    setDetectionHistory(prev => {
      const newHistory = [...prev, faceDetected].slice(-10); // Keep last 10 readings
      return newHistory;
    });
  }, [faceDetected]);

  // Report detection changes to parent
  useEffect(() => {
    onDetectionChange?.({
      faceDetected,
      multipleFaces,
      lookingAway,
      confidence
    });
  }, [faceDetected, multipleFaces, lookingAway, confidence, onDetectionChange]);

  // Track alerts
  useEffect(() => {
    if (multipleFaces || lookingAway) {
      setAlertCount(prev => prev + 1);
    }
  }, [multipleFaces, lookingAway]);

  const getDetectionStatus = () => {
    if (isLoading) return { status: 'loading', color: 'secondary', icon: 'fa-spinner fa-spin' };
    if (error) return { status: 'error', color: 'destructive', icon: 'fa-exclamation-triangle' };
    if (multipleFaces) return { status: 'multiple_faces', color: 'destructive', icon: 'fa-users' };
    if (lookingAway) return { status: 'looking_away', color: 'yellow', icon: 'fa-eye-slash' };
    if (faceDetected) return { status: 'face_detected', color: 'success', icon: 'fa-user-check' };
    return { status: 'no_face', color: 'secondary', icon: 'fa-user-times' };
  };

  const getStatusMessage = () => {
    const status = getDetectionStatus();
    switch (status.status) {
      case 'loading':
        return 'Initializing face detection...';
      case 'error':
        return `Detection error: ${error}`;
      case 'multiple_faces':
        return 'ALERT: Multiple faces detected!';
      case 'looking_away':
        return 'WARNING: Looking away from camera';
      case 'face_detected':
        return `Face detected (${Math.round(confidence * 100)}% confidence)`;
      default:
        return 'No face detected';
    }
  };

  const getStabilityScore = () => {
    if (detectionHistory.length === 0) return 0;
    const positiveDetections = detectionHistory.filter(Boolean).length;
    return Math.round((positiveDetections / detectionHistory.length) * 100);
  };

  const status = getDetectionStatus();

  if (!showVisualization) {
    return (
      <div className={`flex items-center space-x-2 ${className}`} data-testid="face-detection-minimal">
        <div className={`status-indicator ${
          status.color === 'success' ? 'status-online' :
          status.color === 'destructive' ? 'status-danger' :
          status.color === 'yellow' ? 'status-warning' :
          'status-offline'
        } ${faceDetected && !multipleFaces && !lookingAway ? 'pulse-green' : ''}`}></div>
        <span className="text-sm text-muted-foreground">{getStatusMessage()}</span>
      </div>
    );
  }

  return (
    <Card className={`${className}`} data-testid="face-detection-card">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Main Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center ${
                status.color === 'success' ? 'border-green-400 bg-green-50' :
                status.color === 'destructive' ? 'border-red-400 bg-red-50 pulse-red' :
                status.color === 'yellow' ? 'border-yellow-400 bg-yellow-50' :
                'border-gray-400 bg-gray-50'
              }`}>
                <i className={`fas ${status.icon} ${
                  status.color === 'success' ? 'text-green-600' :
                  status.color === 'destructive' ? 'text-red-600' :
                  status.color === 'yellow' ? 'text-yellow-600' :
                  'text-gray-600'
                } text-lg`}></i>
              </div>
              <div>
                <h4 className="font-medium text-foreground">Face Detection</h4>
                <p className="text-sm text-muted-foreground">{getStatusMessage()}</p>
              </div>
            </div>
            <Badge 
              variant={
                status.color === 'success' ? 'default' :
                status.color === 'destructive' ? 'destructive' :
                status.color === 'yellow' ? 'secondary' :
                'outline'
              }
              data-testid="detection-status-badge"
            >
              {status.status.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>

          {/* Detection Metrics */}
          {faceDetected && !isLoading && (
            <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border">
              <div className="text-center">
                <div className="text-lg font-semibold text-foreground" data-testid="confidence-score">
                  {Math.round(confidence * 100)}%
                </div>
                <div className="text-xs text-muted-foreground">Confidence</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-foreground" data-testid="stability-score">
                  {getStabilityScore()}%
                </div>
                <div className="text-xs text-muted-foreground">Stability</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-foreground" data-testid="alert-count">
                  {alertCount}
                </div>
                <div className="text-xs text-muted-foreground">Alerts</div>
              </div>
            </div>
          )}

          {/* Alert Messages */}
          {multipleFaces && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <i className="fas fa-exclamation-circle text-red-500"></i>
                <div>
                  <p className="text-red-700 text-sm font-medium">Multiple Faces Detected</p>
                  <p className="text-red-600 text-xs">Only one person should be visible during the exam.</p>
                </div>
              </div>
            </div>
          )}

          {lookingAway && !multipleFaces && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <i className="fas fa-eye-slash text-yellow-500"></i>
                <div>
                  <p className="text-yellow-700 text-sm font-medium">Attention Warning</p>
                  <p className="text-yellow-600 text-xs">Please look directly at the camera.</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <i className="fas fa-exclamation-triangle text-red-500"></i>
                <div>
                  <p className="text-red-700 text-sm font-medium">Detection Error</p>
                  <p className="text-red-600 text-xs">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Success State */}
          {faceDetected && !multipleFaces && !lookingAway && !error && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <i className="fas fa-check-circle text-green-500"></i>
                <div>
                  <p className="text-green-700 text-sm font-medium">Detection Active</p>
                  <p className="text-green-600 text-xs">Face monitoring is working properly.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
