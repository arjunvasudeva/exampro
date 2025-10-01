import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Award, Clock, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { generateExamReport } from "@/lib/exam-utils";
import type { ExamSession, Question } from "@shared/schema";

export default function Results() {
  const { user } = useAuth();

  // Fetch completed exam sessions
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<ExamSession[]>({
    queryKey: ["/api/exam-sessions"],
  });

  // Fetch all questions
  const { data: questions = [], isLoading: questionsLoading } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
  });

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600 dark:text-gray-300">Access denied. Admin privileges required.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const completedSessions = sessions.filter((session: any) => session.status === "completed");

  const getResultsForSession = (session: any) => {
    // Filter questions based on hall ticket data or use all questions
    const sessionQuestions = questions.length > 0 ? questions : [];
    
    // Bypass strict typing for now - focus on functionality
    return generateExamReport(session as any, sessionQuestions);
  };

  const exportResults = () => {
    const csvContent = [
      ["Student ID", "Exam Name", "Score", "Correct Answers", "Total Questions", "Time Spent (minutes)", "Status"].join(","),
      ...completedSessions.map((session: any) => {
        const results = getResultsForSession(session);
        return [
          `${session.studentName || ''} ${session.studentLastName || ''}`.trim() || session.studentId,
          "Exam", // Default exam name since examName doesn't exist in schema
          `${results.score}%`,
          results.correctAnswers,
          results.totalQuestions,
          Math.round(results.timeSpent / 60000),
          session.status
        ].join(",");
      })
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exam-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (sessionsLoading || questionsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading results...</p>
        </div>
      </div>
    );
  }

  const averageScore = completedSessions.length > 0 
    ? Math.round(completedSessions.reduce((sum: number, session: any) => {
        const results = getResultsForSession(session);
        return sum + results.score;
      }, 0) / completedSessions.length)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Exam Results</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">View and analyze student exam performance</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/dashboard">
              <Button variant="outline" data-testid="button-dashboard">
                Dashboard
              </Button>
            </Link>
            {completedSessions.length > 0 && (
              <Button onClick={exportResults} data-testid="button-export-results">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            )}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Exams</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-completed-count">
                {completedSessions.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <Award className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600" data-testid="text-average-score">
                {averageScore}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Clock className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600" data-testid="text-total-students">
                {new Set(completedSessions.map((s: any) => s.studentId)).size}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results List */}
        <Card>
          <CardHeader>
            <CardTitle>Student Results</CardTitle>
          </CardHeader>
          <CardContent>
            {completedSessions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-300">No completed exams yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {completedSessions.map((session: any) => {
                  const results = getResultsForSession(session);
                  const getScoreColor = (score: number) => {
                    if (score >= 80) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
                    if (score >= 60) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100";
                    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100";
                  };

                  return (
                    <div key={session.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-4 mb-2">
                            <h3 className="font-semibold text-gray-900 dark:text-white" data-testid={`text-student-${session.studentId}`}>
                              Student: {session.studentName} {session.studentLastName || ''} 
                              {!session.studentName && `ID: ${session.studentId}`}
                            </h3>
                            <Badge variant="outline">
                              Exam Session
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 dark:text-gray-300">
                            <div>
                              <span className="font-medium">Score:</span>
                              <Badge className={getScoreColor(results.score)} data-testid={`text-score-${session.studentId}`}>
                                {results.score}%
                              </Badge>
                            </div>
                            <div>
                              <span className="font-medium">Correct:</span>
                              <span className="ml-1">{results.correctAnswers}/{results.totalQuestions}</span>
                            </div>
                            <div>
                              <span className="font-medium">Time:</span>
                              <span className="ml-1">{Math.round(results.timeSpent / 60000)}m</span>
                            </div>
                            <div>
                              <span className="font-medium">Completed:</span>
                              <span className="ml-1">{session.endTime ? new Date(session.endTime).toLocaleDateString() : "N/A"}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}