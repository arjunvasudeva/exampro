import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

interface HallTicketData {
  id: string;
  examName: string;
  studentName: string;
  rollNumber: string;
  examDate: string;
  duration: number;
}

interface VerificationResult {
  isValid: boolean;
  confidence: number;
  extractedName?: string;
  reason: string;
}

export default function SimpleIdentityVerification() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [hallTicketData, setHallTicketData] = useState<HallTicketData | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [verificationProgress, setVerificationProgress] = useState(0);

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
    
    return { isValid: true, message: 'Valid document' };
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateDocument(file);
    if (!validation.isValid) {
      toast({
        title: "Invalid File",
        description: validation.message,
        variant: "destructive",
      });
      return;
    }

    setDocumentFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setDocumentPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    
    // Start verification immediately after upload
    await performNameVerification(file);
  };

  const performNameVerification = async (file: File) => {
    if (!hallTicketData) {
      toast({
        title: "Error",
        description: "Hall ticket data missing",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);
    setVerificationProgress(0);
    setVerificationResult(null);

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          const base64Data = result.split(',')[1]; // Remove data:image/... prefix
          resolve(base64Data);
        };
        reader.readAsDataURL(file);
      });

      // Update progress
      setVerificationProgress(30);

      console.log("Starting simple name verification...");
      
      // Call new simple verification API
      const response = await fetch('/api/verify-name', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idCardImage: base64,
          expectedName: hallTicketData.studentName
        }),
      });

      setVerificationProgress(70);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Verification request failed');
      }

      const result: VerificationResult = await response.json();
      setVerificationResult(result);
      setVerificationProgress(100);

      if (result.isValid) {
        toast({
          title: "Verification Successful",
          description: result.reason,
        });
      } else {
        toast({
          title: "Verification Failed",
          description: result.reason,
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error("Verification error:", error);
      setVerificationResult({
        isValid: false,
        confidence: 0,
        reason: error instanceof Error ? error.message : "Verification failed. Please try again."
      });
      setVerificationProgress(100);
      
      toast({
        title: "Verification Error",
        description: "Failed to verify document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const retryVerification = () => {
    setDocumentFile(null);
    setDocumentPreview(null);
    setVerificationResult(null);
    setVerificationProgress(0);
  };

  const proceedToExam = () => {
    if (verificationResult?.isValid) {
      setLocation("/student/exam");
    }
  };

  if (!hallTicketData) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Identity Verification
            </h1>
            <p className="text-muted-foreground mt-2">
              Upload your ID document to verify your identity
            </p>
          </div>

          {/* Hall Ticket Info */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <i className="fas fa-ticket-alt text-accent"></i>
                <span>Exam Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Student Name:</span>
                  <p className="text-muted-foreground">{hallTicketData.studentName}</p>
                </div>
                <div>
                  <span className="font-medium">Roll Number:</span>
                  <p className="text-muted-foreground">{hallTicketData.rollNumber}</p>
                </div>
                <div>
                  <span className="font-medium">Exam:</span>
                  <p className="text-muted-foreground">{hallTicketData.examName}</p>
                </div>
                <div>
                  <span className="font-medium">Date:</span>
                  <p className="text-muted-foreground">{hallTicketData.examDate}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Document Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <i className="fas fa-id-card text-accent"></i>
                <span>Upload ID Document</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {!documentFile ? (
                  <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                    <i className="fas fa-cloud-upload-alt text-4xl text-muted-foreground mb-4"></i>
                    <p className="text-lg font-medium mb-2">Upload your ID document</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Accepted formats: JPEG, PNG, WebP (max 5MB)
                    </p>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleDocumentUpload}
                      className="max-w-xs"
                      data-testid="input-document-upload"
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Document Preview */}
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center space-x-4">
                        {documentPreview && (
                          <img 
                            src={documentPreview} 
                            alt="Uploaded document" 
                            className="w-24 h-24 object-cover rounded-lg border"
                          />
                        )}
                        <div className="flex-1">
                          <p className="font-medium">{documentFile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(documentFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={retryVerification}
                          data-testid="button-retry-upload"
                        >
                          <i className="fas fa-redo mr-2"></i>
                          Retry
                        </Button>
                      </div>
                    </div>

                    {/* Verification Progress */}
                    {isVerifying && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Extracting name from document...</span>
                          <span>{verificationProgress}%</span>
                        </div>
                        <Progress value={verificationProgress} className="w-full" />
                      </div>
                    )}

                    {/* Verification Result */}
                    {verificationResult && (
                      <div className={`border rounded-lg p-4 ${
                        verificationResult.isValid 
                          ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950' 
                          : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
                      }`}>
                        <div className="flex items-center space-x-2 mb-2">
                          <i className={`fas ${verificationResult.isValid ? 'fa-check-circle text-green-600' : 'fa-exclamation-circle text-red-600'}`}></i>
                          <span className="font-medium">
                            {verificationResult.isValid ? 'Verification Successful' : 'Verification Failed'}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{verificationResult.reason}</p>
                        {verificationResult.extractedName && (
                          <p className="text-sm mt-2">
                            <span className="font-medium">Extracted Name:</span> {verificationResult.extractedName}
                          </p>
                        )}
                        <p className="text-sm">
                          <span className="font-medium">Confidence:</span> {Math.round(verificationResult.confidence * 100)}%
                        </p>
                      </div>
                    )}

                    {/* Continue Button */}
                    {verificationResult?.isValid && (
                      <Button
                        onClick={proceedToExam}
                        className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                        size="lg"
                        data-testid="button-continue-exam"
                      >
                        <i className="fas fa-arrow-right mr-2"></i>
                        Continue to Exam
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}