import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import WebcamMonitor from "@/components/webcam-monitor";
import FaceDetection from "@/components/face-detection";
import { useWebcam } from "@/hooks/useWebcam";
import { useFaceDetection } from "@/hooks/useFaceDetection";
import { useWebSocket } from "@/hooks/useWebSocket";

interface HallTicketData {
  id: string;
  hallTicketId: string;
  examName: string;
  studentName: string;
  rollNumber: string;
  examDate: string;
  duration: number;
}

interface Question {
  id: string;
  questionText: string;
  options: string[];
  questionType: string;
  marks: number;
}

export default function ExamMode() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [hallTicketData, setHallTicketData] = useState<HallTicketData | null>(null);
  const [examSession, setExamSession] = useState<any>(null);
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [violationCount, setViolationCount] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  
  const { isActive: cameraActive, startCamera, stopCamera, stream, error: cameraError, capturePhoto } = useWebcam();
  const { faceDetected, multipleFaces, lookingAway, confidence } = useFaceDetection(stream);
  const { sendMessage } = useWebSocket();

  // Fetch questions for the current exam session (load immediately when session is set)
  const { 
    data: questions, 
    isLoading: questionsLoading, 
    error: questionsError 
  } = useQuery<Question[]>({
    queryKey: ['/api/exam-sessions', examSession?.id, 'questions'],
    enabled: !!examSession?.id,
    staleTime: 300000, // Cache for 5 minutes
    gcTime: 600000, // Keep in cache for 10 minutes
    retry: 2, // Retry failed requests twice
  });

  // Handle questions loading errors and empty states
  useEffect(() => {
    if (questionsError) {
      console.error("Questions loading error:", questionsError);
      toast({
        title: "Questions Loading Failed",
        description: "Failed to load exam questions. Please try refreshing the page.",
        variant: "destructive",
      });
    } else if (questions && questions.length === 0 && !questionsLoading) {
      // Questions loaded successfully but empty - show error state
      toast({
        title: "No Questions Available",
        description: "This exam has no questions assigned. Please contact your administrator.",
        variant: "destructive",
      });
      setTimeout(() => {
        setLocation("/student/auth");
      }, 3000);
    }
  }, [questionsError, questions, questionsLoading, toast, setLocation]);

  // Initialize exam session
  const createSessionMutation = useMutation({
    mutationFn: async (hallTicketId: string) => {
      const response = await apiRequest("POST", "/api/exam-sessions", {
        hallTicketId,
        status: "in_progress",
        startTime: new Date().toISOString(),
        currentQuestion: 1,
        answers: {},
        timeRemaining: hallTicketData?.duration ? hallTicketData.duration * 60 : 10800, // Convert minutes to seconds
      });
      return response.json();
    },
    onSuccess: (session) => {
      setExamSession(session);
      // Don't start timer yet - wait for questions to load
      setTimeRemaining(session.timeRemaining);
      enterFullscreen();
    },
    onError: (error: any) => {
      console.error("Session creation error:", error);
      
      // Handle specific error cases
      if (error.message?.includes("No questions found")) {
        toast({
          title: "Exam Not Available",
          description: "This exam has no questions configured. Please contact your administrator.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Session Error", 
          description: error.message || "Failed to initialize exam session",
          variant: "destructive",
        });
      }
      
      // Redirect back to auth page after error
      setTimeout(() => {
        setLocation("/student/auth");
      }, 3000);
    },
  });

  // Enter fullscreen mode
  const enterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } catch (error) {
      console.error("Fullscreen error:", error);
    }
  };

  // Exit fullscreen mode
  const exitFullscreen = async () => {
    try {
      await document.exitFullscreen();
      setIsFullscreen(false);
    } catch (error) {
      console.error("Exit fullscreen error:", error);
    }
  };

  // Enhanced security violation handler
  const handleSecurityViolation = async (violationType: string, description: string, severity: "low" | "medium" | "high" | "critical" = "medium") => {
    if (!examSession) return;

    const newViolationCount = violationCount + 1;
    setViolationCount(newViolationCount);
    setWarningCount(prev => prev + 1);
    
    // Set warning message based on violation type
    let warning = "";
    if (violationType === "fullscreen_exit") {
      warning = "⚠️ Please stay in fullscreen mode during the exam!";
    } else if (violationType === "tab_switch") {
      warning = "⚠️ Switching tabs is not allowed during the exam!";
    } else if (violationType === "window_blur") {
      warning = "⚠️ Please keep the exam window focused!";
    } else if (violationType === "key_violation") {
      warning = "⚠️ Restricted key combination detected!";
    }
    
    setWarningMessage(warning);
    setShowWarning(true);

    // Auto-hide warning after 5 seconds
    setTimeout(() => {
      setShowWarning(false);
      setWarningMessage("");
    }, 5000);

    // Send violation event to server via WebSocket
    sendMessage({
      type: 'security_violation',
      data: {
        sessionId: examSession.id,
        studentId: user?.id,
        studentName: hallTicketData?.studentName,
        rollNumber: hallTicketData?.rollNumber,
        incidentType: violationType,
        severity: severity,
        description: description,
        metadata: { 
          violationCount: newViolationCount,
          warningCount: warningCount + 1,
          timestamp: new Date().toISOString()
        }
      }
    });

    // Implement violation policy
    if (newViolationCount === 1) {
      // First violation: Auto-pause exam
      setIsPaused(true);
      toast({
        title: "Exam Paused",
        description: "Your exam has been paused due to a security violation. Click 'Resume' to continue.",
        variant: "destructive",
      });
      
      // Send policy update to admin (separate from incident creation)
      sendMessage({
        type: 'policy_update',
        data: {
          sessionId: examSession.id,
          studentId: user?.id,
          studentName: hallTicketData?.studentName,
          rollNumber: hallTicketData?.rollNumber,
          action: 'paused',
          violationType,
          violationCount: newViolationCount,
          timestamp: new Date().toISOString()
        }
      });
      
    } else if (newViolationCount >= 3) {
      // Three or more violations: Auto-submit exam
      toast({
        title: "Exam Auto-Submitted",
        description: "Your exam has been automatically submitted due to multiple security violations.",
        variant: "destructive",
      });
      
      // Send policy update to admin (separate from incident creation)
      sendMessage({
        type: 'policy_update',
        data: {
          sessionId: examSession.id,
          studentId: user?.id,
          studentName: hallTicketData?.studentName,
          rollNumber: hallTicketData?.rollNumber,
          action: 'auto_submitted',
          violationType,
          violationCount: newViolationCount,
          timestamp: new Date().toISOString()
        }
      });
      
      // Auto-submit after 2 seconds
      setTimeout(() => {
        submitExam();
      }, 2000);
    } else {
      // Second violation: Warning only (status update, not incident)
      sendMessage({
        type: 'student_status',
        data: {
          sessionId: examSession.id,
          studentId: user?.id,
          studentName: hallTicketData?.studentName,
          rollNumber: hallTicketData?.rollNumber,
          violationType,
          violationCount: newViolationCount,
          action: 'warning',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  // Enhanced fullscreen and security event handling
  useEffect(() => {
    if (!examSession) return;

    // Fullscreen change handler
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);
      
      // If user exits fullscreen during exam, handle violation
      if (!isNowFullscreen) {
        handleSecurityViolation("fullscreen_exit", "Student exited fullscreen mode", "medium");
        
        // Immediately try to re-enter fullscreen
        setTimeout(() => {
          if (!document.fullscreenElement && examSession) {
            enterFullscreen();
          }
        }, 1000);
      }
    };

    // Tab switching / window blur detection
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleSecurityViolation("tab_switch", "Student switched tabs or minimized window", "medium");
      }
    };

    const handleWindowBlur = () => {
      handleSecurityViolation("window_blur", "Student left the exam window", "medium");
    };

    // Enhanced keyboard event handling with robust ESC blocking
    const blockEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.keyCode === 27 || event.which === 27) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        handleSecurityViolation("key_violation", "Student attempted to use ESC key", "medium");
        return false;
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // Block ESC key with maximum priority
      if (blockEscKey(event) === false) return false;

      // Block common exit combinations
      const blockedKeys = [
        'F11', // Toggle fullscreen
        'Alt+Tab', // Switch apps
        'Ctrl+Shift+I', // Dev tools
        'F12', // Dev tools
        'Ctrl+U', // View source
        'Ctrl+Shift+C', // Inspect element
        'Ctrl+Shift+J', // Console
        'Ctrl+R', // Refresh
        'F5', // Refresh
        'Ctrl+N', // New window
        'Ctrl+T', // New tab
        'Ctrl+W', // Close tab
      ];

      // Check for other blocked combinations
      const combo = [
        event.ctrlKey && 'Ctrl',
        event.altKey && 'Alt', 
        event.shiftKey && 'Shift',
        event.key
      ].filter(Boolean).join('+');

      if (blockedKeys.includes(combo) || blockedKeys.includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        handleSecurityViolation("key_violation", `Student attempted to use blocked key: ${combo}`, "medium");
        return false;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      blockEscKey(event);
    };

    const handleKeyPress = (event: KeyboardEvent) => {
      blockEscKey(event);
    };

    // Add event listeners with multiple layers of ESC blocking
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    
    // Multiple layers of ESC key blocking for maximum security
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('keyup', handleKeyUp, { capture: true });
    document.addEventListener('keypress', handleKeyPress, { capture: true });
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });

    // Cleanup
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      
      // Remove all ESC blocking event listeners
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('keyup', handleKeyUp, { capture: true });
      document.removeEventListener('keypress', handleKeyPress, { capture: true });
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
    };
  }, [examSession, violationCount, warningCount]);

  // Resume exam function
  const resumeExam = () => {
    setIsPaused(false);
    // Re-enter fullscreen if needed
    if (!document.fullscreenElement) {
      enterFullscreen();
    }
    toast({
      title: "Exam Resumed",
      description: "Your exam has been resumed. Please avoid further violations.",
    });
  };

  // Video snapshot streaming to admin for live monitoring
  useEffect(() => {
    if (!examSession || !stream || !sendMessage) return;

    const sendVideoSnapshot = async () => {
      try {
        // Capture snapshot from video stream
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) return;
        
        video.srcObject = stream;
        video.play();
        
        video.addEventListener('loadedmetadata', () => {
          canvas.width = 320; // Smaller size for WebSocket transmission
          canvas.height = 240;
          ctx.drawImage(video, 0, 0, 320, 240);
          
          // Convert to data URL and send via WebSocket
          const imageData = canvas.toDataURL('image/jpeg', 0.6);
          sendMessage({
            type: 'video_snapshot',
            data: {
              sessionId: examSession.id,
              studentId: user?.id,
              studentName: hallTicketData?.studentName,
              rollNumber: hallTicketData?.rollNumber,
              snapshot: imageData,
              timestamp: new Date().toISOString()
            }
          });
        });
      } catch (error) {
        console.error('Error capturing video snapshot:', error);
        // Fallback to monitoring logs API
        try {
          await apiRequest("POST", "/api/monitoring-logs", {
            sessionId: examSession.id,
            eventType: 'snapshot_failed',
            eventData: { error: error.message, timestamp: new Date().toISOString() }
          });
        } catch (fallbackError) {
          console.error('Fallback monitoring log failed:', fallbackError);
        }
      }
    };

    // Send snapshots every 3 seconds
    const snapshotInterval = setInterval(sendVideoSnapshot, 3000);
    
    return () => {
      clearInterval(snapshotInterval);
    };
  }, [examSession, stream, sendMessage, user, hallTicketData]);

  // Timer countdown - only start when questions are loaded
  useEffect(() => {
    const questionsLoaded = questions && questions.length > 0;
    if (timeRemaining > 0 && examSession && questionsLoaded) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Auto-submit exam
            submitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [timeRemaining, examSession, questions]);

  // Enhanced face detection monitoring with thresholds
  const [lookAwayCount, setLookAwayCount] = useState(0);
  const [multipleFaceCount, setMultipleFaceCount] = useState(0);
  const [lastSnapshotTime, setLastSnapshotTime] = useState(0);

  useEffect(() => {
    if (!examSession || !cameraActive) return;

    const handleFaceViolation = async (violationType: string, description: string, severity: string) => {
      try {
        // Send face violation event to server via WebSocket (server will create incident)
        sendMessage({
          type: 'face_violation',
          data: {
            sessionId: examSession.id,
            studentId: examSession.studentId,
            studentName: hallTicketData?.studentName,
            rollNumber: hallTicketData?.rollNumber,
            incidentType: violationType,
            severity: severity,
            description: description,
            metadata: { 
              confidence, 
              timestamp: new Date().toISOString()
            }
          }
        });
      } catch (error) {
        console.error('Face violation handling error:', error);
      }
    };

    const handleMonitoring = async () => {
      if (multipleFaces) {
        const newCount = multipleFaceCount + 1;
        setMultipleFaceCount(newCount);
        
        // Immediate critical alert for multiple faces
        await handleFaceViolation(
          "multiple_faces", 
          `Multiple faces detected (occurrence ${newCount})`,
          "critical"
        );
        
        setShowWarning(true);
        setWarningMessage("⚠️ Multiple faces detected! Only the exam taker should be visible.");
        
      } else if (lookingAway) {
        const newCount = lookAwayCount + 1;
        setLookAwayCount(newCount);
        
        // Progressive warnings based on count
        if (newCount === 1) {
          setShowWarning(true);
          setWarningMessage("⚠️ Please look at the camera during the exam.");
        } else if (newCount === 3) {
          // After 3 look-away detections, send alert to admin
          await handleFaceViolation(
            "looking_away_repeated", 
            `Student repeatedly looking away (${newCount} times)`,
            "high"
          );
          
          setShowWarning(true);
          setWarningMessage("⚠️ FINAL WARNING: Keep your eyes on the screen. Admin has been notified.");
          
        } else if (newCount > 3) {
          // Continue logging but don't overwhelm with alerts
          try {
            await apiRequest("POST", "/api/security-incidents", {
              sessionId: examSession.id,
              incidentType: "looking_away",
              severity: "medium",
              description: `Student looking away (occurrence ${newCount})`,
              metadata: { confidence, count: newCount }
            });
          } catch (error) {
            console.error('Security incident creation error:', error);
          }
        }
      } else {
        // Reset look away counter when face is properly detected
        if (faceDetected && lookAwayCount > 0) {
          setLookAwayCount(0);
        }
      }

      // Send lightweight status updates to admin (every 10 seconds when camera is active)
      const now = Date.now();
      if (faceDetected && now - lastSnapshotTime > 10000) {
        setLastSnapshotTime(now);
        try {
          sendMessage({
            type: 'student_status',
            data: {
              sessionId: examSession.id,
              studentId: examSession.studentId,
              timestamp: new Date().toISOString(),
              status: {
                faceDetected,
                multipleFaces,
                lookingAway,
                confidence,
                violationCount,
                lookAwayCount
              }
            }
          });
        } catch (error) {
          console.error('Status update error:', error);
        }
      }
    };

    // Execute monitoring logic
    handleMonitoring();

  }, [multipleFaces, lookingAway, faceDetected, examSession, cameraActive, confidence, lookAwayCount, multipleFaceCount, lastSnapshotTime]);

  // Create security incident

  // Load hall ticket data on mount and start camera immediately
  useEffect(() => {
    const storedData = localStorage.getItem("hallTicketData");
    const verificationComplete = localStorage.getItem("verificationComplete");
    
    if (!storedData || !verificationComplete) {
      toast({
        title: "Authentication Required",
        description: "Please complete authentication and verification first",
        variant: "destructive",
      });
      setLocation("/student/auth");
      return;
    }
    
    try {
      const data = JSON.parse(storedData);
      setHallTicketData(data);
      
      // Start camera immediately for faster activation
      startCamera();
      
      createSessionMutation.mutate(data.id);
    } catch (error) {
      toast({
        title: "Invalid Data",
        description: "Please complete authentication again",
        variant: "destructive",
      });
      setLocation("/student/auth");
    }
  }, [startCamera]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerChange = (questionIndex: number, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionIndex]: answer }));
  };

  const navigateQuestion = (direction: 'prev' | 'next') => {
    const questionsLength = questions?.length || 0;
    if (direction === 'prev' && currentQuestion > 1) {
      setCurrentQuestion(prev => prev - 1);
    } else if (direction === 'next' && currentQuestion < questionsLength) {
      setCurrentQuestion(prev => prev + 1);
    }
  };

  // Submit exam mutation
  const submitExamMutation = useMutation({
    mutationFn: async () => {
      if (!examSession) throw new Error("No exam session found");
      
      const response = await apiRequest("POST", `/api/exam-sessions/${examSession.id}/submit`, {
        answers
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Exam Submitted",
        description: "Your exam has been submitted successfully",
      });
      
      // Exit fullscreen and clean up
      exitFullscreen();
      localStorage.removeItem("hallTicketData");
      localStorage.removeItem("verificationComplete");
      setLocation("/exam-complete");
    },
    onError: (error) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit exam. Please try again.",
        variant: "destructive",
      });
    }
  });

  const submitExam = () => {
    submitExamMutation.mutate();
  };

  if (!hallTicketData || !examSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Initializing exam session...</p>
        </div>
      </div>
    );
  }

  // Safe access to questions array
  const questionsArray = questions || [];
  const currentQuestionData = questionsArray[currentQuestion - 1];

  // Show loading while questions are being fetched
  if (questionsLoading || !currentQuestionData || questionsArray.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading exam questions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="kiosk-mode bg-background">
      {/* Exam Header */}
      <div className="bg-gradient-primary text-white p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <i className="fas fa-graduation-cap text-2xl"></i>
          <div>
            <h1 className="font-bold text-lg">{hallTicketData.examName}</h1>
            <p className="text-sm opacity-90">
              {hallTicketData.hallTicketId || hallTicketData.id} - {hallTicketData.studentName} ({hallTicketData.rollNumber})
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-6">
          {/* Timer */}
          <div className="text-center">
            <div className="text-3xl font-mono font-bold">{formatTime(timeRemaining)}</div>
            <div className="text-xs opacity-75">Time Remaining</div>
          </div>
          
          {/* Status Indicators */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1">
              <div className={`status-indicator ${faceDetected ? 'status-online pulse-green' : 'status-warning'}`}></div>
              <span className="text-xs">Camera</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="status-indicator status-online"></div>
              <span className="text-xs">Network</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Question Panel */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            {/* Question Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <span className="bg-primary text-primary-foreground px-4 py-2 rounded-full font-semibold">
                  Question {currentQuestion} of {questionsArray.length}
                </span>
                <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm">
                  Multiple Choice
                </span>
              </div>
              <div className="flex space-x-2">
                <button className="bg-yellow-100 text-yellow-800 p-2 rounded-lg hover:bg-yellow-200">
                  <i className="fas fa-flag"></i>
                </button>
              </div>
            </div>

            {/* Question Content */}
            <div className="bg-card rounded-xl p-6 shadow-sm mb-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {currentQuestionData.questionText}
              </h2>
              
              <div className="space-y-4 mt-6">
                {currentQuestionData.options.map((option: string, index: number) => {
                  const optionLetter = String.fromCharCode(65 + index); // A, B, C, D
                  const isSelected = answers[currentQuestion] === optionLetter;
                  
                  return (
                    <label 
                      key={index}
                      className={`flex items-center p-4 rounded-lg cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-primary/10 border-2 border-primary' 
                          : 'bg-muted hover:bg-border'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="answer" 
                        value={optionLetter}
                        checked={isSelected}
                        onChange={(e) => handleAnswerChange(currentQuestion, e.target.value)}
                        className="mr-4 w-5 h-5 accent-primary"
                        data-testid={`option-${optionLetter}`}
                      />
                      <div>
                        <span className="font-medium text-primary mr-3">{optionLetter})</span>
                        <span>{option}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                onClick={() => navigateQuestion('prev')}
                disabled={currentQuestion === 1}
                data-testid="button-previous"
              >
                <i className="fas fa-chevron-left mr-2"></i>Previous
              </Button>
              
              <div className="flex space-x-4">
                <Button
                  variant="outline"
                  className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                  data-testid="button-bookmark"
                >
                  <i className="fas fa-bookmark mr-2"></i>Save & Mark
                </Button>
                {questions && currentQuestion < questions.length ? (
                  <Button
                    onClick={() => navigateQuestion('next')}
                    data-testid="button-next"
                  >
                    Next<i className="fas fa-chevron-right ml-2"></i>
                  </Button>
                ) : (
                  <Button
                    onClick={submitExam}
                    variant="destructive"
                    data-testid="button-submit"
                  >
                    <i className="fas fa-paper-plane mr-2"></i>Submit Exam
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Question Navigation Panel */}
        <div className="w-80 bg-card border-l border-border p-6">
          <div className="mb-6">
            <h3 className="font-semibold text-foreground mb-4">Question Navigator</h3>
            
            {/* Legend */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-6 h-6 bg-green-500 rounded"></div>
                <span>Answered</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-6 h-6 bg-primary rounded"></div>
                <span>Current</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-6 h-6 bg-yellow-500 rounded"></div>
                <span>Marked</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-6 h-6 bg-muted border-2 border-border rounded"></div>
                <span>Not Visited</span>
              </div>
            </div>
            
            {/* Question Grid */}
            <div className="grid grid-cols-5 gap-2">
              {questionsArray.map((_: Question, index: number) => {
                const questionNum = index + 1;
                const isAnswered = answers[questionNum];
                const isCurrent = currentQuestion === questionNum;
                
                return (
                  <button
                    key={index}
                    className={`w-10 h-10 rounded font-medium hover:opacity-80 transition-opacity ${
                      isCurrent 
                        ? 'bg-primary text-white' 
                        : isAnswered 
                          ? 'bg-green-500 text-white'
                          : 'bg-muted border-2 border-border hover:bg-border'
                    }`}
                    onClick={() => setCurrentQuestion(questionNum)}
                    data-testid={`question-nav-${questionNum}`}
                  >
                    {questionNum}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Exam Summary */}
          <div className="bg-muted rounded-lg p-4 mb-6">
            <h4 className="font-semibold mb-3">Progress Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Answered:</span>
                <span className="font-medium text-green-600">
                  {Object.keys(answers).length}/{questions?.length || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Marked:</span>
                <span className="font-medium text-yellow-600">0/{questions?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Not Visited:</span>
                <span className="font-medium text-muted-foreground">
                  {(questions?.length || 0) - Math.max(...Object.keys(answers).map(Number), 0)}/{questions?.length || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Submit Section */}
          <div className="border-t border-border pt-4">
            <Button
              onClick={submitExam}
              variant="destructive"
              className="w-full"
              data-testid="button-final-submit"
            >
              <i className="fas fa-paper-plane mr-2"></i>Submit Exam
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Auto-submit in {formatTime(timeRemaining)}
            </p>
          </div>
        </div>
      </div>

      {/* Enhanced Live Camera Feed (Bottom-right corner) */}
      <div className="fixed bottom-4 right-4 w-72 h-52 bg-black rounded-lg overflow-hidden shadow-xl border-2 border-primary z-10">
        <WebcamMonitor 
          stream={stream}
          isActive={cameraActive}
          error={cameraError}
          onStartCamera={startCamera}
          onStopCamera={stopCamera}
          className="w-full h-full"
        />
        <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-mono">
          ● LIVE
        </div>
        <div className={`absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs transition-colors ${
          faceDetected ? 'bg-green-600/70' : 'bg-red-600/70'
        }`}>
          Face: {faceDetected ? '✓' : '✗'}
        </div>
        <div className="absolute bottom-2 left-2 right-2">
          <div className="bg-black/70 text-white px-2 py-1 rounded text-xs text-center">
            {cameraActive ? 'Monitoring Active' : 'Camera Inactive'}
          </div>
        </div>
        {multipleFaces && (
          <div className="absolute inset-0 bg-red-600/20 border-2 border-red-500 animate-pulse">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-600 text-white px-3 py-1 rounded font-bold text-sm">
              MULTIPLE FACES!
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Warning Banner */}
      {showWarning && (
        <div className="fixed top-0 left-0 right-0 bg-destructive text-destructive-foreground p-4 text-center font-semibold z-20">
          <i className="fas fa-exclamation-triangle mr-2"></i>
          {warningMessage || 
            `WARNING: ${multipleFaces ? 'Multiple faces detected' : lookingAway ? 'Looking away detected' : 'Please face the camera'}.`
          }
          <Button
            variant="secondary"
            size="sm"
            className="ml-4"
            onClick={() => setShowWarning(false)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Exam Paused Overlay */}
      {isPaused && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-card p-8 rounded-xl shadow-2xl text-center max-w-md mx-4">
            <div className="mb-6">
              <i className="fas fa-pause-circle text-6xl text-yellow-500 mb-4"></i>
              <h2 className="text-2xl font-bold text-foreground mb-2">Exam Paused</h2>
              <p className="text-muted-foreground mb-4">
                Your exam has been paused due to a security violation.
              </p>
              <div className="bg-muted rounded-lg p-4 mb-6">
                <p className="text-sm">
                  <strong>Violations:</strong> {violationCount}/3
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {violationCount >= 2 
                    ? "⚠️ One more violation will auto-submit your exam!" 
                    : "Please avoid further violations to continue."
                  }
                </p>
              </div>
            </div>
            <Button 
              onClick={resumeExam}
              size="lg"
              className="w-full"
              data-testid="button-resume"
            >
              <i className="fas fa-play mr-2"></i>
              Resume Exam
            </Button>
          </div>
        </div>
      )}

      {/* Enhanced Security Status Indicator */}
      <div className="fixed bottom-4 left-4 bg-card/95 backdrop-blur border rounded-lg p-3 shadow-lg z-10">
        <div className="text-xs space-y-1">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isFullscreen ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>Fullscreen: {isFullscreen ? 'Active' : 'Inactive'}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${violationCount === 0 ? 'bg-green-500' : violationCount < 3 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
            <span>Violations: {violationCount}/3</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${faceDetected ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <span>Face: {faceDetected ? 'Detected' : 'Not Found'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
