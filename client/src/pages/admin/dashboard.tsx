import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useEffect, useState } from "react";
import type { SecurityIncident, ExamSession } from "@shared/schema";

interface ExamStats {
  activeStudents: number;
  totalSessions: number;
  securityAlerts: number;
  averageProgress: number;
}

interface StudentStatus {
  id: string;
  name: string;
  rollNumber: string;
  status: 'online' | 'offline' | 'warning' | 'alert';
  progress: number;
  timeRemaining: string;
  lastActivity: string;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [realTimeAlerts, setRealTimeAlerts] = useState<SecurityIncident[]>([]);
  const [studentStatuses, setStudentStatuses] = useState<StudentStatus[]>([]);

  // WebSocket connection for real-time updates
  const { sendMessage, lastMessage } = useWebSocket();

  // Fetch exam statistics
  const { data: examStats, isLoading: statsLoading } = useQuery<ExamStats>({
    queryKey: ["/api/exam-stats"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch active sessions
  const { data: activeSessions = [], isLoading: sessionsLoading } = useQuery<ExamSession[]>({
    queryKey: ["/api/active-sessions"],
    refetchInterval: 3000, // Refresh every 3 seconds
  });

  // Fetch recent security incidents
  const { data: securityIncidents = [], isLoading: incidentsLoading } = useQuery<SecurityIncident[]>({
    queryKey: ["/api/security-incidents"],
    refetchInterval: 2000, // Refresh every 2 seconds
  });

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      try {
        const message = JSON.parse(lastMessage.data);
        
        if (message.type === 'security_incident') {
          setRealTimeAlerts(prev => [message.data, ...prev.slice(0, 4)]);
          toast({
            title: "Security Alert",
            description: `${message.data.studentName}: ${message.data.description}`,
            variant: "destructive",
          });
        } else if (message.type === 'student_status') {
          setStudentStatuses(prev => {
            const updated = [...prev];
            const index = updated.findIndex(s => s.id === message.data.studentId);
            if (index !== -1) {
              updated[index] = { ...updated[index], ...message.data };
            } else {
              updated.push(message.data);
            }
            return updated.slice(0, 8); // Keep only latest 8 students
          });
        }
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    }
  }, [lastMessage, toast]);

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

  const formatTimeRemaining = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'status-online';
      case 'warning': return 'status-warning';
      case 'alert': return 'status-danger';
      default: return 'status-offline';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-50';
      case 'high': return 'border-orange-500 bg-orange-50';
      case 'medium': return 'border-yellow-500 bg-yellow-50';
      default: return 'border-blue-500 bg-blue-50';
    }
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
      {/* Admin Header */}
      <div className="glass-header px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <i className="fas fa-graduation-cap text-primary text-2xl"></i>
            <div>
              <h1 className="text-xl font-bold text-foreground">SecureExam Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">Real-time monitoring and control</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="status-indicator status-online"></div>
              <span className="text-sm text-muted-foreground">System Online</span>
            </div>
            <Link href="/admin/monitoring">
              <Button className="bg-primary text-primary-foreground" data-testid="button-monitoring">
                <i className="fas fa-tv mr-2"></i>Live Monitoring
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Active Students</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="stat-active-students">
                    {statsLoading ? '...' : examStats?.activeStudents || 0}
                  </p>
                </div>
                <div className="bg-green-100 p-3 rounded-lg">
                  <i className="fas fa-users text-green-600 text-xl"></i>
                </div>
              </div>
              <div className="flex items-center mt-2">
                <i className="fas fa-arrow-up text-green-500 text-xs mr-1"></i>
                <span className="text-green-600 text-xs">Active now</span>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Security Alerts</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="stat-security-alerts">
                    {statsLoading ? '...' : examStats?.securityAlerts || 0}
                  </p>
                </div>
                <div className="bg-yellow-100 p-3 rounded-lg">
                  <i className="fas fa-exclamation-triangle text-yellow-600 text-xl"></i>
                </div>
              </div>
              <div className="flex items-center mt-2">
                <i className="fas fa-clock text-muted-foreground text-xs mr-1"></i>
                <span className="text-muted-foreground text-xs">{realTimeAlerts.length} recent</span>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Avg Progress</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="stat-avg-progress">
                    {statsLoading ? '...' : `${examStats?.averageProgress || 0}%`}
                  </p>
                </div>
                <div className="bg-blue-100 p-3 rounded-lg">
                  <i className="fas fa-chart-line text-blue-600 text-xl"></i>
                </div>
              </div>
              <div className="flex items-center mt-2">
                <div className="w-16 bg-muted rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full" 
                    style={{ width: `${examStats?.averageProgress || 0}%` }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Total Sessions</p>
                  <p className="text-2xl font-bold text-foreground font-mono" data-testid="stat-total-sessions">
                    {statsLoading ? '...' : examStats?.totalSessions || 0}
                  </p>
                </div>
                <div className="bg-purple-100 p-3 rounded-lg">
                  <i className="fas fa-desktop text-purple-600 text-xl"></i>
                </div>
              </div>
              <div className="flex items-center mt-2">
                <span className="text-muted-foreground text-xs">All time</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live Student Monitoring */}
          <div className="lg:col-span-2">
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <i className="fas fa-video text-primary"></i>
                    <span>Live Student Monitoring</span>
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" data-testid="button-filter">
                      <i className="fas fa-filter mr-1"></i>Filter
                    </Button>
                    <Link href="/admin/monitoring">
                      <Button size="sm" className="bg-primary text-primary-foreground" data-testid="button-full-view">
                        <i className="fas fa-expand mr-1"></i>Full View
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {sessionsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading active sessions...</p>
                  </div>
                ) : activeSessions.length === 0 ? (
                  <div className="text-center py-8">
                    <i className="fas fa-users text-muted-foreground text-4xl mb-4"></i>
                    <p className="text-muted-foreground">No active exam sessions</p>
                  </div>
                ) : (
                  <div className="data-grid">
                    {activeSessions.slice(0, 6).map((session) => (
                      <div key={session.id} className="bg-muted rounded-lg p-4" data-testid={`student-card-${session.id}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center text-white text-sm font-medium">
                              {session.studentId?.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-sm">Student {session.studentId}</p>
                              <p className="text-xs text-muted-foreground">Session {session.id.slice(-6)}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1">
                            <div className={`status-indicator ${getStatusColor(session.status)}`}></div>
                            <span className="text-xs text-muted-foreground capitalize">{session.status}</span>
                          </div>
                        </div>
                        
                        <div className="video-feed bg-gray-800 rounded-lg mb-3" style={{ height: '120px' }}>
                          <div className="w-full h-full flex items-center justify-center text-white">
                            <i className="fas fa-video text-lg"></i>
                          </div>
                          <div className="video-overlay">Face: ✓</div>
                        </div>
                        
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Progress: {session.currentQuestion || 1}/50</span>
                          <span>Time: {formatTimeRemaining(session.timeRemaining || 0)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Alert & Activity Panel */}
          <div className="space-y-6">
            {/* Recent Alerts */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <i className="fas fa-exclamation-triangle text-yellow-500"></i>
                  <span>Recent Alerts</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {incidentsLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                    <p className="text-xs text-muted-foreground">Loading alerts...</p>
                  </div>
                ) : (realTimeAlerts.length > 0 ? realTimeAlerts : securityIncidents.slice(0, 3)).map((incident, index) => (
                  <div key={incident.id || index} className={`flex items-start space-x-3 p-3 rounded-lg mb-3 border ${getSeverityColor(incident.severity)}`}>
                    <i className={`fas ${
                      incident.incidentType === 'multiple_faces' ? 'fa-exclamation-circle' :
                      incident.incidentType === 'looking_away' ? 'fa-eye-slash' :
                      incident.incidentType === 'network_disconnect' ? 'fa-wifi' :
                      'fa-exclamation-triangle'
                    } text-${incident.severity === 'critical' ? 'red' : incident.severity === 'high' ? 'orange' : 'yellow'}-500 mt-0.5`}></i>
                    <div className="flex-1">
                      <p className={`text-sm font-medium text-${incident.severity === 'critical' ? 'red' : incident.severity === 'high' ? 'orange' : 'yellow'}-800`}>
                        {incident.description}
                      </p>
                      <p className={`text-xs text-${incident.severity === 'critical' ? 'red' : incident.severity === 'high' ? 'orange' : 'yellow'}-600`}>
                        {incident.incidentType.replace('_', ' ')} incident
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(incident.createdAt || '').toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                
                {!incidentsLoading && securityIncidents.length === 0 && realTimeAlerts.length === 0 && (
                  <div className="text-center py-4">
                    <i className="fas fa-shield-alt text-green-500 text-2xl mb-2"></i>
                    <p className="text-sm text-green-600">No security alerts</p>
                    <p className="text-xs text-muted-foreground">System is secure</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* System Status */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <i className="fas fa-heartbeat text-green-500"></i>
                  <span>System Status</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">AI Monitoring</span>
                    <div className="flex items-center space-x-2">
                      <div className="status-indicator status-online"></div>
                      <span className="text-sm text-green-600">Active</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">WebSocket Connection</span>
                    <div className="flex items-center space-x-2">
                      <div className="status-indicator status-online"></div>
                      <span className="text-sm text-green-600">Connected</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Database</span>
                    <div className="flex items-center space-x-2">
                      <div className="status-indicator status-online"></div>
                      <span className="text-sm text-green-600">Operational</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Storage</span>
                    <div className="flex items-center space-x-2">
                      <div className="status-indicator status-warning"></div>
                      <span className="text-sm text-yellow-600">78% Full</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <i className="fas fa-bolt text-primary"></i>
                  <span>Quick Actions</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button className="w-full bg-primary text-primary-foreground" data-testid="button-broadcast">
                    <i className="fas fa-broadcast-tower mr-2"></i>Send Broadcast Message
                  </Button>
                  <Button variant="outline" className="w-full text-yellow-600 border-yellow-300 hover:bg-yellow-50" data-testid="button-pause-all">
                    <i className="fas fa-pause mr-2"></i>Pause All Exams
                  </Button>
                  <Link href="/admin/incidents">
                    <Button variant="outline" className="w-full" data-testid="button-incidents">
                      <i className="fas fa-shield-alt mr-2"></i>View All Incidents
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
