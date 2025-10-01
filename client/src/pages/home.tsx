import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Home() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="glass-header px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <i className="fas fa-graduation-cap text-primary text-2xl"></i>
            <h1 className="text-2xl font-bold text-foreground">SecureExam</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-muted-foreground">
              Welcome, {user?.firstName || user?.email}
            </div>
            <Button
              variant="outline"
              onClick={() => {
                localStorage.removeItem("auth_token");
                window.location.href = "/";
              }}
              data-testid="button-logout"
            >
              <i className="fas fa-sign-out-alt mr-2"></i>
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">
            {isAdmin ? 'Admin Dashboard' : 'Student Portal'}
          </h2>
          <p className="text-muted-foreground">
            {isAdmin 
              ? 'Manage exams, monitor students, and handle security incidents'
              : 'Access your exams and view your progress'
            }
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isAdmin ? (
            <>
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <i className="fas fa-qrcode text-primary"></i>
                    <span>Hall Ticket Generation</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm mb-4">
                    Create and manage hall tickets with QR codes for student authentication.
                  </p>
                  <Link href="/admin/hall-tickets">
                    <Button className="w-full" data-testid="link-hall-tickets">
                      Generate Tickets
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <i className="fas fa-tachometer-alt text-primary"></i>
                    <span>Live Dashboard</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm mb-4">
                    Monitor active exams, view statistics, and manage ongoing sessions.
                  </p>
                  <Link href="/admin/dashboard">
                    <Button className="w-full" data-testid="link-dashboard">
                      View Dashboard
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <i className="fas fa-video text-primary"></i>
                    <span>Live Monitoring</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm mb-4">
                    Real-time video feeds and AI-powered proctoring system.
                  </p>
                  <Link href="/admin/monitoring">
                    <Button className="w-full" data-testid="link-monitoring">
                      Monitor Students
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <i className="fas fa-shield-alt text-primary"></i>
                    <span>Incident Management</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm mb-4">
                    Handle security alerts, view snapshots, and manage violations.
                  </p>
                  <Link href="/admin/incidents">
                    <Button className="w-full" data-testid="link-incidents">
                      View Incidents
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <i className="fas fa-question-circle text-primary"></i>
                    <span>Exam Questions</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm mb-4">
                    Create, import, and manage exam questions for all assessments.
                  </p>
                  <Link href="/admin/questions">
                    <Button className="w-full" data-testid="link-questions">
                      Manage Questions
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <i className="fas fa-chart-bar text-primary"></i>
                    <span>Exam Results</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm mb-4">
                    View student performance, analyze scores, and generate reports.
                  </p>
                  <Link href="/admin/results">
                    <Button className="w-full" data-testid="link-results">
                      View Results
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <i className="fas fa-qrcode text-primary"></i>
                    <span>Hall Ticket Authentication</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm mb-4">
                    Scan your hall ticket QR code to authenticate for exams.
                  </p>
                  <Link href="/student/auth">
                    <Button className="w-full" data-testid="link-auth">
                      Scan Hall Ticket
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <i className="fas fa-id-card text-primary"></i>
                    <span>Identity Verification</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm mb-4">
                    Complete identity verification before starting your exam.
                  </p>
                  <Link href="/student/identity-verification">
                    <Button className="w-full" data-testid="link-verify">
                      Verify Identity
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <i className="fas fa-edit text-primary"></i>
                    <span>Take Exam</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm mb-4">
                    Enter secure exam mode and begin your examination.
                  </p>
                  <Link href="/student/exam">
                    <Button className="w-full" data-testid="link-exam">
                      Start Exam
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* System Status */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <i className="fas fa-heartbeat text-green-500"></i>
              <span>System Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center space-x-2">
                <div className="status-indicator status-online"></div>
                <span className="text-sm">Monitoring System</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="status-indicator status-online"></div>
                <span className="text-sm">AI Proctoring</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="status-indicator status-online"></div>
                <span className="text-sm">Database</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="status-indicator status-online"></div>
                <span className="text-sm">WebSocket Connection</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
