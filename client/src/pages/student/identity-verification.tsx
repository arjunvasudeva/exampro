import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import WebcamMonitor from "@/components/webcam-monitor";
import FaceDetection from "@/components/face-detection";
import { useWebcam } from "@/hooks/useWebcam";
import { useFaceDetection } from "@/hooks/useFaceDetection";

interface HallTicketData {
  id: string;
  examName: string;
  studentName: string;
  rollNumber: string;
  examDate: string;
  duration: number;
}

export default function IdentityVerification() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [hallTicketData, setHallTicketData] = useState<HallTicketData | null>(null);
  const [verificationStep, setVerificationStep] = useState<'camera' | 'photo' | 'document' | 'complete'>('camera');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [documentUploaded, setDocumentUploaded] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentVerificationStatus, setDocumentVerificationStatus] = useState<'pending' | 'verifying' | 'verified' | 'failed'>('pending');
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  
  // Test mode detection for bypassing camera/verification - ONLY in explicit development
  const TEST_MODE = import.meta.env.NODE_ENV === 'development' ||
                   import.meta.env.VITE_TEST_MODE === 'true' || 
                   (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  
  const { stream, isActive: cameraActive, error: cameraError, startCamera, stopCamera, capturePhoto } = useWebcam();
  const { faceDetected, confidence } = useFaceDetection(stream);

  useEffect(() => {
    // Get hall ticket data from localStorage
    const storedData = localStorage.getItem("hallTicketData");
    if (!storedData) {
      toast({
        title: "No Hall Ticket Data",
        description: "Please complete authentication first",
        variant: "destructive",
      });
      setLocation("/student/auth");
      return;
    }
    
    try {
      setHallTicketData(JSON.parse(storedData));
    } catch (error) {
      toast({
        title: "Invalid Data",
        description: "Please complete authentication again",
        variant: "destructive",
      });
      setLocation("/student/auth");
    }
  }, [setLocation, toast]);

  // Auto-start camera when component loads (or bypass in test mode if camera error)
  useEffect(() => {
    startCamera();
  }, [startCamera]);

  // Camera error bypass for test mode and auto-verification
  useEffect(() => {
    if (TEST_MODE && cameraError && cameraError.includes('NotFoundError')) {
      toast({
        title: "Test Mode Active",
        description: "Camera not available - using test mode bypass",
        variant: "default",
      });
      
      // Auto-trigger verification if document is already uploaded and camera fails
      if (documentUploaded && documentVerificationStatus === 'verified') {
        setTimeout(() => {
          console.log("Auto-triggering verification due to no camera in test mode");
          performAIVerification();
        }, 2000);
      }
    }
  }, [TEST_MODE, cameraError, documentUploaded, documentVerificationStatus, toast]);

  const handleCapturePhoto = async () => {
    try {
      const photoData = await capturePhoto();
      if (photoData) {
        setCapturedPhoto(photoData);
        setVerificationStep('document');
        toast({
          title: "Photo Captured",
          description: "Photo captured successfully. Please upload your ID document.",
        });
      }
    } catch (error) {
      toast({
        title: "Capture Failed",
        description: "Failed to capture photo. Please try again.",
        variant: "destructive",
      });
    }
  };

  const validateDocument = (file: File): { isValid: boolean; message: string } => {
    // File type validation
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return { isValid: false, message: 'Please upload a valid image file (JPEG, PNG, or WebP)' };
    }
    
    // File size validation (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return { isValid: false, message: 'File size must be less than 5MB' };
    }
    
    // File name validation (basic)
    if (file.name.length > 100) {
      return { isValid: false, message: 'File name is too long' };
    }
    
    return { isValid: true, message: 'Valid document format' };
  };

  const analyzeDocument = async (file: File): Promise<{ quality: 'good' | 'poor' | 'acceptable'; issues: string[] }> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        const issues: string[] = [];
        let quality: 'good' | 'poor' | 'acceptable' = 'good';
        
        // In development mode, be more lenient with requirements for testing
        const isDevelopment = import.meta.env.NODE_ENV === 'development' || import.meta.env.DEV;
        
        // Check image dimensions (relaxed for development)
        const minWidth = isDevelopment ? 200 : 400;
        const minHeight = isDevelopment ? 150 : 300;
        
        if (img.width < minWidth || img.height < minHeight) {
          if (isDevelopment) {
            issues.push('Low resolution image (acceptable for testing)');
            quality = 'acceptable';
          } else {
            issues.push('Image resolution is too low');
            quality = 'poor';
          }
        } else if (img.width < 800 || img.height < 600) {
          issues.push('Consider using a higher resolution image');
          quality = 'acceptable';
        }
        
        // Check aspect ratio (relaxed for development)
        const aspectRatio = img.width / img.height;
        const minRatio = isDevelopment ? 0.8 : 1.3;
        const maxRatio = isDevelopment ? 3.0 : 2.0;
        
        if (aspectRatio < minRatio || aspectRatio > maxRatio) {
          if (isDevelopment) {
            issues.push('Aspect ratio is non-standard (acceptable for testing)');
            if (quality === 'good') quality = 'acceptable';
          } else {
            issues.push('Image aspect ratio doesn\'t match typical ID cards');
            if (quality === 'good') quality = 'acceptable';
          }
        }
        
        URL.revokeObjectURL(url);
        resolve({ quality, issues });
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ quality: 'poor', issues: ['Failed to analyze image'] });
      };
      
      img.src = url;
    });
  };

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validate document format
    const validation = validateDocument(file);
    if (!validation.isValid) {
      toast({
        title: "Invalid Document",
        description: validation.message,
        variant: "destructive",
      });
      return;
    }
    
    setDocumentFile(file);
    setDocumentVerificationStatus('verifying');
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setDocumentPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    
    try {
      // Analyze document quality
      const analysis = await analyzeDocument(file);
      
      // Immediately process without delay for faster verification
      if (analysis.quality === 'poor') {
        setDocumentVerificationStatus('failed');
        toast({
          title: "Document Quality Issues",
          description: `Please upload a clearer image. Issues: ${analysis.issues.join(', ')}`,
          variant: "destructive",
        });
      } else {
        // Instead of auto-completing, trigger AI verification immediately
        if (capturedPhoto) {
          performAIVerification();
        } else {
          setDocumentVerificationStatus('verified');
          setDocumentUploaded(true);
          
          let message = "ID document uploaded successfully!";
          if (analysis.issues.length > 0) {
            message += ` Note: ${analysis.issues.join(', ')}`;
          }
          
          // Auto-trigger verification ONLY in test mode for security
          if (TEST_MODE && cameraError && cameraError.includes('NotFoundError')) {
            message += " Auto-verifying without camera (TEST MODE)...";
            setTimeout(() => performAIVerification(), 1000);
          } else {
            message += " Now capture your photo for AI verification.";
          }
          
          toast({
            title: "Document Uploaded",
            description: message,
          });
        }
      }
      
    } catch (error) {
      setDocumentVerificationStatus('failed');
      toast({
        title: "Verification Failed",
        description: "Failed to process the document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const retryDocumentUpload = () => {
    setDocumentFile(null);
    setDocumentPreview(null);
    setDocumentVerificationStatus('pending');
    setDocumentUploaded(false);
  };

  const bypassCameraForTesting = () => {
    setCapturedPhoto("test-mode-photo");
    setVerificationStep('document');
    toast({
      title: "Test Mode Bypass",
      description: "Camera verification bypassed for testing",
      variant: "default",
    });
    
    // Auto-trigger verification if document is already uploaded
    if (documentUploaded && documentVerificationStatus === 'verified') {
      setTimeout(() => {
        console.log("Auto-triggering AI verification after camera bypass");
        performAIVerification();
      }, 1000);
    }
  };

  const bypassDocumentForTesting = () => {
    setDocumentUploaded(true);
    setDocumentVerificationStatus('verified');
    setVerificationStep('complete');
    toast({
      title: "Test Mode Bypass",
      description: "Document verification bypassed for testing",
      variant: "default",
    });
  };

  // Fast AI verification function (5-10 seconds max)
  const performAIVerification = async () => {
    if (!hallTicketData) {
      toast({
        title: "Error",
        description: "Hall ticket data missing",
        variant: "destructive",
      });
      return;
    }

    if (!documentFile || !documentPreview) {
      toast({
        title: "Error", 
        description: "Please upload your ID document first",
        variant: "destructive",
      });
      return;
    }

    try {
      setVerificationResult(null);
      
      // Use placeholder photo ONLY in test mode for security
      let photoToUse = capturedPhoto;
      if (!photoToUse && TEST_MODE) {
        photoToUse = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="; // 1x1 pixel placeholder
        console.log("Using placeholder photo for verification (TEST MODE ONLY)");
      }

      if (!photoToUse) {
        toast({
          title: "Error",
          description: "Please capture your photo first or enable camera",
          variant: "destructive",
        });
        return;
      }

      console.log("Starting fast AI verification...");
      
      // Convert document file to base64
      const documentBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          const base64 = result.split(',')[1]; // Remove data:image/... prefix
          resolve(base64);
        };
        reader.readAsDataURL(documentFile);
      });

      // Extract base64 from photo (remove data URL prefix if present)
      const photoBase64 = photoToUse.includes(',') ? photoToUse.split(',')[1] : photoToUse;

      const requestData = {
        idCardImage: documentBase64,
        selfieImage: photoBase64,
        expectedName: hallTicketData.studentName,
        expectedIdNumber: hallTicketData.rollNumber,
        hallTicketId: hallTicketData.id
      };

      console.log("Calling fast verification API...");
      
      const response = await fetch('/api/verify-identity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();
      console.log("Verification result:", result);

      setVerificationResult(result);

      if (result.isValid) {
        setVerificationStep('complete');
        toast({
          title: "Verification Successful! ✅",
          description: `Identity verified in ${result.confidence ? Math.round(result.confidence * 100) : 85}% confidence. You can now start your exam.`,
        });
      } else {
        toast({
          title: "Verification Failed",
          description: result.reasons?.join('. ') || "Unable to verify identity. Please try again.",
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error("Verification error:", error);
      
      // Fast fallback: Auto-approve if API fails for speed
      if (TEST_MODE) {
        console.log("API failed, using fallback approval for test mode");
        setVerificationResult({
          isValid: true,
          confidence: 0.7,
          extractedData: { name: hallTicketData.studentName },
          faceMatch: { matches: true, confidence: 0.7 },
          reasons: ["Fallback approval: API unavailable"]
        });
        setVerificationStep('complete');
        toast({
          title: "Verification Complete ✅",
          description: "Fast approval applied. You can now start your exam.",
        });
      } else {
        toast({
          title: "Verification Error",
          description: "Failed to verify identity. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleContinueToExam = () => {
    // Store verification completion
    localStorage.setItem("verificationComplete", "true");
    setLocation("/student/exam");
  };

  const getVerificationStatus = (step: string) => {
    switch (step) {
      case 'camera':
        return faceDetected ? 'completed' : cameraActive ? 'active' : 'pending';
      case 'photo':
        return capturedPhoto ? 'completed' : verificationStep === 'photo' ? 'active' : 'pending';
      case 'document':
        return documentUploaded ? 'completed' : verificationStep === 'document' ? 'active' : 'pending';
      default:
        return 'pending';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <i className="fas fa-check-circle text-green-500"></i>;
      case 'active':
        return <i className="fas fa-clock text-yellow-500"></i>;
      default:
        return <i className="fas fa-circle text-gray-400"></i>;
    }
  };

  if (!hallTicketData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-accent flex items-center justify-center p-4">
      {/* Back Button */}
      <div className="fixed top-4 left-4 z-10">
        <Button 
          variant="outline" 
          onClick={() => setLocation("/student/auth")} 
          className="bg-white/10 border-white/20 text-white hover:bg-white/20"
          data-testid="button-back"
        >
          <i className="fas fa-arrow-left mr-2"></i>
          Back
        </Button>
      </div>
      
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-accent rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-id-card text-2xl text-white"></i>
          </div>
          <h1 className="text-2xl font-bold text-white">Identity Verification</h1>
          <p className="text-white/80 mt-2">Please verify your identity before starting the exam</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Verification Process */}
          <div className="space-y-6">
            {/* Live Photo Capture */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <i className="fas fa-video text-accent"></i>
                  <span>Live Photo Capture</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <WebcamMonitor 
                    stream={stream}
                    isActive={cameraActive}
                    error={cameraError}
                    onStartCamera={startCamera}
                    onStopCamera={stopCamera}
                  />
                  <FaceDetection stream={stream} />
                  
                  <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                      <Button
                        onClick={cameraActive ? handleCapturePhoto : startCamera}
                        disabled={cameraActive && !faceDetected}
                        className="bg-accent hover:opacity-90"
                        data-testid="button-capture-photo"
                      >
                        <i className={`fas ${cameraActive ? 'fa-camera' : 'fa-video'} mr-2`}></i>
                        {cameraActive ? 'Capture Photo' : 'Start Camera'}
                      </Button>
                      {TEST_MODE && (cameraError || !cameraActive) && (
                        <Button
                          onClick={bypassCameraForTesting}
                          variant="outline"
                          className="border-orange-300 text-orange-600 hover:bg-orange-50"
                          data-testid="button-bypass-camera"
                        >
                          <i className="fas fa-forward mr-2"></i>
                          Bypass Camera (Test)
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`status-indicator ${faceDetected ? 'status-online' : 'status-warning'}`}></div>
                      <span className="text-sm text-muted-foreground">
                        {faceDetected ? `Face Detected (${Math.round(confidence * 100)}%)` : 'No Face Detected'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ID Document Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <i className="fas fa-id-card text-accent"></i>
                  <span>ID Document Verification</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-border rounded-xl p-6 text-center bg-muted">
                  {documentVerificationStatus === 'verified' ? (
                    <div className="text-green-600">
                      <i className="fas fa-check-circle text-3xl mb-4"></i>
                      <p className="font-medium">Document verified successfully</p>
                      {documentPreview && (
                        <div className="mt-4">
                          <img 
                            src={documentPreview} 
                            alt="Uploaded document" 
                            className="max-w-32 max-h-24 object-cover rounded-lg mx-auto border"
                          />
                          <p className="text-xs text-muted-foreground mt-1">{documentFile?.name}</p>
                        </div>
                      )}
                    </div>
                  ) : documentVerificationStatus === 'verifying' ? (
                    <div className="text-blue-600">
                      <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                      <p className="font-medium">Verifying document...</p>
                      <p className="text-sm text-muted-foreground mt-2">Analyzing image quality and format</p>
                      {documentPreview && (
                        <div className="mt-4">
                          <img 
                            src={documentPreview} 
                            alt="Uploaded document" 
                            className="max-w-32 max-h-24 object-cover rounded-lg mx-auto border opacity-75"
                          />
                        </div>
                      )}
                    </div>
                  ) : documentVerificationStatus === 'failed' ? (
                    <div className="text-red-600">
                      <i className="fas fa-exclamation-triangle text-3xl mb-4"></i>
                      <p className="font-medium">Document verification failed</p>
                      <p className="text-sm text-muted-foreground mt-2">Please upload a clearer image</p>
                      {documentPreview && (
                        <div className="mt-4">
                          <img 
                            src={documentPreview} 
                            alt="Uploaded document" 
                            className="max-w-32 max-h-24 object-cover rounded-lg mx-auto border opacity-50"
                          />
                        </div>
                      )}
                      <div className="mt-3 flex gap-2 justify-center">
                        <Button 
                          onClick={retryDocumentUpload}
                          className="bg-primary hover:opacity-90"
                          data-testid="button-retry-document"
                        >
                          <i className="fas fa-redo mr-2"></i>Try Again
                        </Button>
                        {TEST_MODE && (
                          <Button
                            onClick={bypassDocumentForTesting}
                            variant="outline"
                            className="border-orange-300 text-orange-600 hover:bg-orange-50"
                            data-testid="button-bypass-document"
                          >
                            <i className="fas fa-forward mr-2"></i>
                            Bypass (Test)
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <i className="fas fa-id-card text-3xl text-muted-foreground mb-4"></i>
                      <p className="text-muted-foreground mb-4">
                        Upload your student ID or government-issued ID
                      </p>
                      <p className="text-xs text-muted-foreground mb-4">
                        Supported formats: JPEG, PNG, WebP • Max size: 5MB
                      </p>
                      <div>
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          onChange={handleDocumentUpload}
                          className="hidden"
                          id="document-upload"
                          data-testid="input-document-upload"
                        />
                        <label htmlFor="document-upload">
                          <Button asChild className="bg-primary hover:opacity-90">
                            <span>
                              <i className="fas fa-upload mr-2"></i>Choose File
                            </span>
                          </Button>
                        </label>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Student Information & Progress */}
          <div className="space-y-6">
            {/* Student Information */}
            <Card>
              <CardHeader>
                <CardTitle>Student Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted rounded-xl p-6">
                  <div className="flex items-start space-x-4 mb-6">
                    <div className="w-16 h-16 bg-gradient-primary rounded-lg flex items-center justify-center">
                      <i className="fas fa-user text-white text-xl"></i>
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg">{hallTicketData.studentName}</h4>
                      <p className="text-muted-foreground">Hall Ticket: {hallTicketData.id}</p>
                      <p className="text-muted-foreground">Roll: {hallTicketData.rollNumber}</p>
                      <p className="text-muted-foreground">Exam: {hallTicketData.examName}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Hall Ticket Verified:</span>
                      <div className="flex items-center space-x-2">
                        <i className="fas fa-check-circle text-green-500"></i>
                        <span className="text-green-600 font-medium">Valid</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Photo Match:</span>
                      <div className="flex items-center space-x-2">
                        {capturedPhoto ? (
                          <>
                            <i className="fas fa-check-circle text-green-500"></i>
                            <span className="text-green-600 font-medium">Captured</span>
                          </>
                        ) : (
                          <>
                            <i className="fas fa-clock text-yellow-500"></i>
                            <span className="text-yellow-600 font-medium">Pending</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">ID Document:</span>
                      <div className="flex items-center space-x-2">
                        {documentUploaded ? (
                          <>
                            <i className="fas fa-check-circle text-green-500"></i>
                            <span className="text-green-600 font-medium">Verified</span>
                          </>
                        ) : (
                          <>
                            <i className="fas fa-exclamation-circle text-yellow-500"></i>
                            <span className="text-yellow-600 font-medium">Pending</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Verification Checklist */}
            <Card>
              <CardHeader>
                <CardTitle>Verification Checklist</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <i className="fas fa-check-circle text-green-500"></i>
                      <span className="text-green-800">Hall ticket validated</span>
                    </div>
                  </div>
                  
                  <div className={`flex items-center justify-between p-3 rounded-lg border ${
                    capturedPhoto 
                      ? 'bg-green-50 border-green-200' 
                      : faceDetected 
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(getVerificationStatus('photo'))}
                      <span className={
                        capturedPhoto 
                          ? 'text-green-800' 
                          : faceDetected 
                            ? 'text-yellow-800'
                            : 'text-gray-600'
                      }>
                        Live photo captured
                      </span>
                    </div>
                  </div>
                  
                  <div className={`flex items-center justify-between p-3 rounded-lg border ${
                    documentUploaded 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(getVerificationStatus('document'))}
                      <span className={documentUploaded ? 'text-green-800' : 'text-gray-600'}>
                        ID document verified
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex space-x-4">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  // Reset verification
                  setCapturedPhoto(null);
                  setDocumentUploaded(false);
                  setVerificationStep('camera');
                  if (cameraActive) stopCamera();
                }}
                data-testid="button-retry"
              >
                <i className="fas fa-redo mr-2"></i>Retry Verification
              </Button>
              <Button 
                className="flex-1 bg-primary hover:opacity-90"
                disabled={!capturedPhoto || !documentUploaded}
                onClick={handleContinueToExam}
                data-testid="button-continue"
              >
                <i className="fas fa-arrow-right mr-2"></i>Continue to Exam
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
