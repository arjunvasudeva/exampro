import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import QRScanner from "@/components/qr-scanner";
import { useLocation } from "wouter";

export default function StudentAuthentication() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [scanMode, setScanMode] = useState(true);
  const [manualData, setManualData] = useState({
    hallTicketId: "",
    rollNumber: "",
  });

  // Verify hall ticket mutation
  const verifyHallTicketMutation = useMutation({
    mutationFn: async (data: { qrData?: string; rollNumber: string; hallTicketId?: string }) => {
      const response = await apiRequest("POST", "/api/auth/verify-hall-ticket", data);
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Success",
        description: "Hall ticket verified successfully",
      });
      // Store hall ticket data and navigate to verification
      localStorage.setItem("hallTicketData", JSON.stringify(result.hallTicket));
      setLocation("/student/identity-verification");
    },
    onError: (error) => {
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleQRScan = (qrData: string) => {
    try {
      const parsed = JSON.parse(qrData);
      verifyHallTicketMutation.mutate({
        qrData,
        rollNumber: parsed.rollNumber,
      });
    } catch (error) {
      toast({
        title: "Invalid QR Code",
        description: "Please scan a valid hall ticket QR code",
        variant: "destructive",
      });
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!manualData.hallTicketId || !manualData.rollNumber) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // For manual entry, send hall ticket ID and roll number directly
    verifyHallTicketMutation.mutate({
      rollNumber: manualData.rollNumber,
      hallTicketId: manualData.hallTicketId,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-primary flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-2xl">
        <CardHeader className="text-center">
          <div className="w-20 h-20 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-user-graduate text-2xl text-white"></i>
          </div>
          <CardTitle className="text-2xl">Student Authentication</CardTitle>
          <p className="text-muted-foreground">
            {scanMode ? "Scan your hall ticket QR code to proceed" : "Enter your hall ticket details manually"}
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Mode Toggle */}
          <div className="flex bg-muted rounded-lg p-1">
            <button
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                scanMode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
              onClick={() => setScanMode(true)}
              data-testid="button-scan-mode"
            >
              <i className="fas fa-qrcode mr-2"></i>QR Scan
            </button>
            <button
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                !scanMode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
              onClick={() => setScanMode(false)}
              data-testid="button-manual-mode"
            >
              <i className="fas fa-keyboard mr-2"></i>Manual Entry
            </button>
          </div>

          {scanMode ? (
            /* QR Scanner Section */
            <div className="space-y-4">
              <QRScanner onScan={handleQRScan} />
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Click "Start QR Scanner" below, then hold your hall ticket QR code in front of the camera
                </p>
              </div>
            </div>
          ) : (
            /* Manual Entry Form */
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <Label htmlFor="hallTicketId">Hall Ticket ID</Label>
                <Input
                  id="hallTicketId"
                  placeholder="HT2024CS001234"
                  value={manualData.hallTicketId}
                  onChange={(e) => setManualData(prev => ({ ...prev, hallTicketId: e.target.value.toUpperCase() }))}
                  required
                  data-testid="input-hall-ticket-id"
                />
              </div>
              <div>
                <Label htmlFor="rollNumber">Roll Number</Label>
                <Input
                  id="rollNumber"
                  placeholder="CS21B1234"
                  value={manualData.rollNumber}
                  onChange={(e) => setManualData(prev => ({ ...prev, rollNumber: e.target.value.toUpperCase() }))}
                  required
                  data-testid="input-roll-number"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={verifyHallTicketMutation.isPending}
                data-testid="button-verify"
              >
                {verifyHallTicketMutation.isPending ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Verifying...
                  </>
                ) : (
                  <>
                    <i className="fas fa-sign-in-alt mr-2"></i>Proceed to Verification
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Status Display */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center space-x-3">
              <div className={`status-indicator ${
                verifyHallTicketMutation.isPending ? 'status-warning' : 'status-offline'
              }`}></div>
              <span className="text-sm text-muted-foreground">
                {verifyHallTicketMutation.isPending 
                  ? 'Verifying hall ticket...' 
                  : 'Waiting for hall ticket scan...'
                }
              </span>
            </div>
          </div>

          {/* Help Text */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Need help? Contact your exam coordinator or IT support
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
