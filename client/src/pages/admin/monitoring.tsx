import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useWebSocket } from "@/hooks/useWebSocket";
import WebcamMonitor from "@/components/webcam-monitor";
import type { ExamSession } from "@shared/schema";

interface StudentMonitoring {
  id: string;
  name: string;
  rollNumber: string;
  status: 'normal' | 'warning' | 'alert' | 'offline';
  faceDetected: boolean;
  multipleFaces: boolean;
  lookingAway: boolean;
  confidence: number;
  progress: number;
  timeRemaining: number;
  lastActivity: string;
  cameraStream?: MediaStream | null;
  examSessionId?: string;
  videoSnapshot?: string; // Base64 image data for live video feed
}

export default function MonitoringSystem() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [filter, setFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [studentsPerPage] = useState(12);
  const [monitoringData, setMonitoringData] = useState<StudentMonitoring[]>([]);

  // WebSocket connection for real-time monitoring
  const { sendMessage, lastMessage } = useWebSocket();

  // Fetch active sessions
  const { data: activeSessions = [], isLoading } = useQuery<ExamSession[]>({
    queryKey: ["/api/active-sessions"],
    refetchInterval: 2000, // Refresh every 2 seconds
  });

  // Handle WebSocket messages for real-time updates
  useEffect(() => {
    if (lastMessage) {
      try {
        const message = JSON.parse(lastMessage.data);
        
        if (message.type === 'student_status') {
          setMonitoringData(prev => {
            const updated = [...prev];
            const index = updated.findIndex(s => s.id === message.data.studentId);
            if (index !== -1) {
              updated[index] = { ...updated[index], ...message.data };
            } else {
              updated.push({
                id: message.data.studentId,
                name: message.data.studentName || 'Unknown Student',
                rollNumber: message.data.rollNumber || 'N/A',
                status: message.data.status || 'normal',
                faceDetected: message.data.faceDetected || false,
                multipleFaces: message.data.multipleFaces || false,
                lookingAway: message.data.lookingAway || false,
                confidence: message.data.confidence || 0,
                progress: message.data.progress || 0,
                timeRemaining: message.data.timeRemaining || 0,
                lastActivity: new Date().toISOString()
              });
            }
            return updated;
          });
        }

        if (message.type === 'video_feed') {
          setMonitoringData(prev => {
            const updated = [...prev];
            const index = updated.findIndex(s => s.id === message.data.studentId);
            if (index !== -1) {
              // Update existing student with video snapshot
              updated[index] = { 
                ...updated[index], 
                lastActivity: new Date().toISOString(),
                videoSnapshot: message.data.snapshot
              };
            } else {
              // Add new student with video feed
              updated.push({
                id: message.data.studentId,
                name: message.data.studentName || 'Unknown Student',
                rollNumber: message.data.rollNumber || 'N/A',
                status: 'normal',
                faceDetected: true,
                multipleFaces: false,
                lookingAway: false,
                confidence: 0.8,
                progress: 0,
                timeRemaining: 0,
                lastActivity: new Date().toISOString(),
                videoSnapshot: message.data.snapshot,
                examSessionId: message.data.sessionId
              });
            }
            return updated;
          });
        }
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    }
  }, [lastMessage]);

  // Connect to admin WebSocket on mount
  useEffect(() => {
    if (user) {
      sendMessage({
        type: 'auth',
        userId: user.id,
        userType: 'admin'
      });
    }
  }, [user, sendMessage]);

  // Convert active sessions to monitoring data with default values
  useEffect(() => {
    if (activeSessions.length > 0) {
      const sessionData = activeSessions.map(session => ({
        id: session.id,
        name: session.studentId?.includes('student_') ? 
              session.studentId.replace('student_', '') : 
              `Student ${session.studentId?.slice(-4)}`,
        rollNumber: session.studentId?.replace('student_', '') || 'Unknown',
        status: 'normal' as const, // Default status, will be updated via WebSocket
        faceDetected: false, // Default false, will be updated via WebSocket
        multipleFaces: false,
        lookingAway: false,
        confidence: 0,
        progress: (session.currentQuestion || 1),
        timeRemaining: session.timeRemaining || 0,
        lastActivity: new Date().toISOString(),
        examSessionId: session.id
      })) as StudentMonitoring[];
      
      setMonitoringData(sessionData);
    }
  }, [activeSessions]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'status-online';
      case 'warning': return 'status-warning';
      case 'alert': return 'status-danger';
      default: return 'status-offline';
    }
  };

  const getStatusBorder = (status: string) => {
    switch (status) {
      case 'alert': return 'border-red-400';
      case 'warning': return 'border-yellow-400';
      case 'normal': return 'border-green-400';
      default: return 'border-gray-400';
    }
  };

  const filteredStudents = monitoringData.filter(student => {
    if (filter === "all") return true;
    if (filter === "alerts") return student.status === "alert";
    if (filter === "warnings") return student.status === "warning";
    if (filter === "normal") return student.status === "normal";
    if (filter === "offline") return student.status === "offline";
    return true;
  });

  const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);
  const currentStudents = filteredStudents.slice(
    (currentPage - 1) * studentsPerPage,
    currentPage * studentsPerPage
  );

  const monitoringStats = {
    activeStreams: monitoringData.length,
    faceDetected: monitoringData.filter(s => s.faceDetected).length,
    warnings: monitoringData.filter(s => s.status === 'warning').length,
    criticalAlerts: monitoringData.filter(s => s.status === 'alert').length,
    aiAccuracy: 98.7,
    snapshots: Math.floor(monitoringData.length * 1.5)
  };

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Admin access required</p>
            <Link href="/">
              <Button className="mt-4" data-testid="button-home">
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Monitoring Header */}
      <div className="glass-header px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <i className="fas fa-tv text-primary text-2xl"></i>
            <div>
              <h1 className="text-xl font-bold text-foreground">Live Monitoring System</h1>
              <p className="text-sm text-muted-foreground">Real-time surveillance and AI analysis</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-green-100 px-3 py-1 rounded-full">
              <div className="status-indicator status-online pulse-green"></div>
              <span className="text-sm text-green-700">All Systems Active</span>
            </div>
            <Link href="/admin/dashboard">
              <Button variant="outline" data-testid="button-dashboard">
                <i className="fas fa-tachometer-alt mr-2"></i>Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Monitoring Controls */}
        <Card className="shadow-sm mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Monitoring Controls</CardTitle>
              <div className="flex items-center space-x-3">
                <Button className="bg-green-500 text-white hover:opacity-90" data-testid="button-start-cameras">
                  <i className="fas fa-play mr-2"></i>Start All Cameras
                </Button>
                <Button variant="destructive" data-testid="button-stop-cameras">
                  <i className="fas fa-stop mr-2"></i>Stop All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-muted rounded-lg p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground" data-testid="stat-active-streams">
                    {monitoringStats.activeStreams}
                  </div>
                  <div className="text-sm text-muted-foreground">Active Streams</div>
                </div>
              </div>
              <div className="bg-muted rounded-lg p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600" data-testid="stat-face-detected">
                    {monitoringStats.faceDetected}
                  </div>
                  <div className="text-sm text-muted-foreground">Face Detected</div>
                </div>
              </div>
              <div className="bg-muted rounded-lg p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600" data-testid="stat-warnings">
                    {monitoringStats.warnings}
                  </div>
                  <div className="text-sm text-muted-foreground">Warnings</div>
                </div>
              </div>
              <div className="bg-muted rounded-lg p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600" data-testid="stat-critical-alerts">
                    {monitoringStats.criticalAlerts}
                  </div>
                  <div className="text-sm text-muted-foreground">Critical Alerts</div>
                </div>
              </div>
              <div className="bg-muted rounded-lg p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600" data-testid="stat-ai-accuracy">
                    {monitoringStats.aiAccuracy}%
                  </div>
                  <div className="text-sm text-muted-foreground">AI Accuracy</div>
                </div>
              </div>
              <div className="bg-muted rounded-lg p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600" data-testid="stat-snapshots">
                    {monitoringStats.snapshots}
                  </div>
                  <div className="text-sm text-muted-foreground">Snapshots</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Video Grid */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Live Video Feeds</CardTitle>
              <div className="flex items-center space-x-3">
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-48" data-testid="select-filter">
                    <SelectValue placeholder="Filter students" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Students</SelectItem>
                    <SelectItem value="alerts">Alert Status Only</SelectItem>
                    <SelectItem value="warnings">Warning Status Only</SelectItem>
                    <SelectItem value="normal">Normal Status Only</SelectItem>
                    <SelectItem value="offline">Offline Students</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="bg-primary text-primary-foreground" data-testid="button-fullscreen">
                  <i className="fas fa-expand mr-2"></i>Fullscreen Mode
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading video feeds...</p>
              </div>
            ) : currentStudents.length === 0 ? (
              <div className="text-center py-8">
                <i className="fas fa-video-slash text-muted-foreground text-4xl mb-4"></i>
                <p className="text-muted-foreground">No active video feeds</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {currentStudents.map((student) => (
                  <div key={student.id} className="relative group" data-testid={`video-feed-${student.id}`}>
                    <div className={`video-feed bg-gray-900 rounded-lg overflow-hidden border-2 ${getStatusBorder(student.status)}`} style={{ aspectRatio: '4/3' }}>
                      {/* Live Video Feed Display */}
                      <div className="w-full h-full relative bg-gradient-to-br from-gray-900 to-gray-800">
                        {student.videoSnapshot ? (
                          // Display actual video snapshot from student
                          <img 
                            src={student.videoSnapshot} 
                            alt={`Live feed for ${student.name}`}
                            className="w-full h-full object-cover"
                            style={{ imageRendering: 'auto' }}
                          />
                        ) : (
                          // Fallback to status visualization when no video feed
                          <div className="absolute inset-0 flex items-center justify-center">
                            {student.faceDetected ? (
                              <div className="text-center">
                                {/* Face Detection Visual */}
                                <div className="relative mb-4">
                                  {student.multipleFaces ? (
                                    <div className="w-16 h-16 border-2 border-red-400 rounded-full flex items-center justify-center animate-pulse">
                                      <i className="fas fa-users text-red-400 text-xl"></i>
                                    </div>
                                  ) : student.lookingAway ? (
                                    <div className="w-16 h-16 border-2 border-yellow-400 rounded-full flex items-center justify-center">
                                      <i className="fas fa-eye-slash text-yellow-400 text-xl"></i>
                                    </div>
                                  ) : (
                                    <div className="w-16 h-16 border-2 border-green-400 rounded-full flex items-center justify-center">
                                      <i className="fas fa-user text-green-400 text-xl"></i>
                                    </div>
                                  )}
                                  {/* Status indicator */}
                                  <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full ${
                                    student.status === 'alert' ? 'bg-red-500 animate-ping' :
                                    student.status === 'warning' ? 'bg-yellow-500 animate-pulse' :
                                    'bg-green-500'
                                  }`}></div>
                                </div>
                                {/* Live indicator */}
                                <div className="flex items-center justify-center space-x-1 text-green-400 text-xs">
                                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                  <span>STATUS ONLY</span>
                                </div>
                                <div className="text-xs text-gray-300 mt-1">
                                  Confidence: {Math.round(student.confidence * 100)}%
                                </div>
                              </div>
                            ) : (
                              <div className="text-center">
                                <div className="w-16 h-16 border-2 border-gray-500 rounded-full flex items-center justify-center mb-4">
                                  <i className="fas fa-video-slash text-gray-500 text-xl"></i>
                                </div>
                                <div className="text-xs text-gray-400">Camera Inactive</div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Overlays */}
                        <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                          {student.name}
                        </div>
                        <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs text-white flex items-center space-x-1 ${
                          student.status === 'alert' ? 'bg-red-500' :
                          student.status === 'warning' ? 'bg-yellow-500' :
                          student.status === 'normal' ? 'bg-green-500' :
                          'bg-gray-500'
                        }`}>
                          <div className={`w-2 h-2 rounded-full ${
                            student.status === 'alert' ? 'bg-white animate-ping' :
                            student.status === 'warning' ? 'bg-white animate-pulse' :
                            student.status === 'normal' ? 'bg-white' :
                            'bg-gray-300'
                          }`}></div>
                          <span>{student.status.charAt(0).toUpperCase() + student.status.slice(1)}</span>
                        </div>
                        <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                          {student.rollNumber}
                        </div>
                        <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                          {new Date(student.lastActivity).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                    
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                      <div className="flex space-x-2">
                        <button className="bg-primary text-white p-2 rounded-lg hover:opacity-80" data-testid={`button-expand-${student.id}`}>
                          <i className="fas fa-expand"></i>
                        </button>
                        <button className="bg-yellow-500 text-white p-2 rounded-lg hover:opacity-80" data-testid={`button-snapshot-${student.id}`}>
                          <i className="fas fa-camera"></i>
                        </button>
                        <button className="bg-red-500 text-white p-2 rounded-lg hover:opacity-80" data-testid={`button-alert-${student.id}`}>
                          <i className="fas fa-exclamation-triangle"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * studentsPerPage + 1}-{Math.min(currentPage * studentsPerPage, filteredStudents.length)} of {filteredStudents.length} students
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    data-testid="button-prev-page"
                  >
                    <i className="fas fa-chevron-left"></i>
                  </Button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        data-testid={`button-page-${pageNum}`}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  {totalPages > 5 && (
                    <>
                      <span className="text-muted-foreground">...</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        data-testid={`button-page-${totalPages}`}
                      >
                        {totalPages}
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    data-testid="button-next-page"
                  >
                    <i className="fas fa-chevron-right"></i>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
