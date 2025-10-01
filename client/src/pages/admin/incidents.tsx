import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { SecurityIncident } from "@shared/schema";

interface IncidentStats {
  critical: number;
  high: number;
  medium: number;
  low: number;
  resolved: number;
}

export default function IncidentManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIncident, setSelectedIncident] = useState<SecurityIncident | null>(null);
  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);

  // Fetch security incidents
  const { data: incidents = [], isLoading } = useQuery<SecurityIncident[]>({
    queryKey: ["/api/security-incidents"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Resolve incident mutation
  const resolveIncidentMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const response = await apiRequest("PATCH", `/api/security-incidents/${id}`, {
        isResolved: true,
        resolvedBy: user?.id,
        // Let the database handle the timestamp - avoid client-side Date object
        resolutionAction: action
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Incident Resolved",
        description: "Security incident has been marked as resolved",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/security-incidents"] });
      setSelectedIncident(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getIncidentStats = (): IncidentStats => {
    return incidents.reduce((stats, incident) => {
      if (incident.isResolved) {
        stats.resolved++;
      } else {
        switch (incident.severity) {
          case 'critical':
            stats.critical++;
            break;
          case 'high':
            stats.high++;
            break;
          case 'medium':
            stats.medium++;
            break;
          case 'low':
            stats.low++;
            break;
        }
      }
      return stats;
    }, { critical: 0, high: 0, medium: 0, low: 0, resolved: 0 });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'secondary';
    }
  };

  const getSeverityBorder = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-l-red-500 bg-red-50';
      case 'high': return 'border-l-orange-500 bg-orange-50';
      case 'medium': return 'border-l-yellow-500 bg-yellow-50';
      default: return 'border-l-blue-500 bg-blue-50';
    }
  };

  const getIncidentIcon = (type: string) => {
    switch (type) {
      case 'multiple_faces': return 'fa-exclamation-circle';
      case 'looking_away': return 'fa-eye-slash';
      case 'network_disconnect': return 'fa-wifi';
      case 'fullscreen_exit': return 'fa-expand';
      default: return 'fa-exclamation-triangle';
    }
  };

  const handleResolveIncident = (incident: SecurityIncident, action: string) => {
    resolveIncidentMutation.mutate({ id: incident.id, action });
  };

  const stats = getIncidentStats();
  const activeIncidents = incidents.filter(i => !i.isResolved);

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
      {/* Incident Header */}
      <div className="glass-header px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <i className="fas fa-shield-alt text-red-500 text-2xl"></i>
            <div>
              <h1 className="text-xl font-bold text-foreground">Incident Management System</h1>
              <p className="text-sm text-muted-foreground">Security alerts, snapshots, and audit trail</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
              <i className="fas fa-exclamation-triangle mr-1"></i>{stats.critical + stats.high + stats.medium + stats.low} Active Alerts
            </div>
            <Button variant="destructive" data-testid="button-alert-proctors">
              <i className="fas fa-bell mr-2"></i>Alert All Proctors
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Incidents */}
          <div className="lg:col-span-2">
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Active Security Incidents</CardTitle>
                  <Button variant="outline" size="sm" data-testid="button-export-report">
                    <i className="fas fa-download mr-1"></i>Export Report
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading incidents...</p>
                  </div>
                ) : activeIncidents.length === 0 ? (
                  <div className="text-center py-8">
                    <i className="fas fa-shield-alt text-green-500 text-4xl mb-4"></i>
                    <h3 className="text-lg font-semibold text-green-600 mb-2">No Active Incidents</h3>
                    <p className="text-muted-foreground">All systems are secure and monitoring normally</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeIncidents.map((incident) => (
                      <div key={incident.id} className={`border-l-4 rounded-lg p-4 ${getSeverityBorder(incident.severity)}`} data-testid={`incident-${incident.id}`}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-start space-x-3">
                            <i className={`fas ${getIncidentIcon(incident.incidentType)} text-xl mt-1 ${
                              incident.severity === 'critical' ? 'text-red-500' :
                              incident.severity === 'high' ? 'text-orange-500' :
                              incident.severity === 'medium' ? 'text-yellow-500' :
                              'text-blue-500'
                            }`}></i>
                            <div>
                              <h3 className={`font-semibold ${
                                incident.severity === 'critical' ? 'text-red-800' :
                                incident.severity === 'high' ? 'text-orange-800' :
                                incident.severity === 'medium' ? 'text-yellow-800' :
                                'text-blue-800'
                              }`}>
                                {incident.description}
                              </h3>
                              <p className={`text-sm ${
                                incident.severity === 'critical' ? 'text-red-600' :
                                incident.severity === 'high' ? 'text-orange-600' :
                                incident.severity === 'medium' ? 'text-yellow-600' :
                                'text-blue-600'
                              }`}>
                                {incident.incidentType.replace('_', ' ').toUpperCase()} - {incident.severity.toUpperCase()}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(incident.createdAt || '').toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            {incident.snapshotUrl && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => {
                                  setSelectedIncident(incident);
                                  setSnapshotModalOpen(true);
                                }}
                                data-testid={`button-view-snapshot-${incident.id}`}
                              >
                                <i className="fas fa-camera mr-1"></i>View Snapshot
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-yellow-600 border-yellow-300"
                              onClick={() => handleResolveIncident(incident, 'flagged')}
                              data-testid={`button-flag-${incident.id}`}
                            >
                              <i className="fas fa-flag mr-1"></i>Flag Student
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-green-600 border-green-300"
                              onClick={() => handleResolveIncident(incident, 'resolved')}
                              data-testid={`button-resolve-${incident.id}`}
                            >
                              <i className="fas fa-check mr-1"></i>Resolve
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-white rounded-lg p-3">
                            <h4 className="text-sm font-medium mb-2">Detection Details</h4>
                            <div className="text-xs space-y-1">
                              <div className="flex justify-between">
                                <span>Type:</span>
                                <span className="font-medium capitalize">{incident.incidentType.replace('_', ' ')}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Severity:</span>
                                <Badge variant={getSeverityColor(incident.severity)} className="text-xs">
                                  {incident.severity}
                                </Badge>
                              </div>
                              {incident.metadata && typeof incident.metadata === 'object' && (
                                <>
                                  {(incident.metadata as any).confidence && (
                                    <div className="flex justify-between">
                                      <span>Confidence:</span>
                                      <span className="font-medium">
                                        {Math.round((incident.metadata as any).confidence * 100)}%
                                      </span>
                                    </div>
                                  )}
                                  {(incident.metadata as any).duration && (
                                    <div className="flex justify-between">
                                      <span>Duration:</span>
                                      <span className="font-medium">{(incident.metadata as any).duration}s</span>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-3">
                            <h4 className="text-sm font-medium mb-2">Actions Available</h4>
                            <div className="text-xs space-y-1">
                              <div className="flex items-center space-x-1">
                                <i className="fas fa-camera text-blue-500"></i>
                                <span>Snapshot captured</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <i className="fas fa-bell text-yellow-500"></i>
                                <span>Admin notified</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <i className="fas fa-clock text-gray-500"></i>
                                <span>Awaiting response</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Incident Statistics & Controls */}
          <div className="space-y-6">
            {/* Incident Summary */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Incident Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span className="text-sm">Critical Alerts</span>
                    </div>
                    <span className="font-semibold text-red-600" data-testid="stat-critical">
                      {stats.critical}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                      <span className="text-sm">High Priority</span>
                    </div>
                    <span className="font-semibold text-orange-600" data-testid="stat-high">
                      {stats.high}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <span className="text-sm">Warnings</span>
                    </div>
                    <span className="font-semibold text-yellow-600" data-testid="stat-medium">
                      {stats.medium}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="text-sm">Low Priority</span>
                    </div>
                    <span className="font-semibold text-blue-600" data-testid="stat-low">
                      {stats.low}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm">Resolved Today</span>
                    </div>
                    <span className="font-semibold text-green-600" data-testid="stat-resolved">
                      {stats.resolved}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Snapshot Gallery */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Recent Snapshots</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map((index) => (
                    <div key={index} className="relative group cursor-pointer" data-testid={`snapshot-${index}`}>
                      <div className="aspect-video bg-gray-800 rounded-lg flex items-center justify-center">
                        <i className={`fas ${
                          index === 1 ? 'fa-users text-red-400' :
                          index === 2 ? 'fa-eye-slash text-yellow-400' :
                          index === 3 ? 'fa-user text-green-400' :
                          'fa-mobile-alt text-blue-400'
                        } text-lg`}></i>
                      </div>
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                        <i className="fas fa-search-plus text-white text-lg"></i>
                      </div>
                      <div className={`absolute bottom-1 left-1 px-1 py-0.5 rounded text-xs text-white ${
                        index === 1 ? 'bg-red-500' :
                        index === 2 ? 'bg-yellow-500' :
                        index === 3 ? 'bg-green-500' :
                        'bg-blue-500'
                      }`}>
                        {index === 1 ? 'Critical' :
                         index === 2 ? 'Warning' :
                         index === 3 ? 'Normal' :
                         'Device'}
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full mt-4" data-testid="button-view-all-snapshots">
                  View All Snapshots
                </Button>
              </CardContent>
            </Card>

            {/* Response Actions */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Response Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button variant="destructive" className="w-full" data-testid="button-suspend-student">
                    <i className="fas fa-ban mr-2"></i>Suspend Student
                  </Button>
                  <Button variant="outline" className="w-full text-yellow-600 border-yellow-300" data-testid="button-flag-review">
                    <i className="fas fa-flag mr-2"></i>Flag for Review
                  </Button>
                  <Button variant="outline" className="w-full text-blue-600 border-blue-300" data-testid="button-send-warning">
                    <i className="fas fa-bell mr-2"></i>Send Warning
                  </Button>
                  <Button variant="outline" className="w-full text-green-600 border-green-300" data-testid="button-mark-resolved">
                    <i className="fas fa-check mr-2"></i>Mark All Resolved
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {incidents.slice(0, 5).map((incident, index) => (
                    <div key={incident.id} className="flex items-start space-x-3 text-sm">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        incident.severity === 'critical' ? 'bg-red-500' :
                        incident.severity === 'high' ? 'bg-orange-500' :
                        incident.severity === 'medium' ? 'bg-yellow-500' :
                        'bg-blue-500'
                      }`}></div>
                      <div>
                        <p className="text-foreground">
                          {incident.isResolved ? 'Incident resolved' : 'Alert triggered'}: {incident.incidentType.replace('_', ' ')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(incident.createdAt || '').toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Snapshot Modal */}
      {snapshotModalOpen && selectedIncident && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setSnapshotModalOpen(false)}>
          <div className="bg-card rounded-xl shadow-2xl p-6 max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Security Incident Snapshot</h3>
              <Button variant="ghost" onClick={() => setSnapshotModalOpen(false)} data-testid="button-close-modal">
                <i className="fas fa-times"></i>
              </Button>
            </div>
            <div className="bg-gray-800 rounded-lg aspect-video flex items-center justify-center mb-4">
              <div className="text-center text-white">
                <i className={`fas ${getIncidentIcon(selectedIncident.incidentType)} text-4xl mb-2`}></i>
                <p>Incident Snapshot</p>
                <p className="text-sm opacity-75">{selectedIncident.incidentType.replace('_', ' ')}</p>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">
                  Captured: {new Date(selectedIncident.createdAt || '').toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">
                  Severity: <Badge variant={getSeverityColor(selectedIncident.severity)}>{selectedIncident.severity}</Badge>
                </p>
              </div>
              <div className="flex space-x-2">
                <Button size="sm" variant="outline" data-testid="button-download-snapshot">
                  <i className="fas fa-download mr-1"></i>Download
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-green-600 border-green-300"
                  onClick={() => {
                    handleResolveIncident(selectedIncident, 'reviewed');
                    setSnapshotModalOpen(false);
                  }}
                  data-testid="button-mark-reviewed"
                >
                  <i className="fas fa-check mr-1"></i>Mark Reviewed
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
