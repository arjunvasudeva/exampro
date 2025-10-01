import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function ExamComplete() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Clean up any remaining fullscreen or exam state
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(console.error);
    }
  }, []);

  const handleGoHome = () => {
    // Clean up any remaining exam data
    localStorage.removeItem("hallTicketData");
    localStorage.removeItem("verificationComplete");
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-indigo-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
            <i className="fas fa-check-circle text-4xl text-green-600 dark:text-green-400"></i>
          </div>
          <CardTitle className="text-3xl font-bold text-green-700 dark:text-green-400">
            Exam Submitted Successfully!
          </CardTitle>
        </CardHeader>
        
        <CardContent className="text-center space-y-6">
          <div className="space-y-3">
            <p className="text-xl text-muted-foreground">
              Thank you for your patience during the examination.
            </p>
            <p className="text-muted-foreground">
              Your answers have been securely submitted and recorded. 
              You will be notified of your results once they are available.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-lg">What happens next?</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Your exam responses are being processed</li>
              <li>• Results will be available within 24-48 hours</li>
              <li>• You will receive notification via email</li>
              <li>• Contact support if you have any concerns</li>
            </ul>
          </div>

          <div className="pt-4">
            <Button 
              onClick={handleGoHome}
              size="lg"
              className="w-full"
              data-testid="button-home"
            >
              <i className="fas fa-home mr-2"></i>
              Return to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}