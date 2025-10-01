import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Archive, RotateCcw, Trash2, Eye, Calendar, Clock, User } from "lucide-react";
import type { HallTicket } from "@shared/schema";

export default function DraftBin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<HallTicket | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Fetch all hall tickets (we'll filter inactive/submitted ones for draft bin)
  const { data: allHallTickets = [], isLoading } = useQuery<HallTicket[]>({
    queryKey: ["/api/hall-tickets"],
  });

  // Filter for submitted/inactive hall tickets that could be in draft bin
  const draftTickets = allHallTickets.filter(ticket => !ticket.isActive);

  // Restore hall ticket mutation (make it active again)
  const restoreTicketMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("PATCH", `/api/hall-tickets/${id}`, {
        isActive: true,
        updatedAt: new Date().toISOString()
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Hall ticket restored successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hall-tickets"] });
      setShowRestoreModal(false);
      setSelectedTicket(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete hall ticket permanently
  const deleteTicketMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/hall-tickets/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Hall ticket deleted permanently",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hall-tickets"] });
      setShowDeleteModal(false);
      setSelectedTicket(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleViewDetails = (ticket: HallTicket) => {
    setSelectedTicket(ticket);
    setShowDetailsModal(true);
  };

  const handleRestore = (ticket: HallTicket) => {
    setSelectedTicket(ticket);
    setShowRestoreModal(true);
  };

  const handleDelete = (ticket: HallTicket) => {
    setSelectedTicket(ticket);
    setShowDeleteModal(true);
  };

  const getTicketStatus = (ticket: HallTicket) => {
    if (!ticket.isActive) {
      return { label: "Inactive", variant: "secondary" as const };
    }
    return { label: "Active", variant: "default" as const };
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Archive className="h-8 w-8 text-purple-600" />
              Draft Bin
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Manage submitted and inactive hall tickets
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/hall-ticket-generation">
              <Button variant="outline" data-testid="button-hall-tickets">
                <Archive className="w-4 h-4 mr-2" />
                Hall Tickets
              </Button>
            </Link>
            <Link href="/admin/dashboard">
              <Button variant="outline" data-testid="button-dashboard">
                Dashboard
              </Button>
            </Link>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Draft Tickets</CardTitle>
              <Archive className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600" data-testid="text-draft-count">
                {draftTickets.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
              <Archive className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600" data-testid="text-total-count">
                {allHallTickets.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Tickets</CardTitle>
              <Archive className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-active-count">
                {allHallTickets.filter(t => t.isActive).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Draft Tickets List */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Inactive Hall Tickets</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/hall-tickets"] })}
                data-testid="button-refresh"
              >
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-300">Loading draft tickets...</p>
              </div>
            ) : draftTickets.length === 0 ? (
              <div className="text-center py-8">
                <Archive className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">No Draft Tickets</h3>
                <p className="text-gray-500">All hall tickets are currently active</p>
              </div>
            ) : (
              <div className="space-y-4">
                {draftTickets.map((ticket) => {
                  const status = getTicketStatus(ticket);
                  return (
                    <div key={ticket.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-gray-900 dark:text-white" data-testid={`text-ticket-${ticket.hallTicketId}`}>
                              {ticket.hallTicketId}
                            </h3>
                            <Badge variant={status.variant}>
                              {status.label}
                            </Badge>
                            <Badge variant="outline">
                              {ticket.examName}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-600 dark:text-gray-300">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <span>{ticket.studentName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Roll:</span>
                              <span>{ticket.rollNumber}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              <span>{new Date(ticket.examDate).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              <span>{ticket.duration} min</span>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-gray-500">
                            Created: {new Date(ticket.createdAt || '').toLocaleString()}
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(ticket)}
                            data-testid={`button-view-${ticket.hallTicketId}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600 border-green-300"
                            onClick={() => handleRestore(ticket)}
                            data-testid={`button-restore-${ticket.hallTicketId}`}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-300"
                            onClick={() => handleDelete(ticket)}
                            data-testid={`button-delete-${ticket.hallTicketId}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      {/* Details Modal */}
      {showDetailsModal && selectedTicket && (
        <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Hall Ticket Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Hall Ticket ID</Label>
                  <p className="text-gray-900 dark:text-white">{selectedTicket.hallTicketId}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Status</Label>
                  <Badge variant={getTicketStatus(selectedTicket).variant} className="ml-2">
                    {getTicketStatus(selectedTicket).label}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Student Name</Label>
                  <p className="text-gray-900 dark:text-white">{selectedTicket.studentName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Roll Number</Label>
                  <p className="text-gray-900 dark:text-white">{selectedTicket.rollNumber}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Email</Label>
                  <p className="text-gray-900 dark:text-white">{selectedTicket.studentEmail}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Exam Name</Label>
                  <p className="text-gray-900 dark:text-white">{selectedTicket.examName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Exam Date</Label>
                  <p className="text-gray-900 dark:text-white">
                    {new Date(selectedTicket.examDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Duration</Label>
                  <p className="text-gray-900 dark:text-white">{selectedTicket.duration} minutes</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Total Questions</Label>
                  <p className="text-gray-900 dark:text-white">{selectedTicket.totalQuestions}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Created</Label>
                  <p className="text-gray-900 dark:text-white">
                    {new Date(selectedTicket.createdAt || '').toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Restore Confirmation Modal */}
      {showRestoreModal && selectedTicket && (
        <Dialog open={showRestoreModal} onOpenChange={setShowRestoreModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Restore Hall Ticket</DialogTitle>
            </DialogHeader>
            <p className="text-gray-600 dark:text-gray-300">
              Are you sure you want to restore hall ticket <strong>{selectedTicket.hallTicketId}</strong>? 
              This will make it active and available for use again.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRestoreModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => restoreTicketMutation.mutate(selectedTicket.id)}
                disabled={restoreTicketMutation.isPending}
                data-testid="button-confirm-restore"
              >
                {restoreTicketMutation.isPending ? "Restoring..." : "Restore"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedTicket && (
        <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Hall Ticket</DialogTitle>
            </DialogHeader>
            <p className="text-gray-600 dark:text-gray-300">
              Are you sure you want to permanently delete hall ticket <strong>{selectedTicket.hallTicketId}</strong>? 
              This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteTicketMutation.mutate(selectedTicket.id)}
                disabled={deleteTicketMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteTicketMutation.isPending ? "Deleting..." : "Delete Permanently"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}