import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import type { HallTicket } from "@shared/schema";
import jsPDF from "jspdf";

export default function HallTicketGeneration() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  const [formData, setFormData] = useState({
    examName: "",
    examDate: "",
    duration: 180,
    totalQuestions: 50,
    rollNumber: "",
    studentName: "",
    studentEmail: "",
  });
  const [selectedTicket, setSelectedTicket] = useState<HallTicket | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Fetch existing hall tickets
  const { data: hallTickets = [], isLoading } = useQuery<HallTicket[]>({
    queryKey: ["/api/hall-tickets"],
  });

  // Create hall ticket mutation
  const createHallTicketMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/hall-tickets", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Hall ticket created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hall-tickets"] });
      // Reset form
      setFormData({
        examName: "",
        examDate: "",
        duration: 180,
        totalQuestions: 50,
        rollNumber: "",
        studentName: "",
        studentEmail: "",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete hall ticket mutation
  const deleteHallTicketMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/hall-tickets/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Hall ticket deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hall-tickets"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createHallTicketMutation.mutate(formData);
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleViewDetails = (ticket: HallTicket) => {
    setSelectedTicket(ticket);
    setShowDetailsModal(true);
  };

  const handleDownloadPDF = async (ticket: HallTicket) => {
    try {
      // Generate PDF for hall ticket
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size for A4 paper (595x842 points)
      canvas.width = 595;
      canvas.height = 842;

      // Fill background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add header
      ctx.fillStyle = '#1e40af';
      ctx.fillRect(0, 0, canvas.width, 80);

      // Add title
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('HALL TICKET', canvas.width / 2, 35);
      ctx.font = 'normal 14px Arial';
      ctx.fillText('University Examination', canvas.width / 2, 55);

      // Add content
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'left';
      ctx.font = 'bold 16px Arial';
      
      let y = 140;
      const lineHeight = 30;

      // Student details
      ctx.fillText(`Hall Ticket ID: ${ticket.hallTicketId}`, 50, y);
      y += lineHeight;
      ctx.fillText(`Student Name: ${ticket.studentName}`, 50, y);
      y += lineHeight;
      ctx.fillText(`Roll Number: ${ticket.rollNumber}`, 50, y);
      y += lineHeight;
      ctx.fillText(`Email: ${ticket.studentEmail}`, 50, y);
      y += lineHeight;
      ctx.fillText(`Exam: ${ticket.examName}`, 50, y);
      y += lineHeight;
      ctx.fillText(`Date: ${new Date(ticket.examDate).toLocaleDateString()}`, 50, y);
      y += lineHeight;
      ctx.fillText(`Duration: ${ticket.duration} minutes`, 50, y);
      y += lineHeight;
      ctx.fillText(`Questions: ${ticket.totalQuestions}`, 50, y);

      // Add QR code section
      y += 60;
      ctx.fillText('QR Code for Authentication:', 50, y);
      y += 40;

      // Generate QR code
      const qrResponse = await fetch(`/api/hall-tickets/${ticket.id}/qr`);
      const qrData = await qrResponse.json();
      
      if (qrData.qrCodeUrl) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 50, y, 200, 200);
          
          // Instructions
          ctx.font = 'normal 12px Arial';
          ctx.fillText('1. Scan this QR code during exam authentication', 50, y + 230);
          ctx.fillText('2. Keep this hall ticket safe and bring it to the exam', 50, y + 250);
          ctx.fillText('3. Arrive 30 minutes before the exam time', 50, y + 270);
          
          // Create PDF with jsPDF
          const pdf = new jsPDF();
          
          // Add the canvas as image to PDF
          pdf.addImage(canvas, 'PNG', 0, 0, 210, 297); // A4 size in mm
          
          // Save as PDF
          pdf.save(`hall-ticket-${ticket.hallTicketId}.pdf`);

          toast({
            title: "Download Complete",
            description: `Hall ticket for ${ticket.studentName} downloaded successfully`,
          });
        };
        img.src = qrData.qrCodeUrl;
      }
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to generate hall ticket PDF",
        variant: "destructive",
      });
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
    <div className="min-h-screen bg-gradient-primary">
      {/* Header */}
      <div className="glass-header px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <i className="fas fa-graduation-cap text-white text-2xl"></i>
            <h1 className="text-2xl font-bold text-white">SecureExam - Admin Portal</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-white text-sm">
              <span className="opacity-75">Admin:</span> {user?.firstName || user?.email}
            </div>
            <Button
              variant="secondary"
              onClick={() => window.location.href = "/api/logout"}
              data-testid="button-logout"
            >
              <i className="fas fa-sign-out-alt mr-2"></i>Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Back Button */}
      <div className="fixed top-20 left-4 z-10">
        <Button 
          variant="outline" 
          onClick={() => setLocation("/admin/dashboard")} 
          className="bg-white/10 border-white/20 text-white hover:bg-white/20"
          data-testid="button-back"
        >
          <i className="fas fa-arrow-left mr-2"></i>
          Back
        </Button>
      </div>
      
      <div className="max-w-6xl mx-auto p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Hall Ticket Generation Form */}
          <div className="lg:col-span-2">
            <Card className="shadow-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl">Generate Hall Tickets</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Link href="/admin/draft-bin">
                      <Button variant="outline" data-testid="button-draft-bin">
                        <i className="fas fa-folder-open mr-2"></i>Draft Bin
                      </Button>
                    </Link>
                    <Button variant="outline" data-testid="button-bulk-export">
                      <i className="fas fa-download mr-2"></i>Bulk Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="examName">Exam Details</Label>
                      <Input
                        id="examName"
                        placeholder="Computer Science Final"
                        value={formData.examName}
                        onChange={(e) => handleInputChange("examName", e.target.value)}
                        required
                        data-testid="input-exam-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="examDate">Exam Date</Label>
                      <Input
                        id="examDate"
                        type="date"
                        value={formData.examDate}
                        onChange={(e) => handleInputChange("examDate", e.target.value)}
                        required
                        data-testid="input-exam-date"
                      />
                    </div>
                    <div>
                      <Label htmlFor="duration">Duration (minutes)</Label>
                      <Input
                        id="duration"
                        type="number"
                        value={formData.duration}
                        onChange={(e) => handleInputChange("duration", parseInt(e.target.value))}
                        required
                        data-testid="input-duration"
                      />
                    </div>
                    <div>
                      <Label htmlFor="totalQuestions">Total Questions</Label>
                      <Input
                        id="totalQuestions"
                        type="number"
                        value={formData.totalQuestions}
                        onChange={(e) => handleInputChange("totalQuestions", parseInt(e.target.value))}
                        required
                        data-testid="input-total-questions"
                      />
                    </div>
                    <div>
                      <Label htmlFor="rollNumber">Roll Number</Label>
                      <Input
                        id="rollNumber"
                        placeholder="CS21B1234"
                        value={formData.rollNumber}
                        onChange={(e) => handleInputChange("rollNumber", e.target.value)}
                        required
                        data-testid="input-roll-number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="studentName">Student Name</Label>
                      <Input
                        id="studentName"
                        placeholder="John Smith"
                        value={formData.studentName}
                        onChange={(e) => handleInputChange("studentName", e.target.value)}
                        required
                        data-testid="input-student-name"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="studentEmail">Student Email</Label>
                      <Input
                        id="studentEmail"
                        type="email"
                        placeholder="john.smith@university.edu"
                        value={formData.studentEmail}
                        onChange={(e) => handleInputChange("studentEmail", e.target.value)}
                        required
                        data-testid="input-student-email"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-4">
                    <Button type="button" variant="outline" data-testid="button-save-draft">
                      Save Draft
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createHallTicketMutation.isPending}
                      data-testid="button-generate"
                    >
                      {createHallTicketMutation.isPending ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                          Generating...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-qrcode mr-2"></i>Generate Hall Ticket
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Preview Panel */}
          <div>
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle>Hall Ticket Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-6 rounded-lg border-2 border-dashed border-primary">
                  <div className="text-center mb-4">
                    <h4 className="font-bold text-lg">UNIVERSITY EXAMINATION</h4>
                    <p className="text-sm text-muted-foreground">{formData.examName || "Exam Name"}</p>
                  </div>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Roll Number:</span>
                      <span className="font-medium">{formData.rollNumber || "CS21B1234"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Student Name:</span>
                      <span className="font-medium">{formData.studentName || "Student Name"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date & Time:</span>
                      <span className="font-medium">{formData.examDate || "Date"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration:</span>
                      <span className="font-medium">{formData.duration} minutes</span>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-center">
                    <div className="qr-scanner">
                      <div className="text-center">
                        <div className="grid grid-cols-8 gap-1 mb-2">
                          {Array.from({ length: 16 }).map((_, i) => (
                            <div 
                              key={i} 
                              className={`w-3 h-3 ${Math.random() > 0.5 ? 'bg-foreground' : 'bg-muted'}`} 
                            />
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">Scan to verify</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-muted-foreground text-center">
                    Hall Ticket ID: Will be generated
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Hall Tickets */}
            <Card className="shadow-xl mt-6">
              <CardHeader>
                <CardTitle>Recent Hall Tickets</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Loading...</p>
                  </div>
                ) : hallTickets.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No hall tickets created yet</p>
                ) : (
                  <div className="space-y-3">
                    {hallTickets.slice(0, 5).map((ticket: HallTicket) => (
                      <div key={ticket.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <div className="font-medium text-sm">{ticket.hallTicketId}</div>
                          <div className="text-xs text-muted-foreground">{ticket.studentName} ({ticket.rollNumber})</div>
                          <div className="text-xs text-muted-foreground">{ticket.examName} • {new Date(ticket.examDate).toLocaleDateString()}</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button size="sm" variant="outline" onClick={() => handleViewDetails(ticket)} data-testid={`button-view-details-${ticket.id}`}>
                            <i className="fas fa-eye mr-1"></i>View
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDownloadPDF(ticket)} data-testid={`button-download-${ticket.id}`}>
                            <i className="fas fa-download mr-1"></i>PDF
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            onClick={() => deleteHallTicketMutation.mutate(ticket.id)} 
                            data-testid={`button-delete-${ticket.id}`}
                          >
                            <i className="fas fa-trash mr-1"></i>Delete
                          </Button>
                          <div className="status-indicator status-online"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Detailed View Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Hall Ticket Details</DialogTitle>
          </DialogHeader>
          
          {selectedTicket && (
            <div className="space-y-6">
              {/* Student Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Student Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Hall Ticket ID</Label>
                      <p className="font-mono text-sm">{selectedTicket.hallTicketId}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Roll Number</Label>
                      <p className="text-sm">{selectedTicket.rollNumber}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Student Name</Label>
                      <p className="text-sm">{selectedTicket.studentName}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                      <p className="text-sm">{selectedTicket.studentEmail}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Exam Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Exam Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Exam Name</Label>
                      <p className="text-sm">{selectedTicket.examName}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Date</Label>
                      <p className="text-sm">{new Date(selectedTicket.examDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Duration</Label>
                      <p className="text-sm">{selectedTicket.duration} minutes</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Total Questions</Label>
                      <p className="text-sm">{selectedTicket.totalQuestions}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                      <p className="text-sm">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          selectedTicket.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {selectedTicket.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Created</Label>
                      <p className="text-sm">{selectedTicket.createdAt ? new Date(selectedTicket.createdAt).toLocaleDateString() : 'N/A'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
                  Close
                </Button>
                <Button onClick={() => handleDownloadPDF(selectedTicket)}>
                  <i className="fas fa-download mr-2"></i>Download PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
