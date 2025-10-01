import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { insertHallTicketSchema, clientHallTicketSchema, insertExamSessionSchema, insertSecurityIncidentSchema, insertMonitoringLogSchema, insertQuestionSchema } from "@shared/schema";
import QRCode from "qrcode";
import { nanoid } from "nanoid";
import { verifyIDDocument } from "./ai-verification";
import { extractNameFromDocument } from "./simple-name-verification";

interface WebSocketClient extends WebSocket {
  sessionId?: string;
  userId?: string;
  type?: 'admin' | 'student';
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Hall ticket routes
  app.post('/api/hall-tickets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const clientData = clientHallTicketSchema.parse(req.body);
      const hallTicketId = `HT${new Date().getFullYear()}${nanoid(8).toUpperCase()}`;
      
      // Generate QR code data
      const qrData = JSON.stringify({
        hallTicketId,
        rollNumber: clientData.rollNumber,
        examName: clientData.examName,
        timestamp: new Date().getTime()
      });

      const hallTicket = await storage.createHallTicket({
        hallTicketId,
        examName: clientData.examName,
        examDate: new Date(clientData.examDate), // Convert string to Date
        duration: clientData.duration,
        totalQuestions: clientData.totalQuestions,
        rollNumber: clientData.rollNumber,
        studentName: clientData.studentName,
        studentEmail: clientData.studentEmail,
        qrCodeData: qrData,
        isActive: true,
        createdBy: userId,
      });

      res.json(hallTicket);
    } catch (error) {
      console.error("Error creating hall ticket:", error);
      res.status(500).json({ message: "Failed to create hall ticket" });
    }
  });

  app.get('/api/hall-tickets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const hallTickets = await storage.getHallTicketsByCreator(userId);
      res.json(hallTickets);
    } catch (error) {
      console.error("Error fetching hall tickets:", error);
      res.status(500).json({ message: "Failed to fetch hall tickets" });
    }
  });

  app.get('/api/hall-tickets/:id/qr', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const hallTicket = await storage.getHallTicketById(id);
      
      if (!hallTicket) {
        return res.status(404).json({ message: "Hall ticket not found" });
      }

      const qrCodeUrl = await QRCode.toDataURL(hallTicket.qrCodeData, {
        width: 300,
        margin: 2,
      });

      res.json({ qrCodeUrl });
    } catch (error) {
      console.error("Error generating QR code:", error);
      res.status(500).json({ message: "Failed to generate QR code" });
    }
  });

  app.patch('/api/hall-tickets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const updates = req.body;
      const updatedTicket = await storage.updateHallTicket(id, updates);
      res.json(updatedTicket);
    } catch (error) {
      console.error("Error updating hall ticket:", error);
      res.status(500).json({ message: "Failed to update hall ticket" });
    }
  });

  app.delete('/api/hall-tickets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.deleteHallTicket(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting hall ticket:", error);
      res.status(500).json({ message: "Failed to delete hall ticket" });
    }
  });

  // Student authentication routes
  app.post('/api/auth/verify-hall-ticket', async (req, res) => {
    try {
      const { qrData, rollNumber, hallTicketId } = req.body;
      
      let hallTicket;
      
      // If hallTicketId is provided (manual entry), validate by hall ticket ID
      if (hallTicketId) {
        hallTicket = await storage.getHallTicketByIdAndRoll(hallTicketId, rollNumber);
        
        if (!hallTicket) {
          return res.status(400).json({ message: "Invalid details" });
        }
      } else if (qrData) {
        // QR code validation
        hallTicket = await storage.getHallTicketByQR(qrData);
        if (!hallTicket) {
          return res.status(404).json({ message: "Invalid hall ticket" });
        }

        if (hallTicket.rollNumber !== rollNumber) {
          return res.status(400).json({ message: "Roll number mismatch" });
        }
      } else {
        return res.status(400).json({ message: "Either QR data or hall ticket ID is required" });
      }

      res.json({
        valid: true,
        hallTicket: {
          id: hallTicket.id,
          hallTicketId: hallTicket.hallTicketId,
          examName: hallTicket.examName,
          studentName: hallTicket.studentName,
          rollNumber: hallTicket.rollNumber,
          examDate: hallTicket.examDate,
          duration: hallTicket.duration,
        }
      });
    } catch (error) {
      console.error("Error verifying hall ticket:", error);
      res.status(500).json({ message: "Failed to verify hall ticket" });
    }
  });

  // Exam session routes
  // Student exam session creation (no auth required - validated via hall ticket)
  app.post('/api/exam-sessions', async (req, res) => {
    try {
      // Validate hall ticket exists and is active first
      const hallTicket = await storage.getHallTicketById(req.body.hallTicketId);
      if (!hallTicket || !hallTicket.isActive) {
        return res.status(400).json({ message: "Invalid or inactive hall ticket" });
      }

      // For students, use hall ticket roll number as studentId (since they don't have Replit auth)
      const studentId = `student_${hallTicket.rollNumber}`;
      
      // Create or get the student user record
      let studentUser = await storage.getUser(studentId);
      if (!studentUser) {
        studentUser = await storage.upsertUser({
          id: studentId,
          email: hallTicket.studentEmail,
          firstName: hallTicket.studentName.split(' ')[0],
          lastName: hallTicket.studentName.split(' ').slice(1).join(' ') || '',
          role: 'student',
        });
      }
      
      // Prepare data with studentId and convert startTime to Date
      const sessionData = {
        ...req.body,
        studentId: studentId,
        startTime: req.body.startTime ? new Date(req.body.startTime) : new Date(),
      };

      // Now validate with schema
      const data = insertExamSessionSchema.parse(sessionData);
      
      // Check if session already exists
      const existingSession = await storage.getExamSessionByStudent(studentId, data.hallTicketId);
      if (existingSession) {
        return res.json(existingSession);
      }

      // Get randomized questions for this exam
      let examQuestions = await storage.getRandomQuestions(hallTicket.examName, hallTicket.totalQuestions);
      
      // If no questions found for specific exam name, fallback to any available questions
      if (!examQuestions || examQuestions.length === 0) {
        console.log(`No questions found for "${hallTicket.examName}", trying fallback to all questions`);
        const allQuestions = await storage.getAllQuestions();
        
        if (allQuestions.length === 0) {
          return res.status(400).json({ 
            message: "No questions available in the system. Please contact the administrator to add questions.",
            error: "NO_QUESTIONS_IN_SYSTEM"
          });
        }
        
        // Use random questions from all available
        const shuffled = allQuestions.sort(() => 0.5 - Math.random());
        const limit = Math.min(hallTicket.totalQuestions || 20, allQuestions.length);
        examQuestions = shuffled.slice(0, limit);
        
        console.log(`Using ${examQuestions.length} fallback questions for exam`);
      }
      
      const questionIds = examQuestions.map(q => q.id);

      // Add questionIds to the session data
      const sessionDataWithQuestions = {
        ...data,
        questionIds: questionIds
      };

      const examSession = await storage.createExamSession(sessionDataWithQuestions);

      res.json(examSession);
    } catch (error) {
      console.error("Error creating exam session:", error);
      res.status(500).json({ message: "Failed to create exam session" });
    }
  });

  app.get('/api/exam-sessions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const session = await storage.getExamSession(id);
      
      if (!session) {
        return res.status(404).json({ message: "Exam session not found" });
      }

      res.json(session);
    } catch (error) {
      console.error("Error fetching exam session:", error);
      res.status(500).json({ message: "Failed to fetch exam session" });
    }
  });

  app.patch('/api/exam-sessions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const session = await storage.updateExamSession(id, updates);
      res.json(session);
    } catch (error) {
      console.error("Error updating exam session:", error);
      res.status(500).json({ message: "Failed to update exam session" });
    }
  });

  // Get questions for a specific exam session (no auth required - students use hall tickets)
  app.get('/api/exam-sessions/:id/questions', async (req, res) => {
    try {
      const { id } = req.params;
      const session = await storage.getExamSession(id);
      
      if (!session) {
        return res.status(404).json({ message: "Exam session not found" });
      }

      // Get the questions based on the session's questionIds
      const questionIds = session.questionIds as string[];
      if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
        return res.status(400).json({ 
          message: "No questions assigned to this exam session",
          error: "NO_QUESTIONS_ASSIGNED"
        });
      }

      // Fetch questions but don't return correct answers to students
      const allQuestions = await storage.getAllQuestions();
      const sessionQuestions = allQuestions
        .filter(q => questionIds.includes(q.id))
        .map(q => ({
          id: q.id,
          questionText: q.questionText,
          options: q.options,
          questionType: q.questionType,
          marks: q.marks
          // Exclude correctAnswer for security
        }));

      res.json(sessionQuestions);
    } catch (error) {
      console.error("Error fetching session questions:", error);
      res.status(500).json({ message: "Failed to fetch session questions" });
    }
  });

  // Submit exam session
  app.post('/api/exam-sessions/:id/submit', async (req, res) => {
    try {
      const { id } = req.params;
      const { answers } = req.body;
      
      const session = await storage.getExamSession(id);
      if (!session) {
        return res.status(404).json({ message: "Exam session not found" });
      }

      // Update session with final answers and mark as submitted
      const updatedSession = await storage.updateExamSession(id, {
        answers: answers,
        status: 'submitted',
        endTime: new Date()
      });

      res.json({ 
        success: true, 
        message: "Exam submitted successfully",
        session: updatedSession 
      });
    } catch (error) {
      console.error("Error submitting exam:", error);
      res.status(500).json({ message: "Failed to submit exam" });
    }
  });

  // Security incident routes
  app.post('/api/security-incidents', isAuthenticated, async (req: any, res) => {
    try {
      const data = insertSecurityIncidentSchema.parse(req.body);
      const incident = await storage.createSecurityIncident(data);
      
      // Broadcast to admin clients
      wss.clients.forEach((client: WebSocketClient) => {
        if (client.readyState === WebSocket.OPEN && client.type === 'admin') {
          client.send(JSON.stringify({
            type: 'security_incident',
            data: incident
          }));
        }
      });

      res.json(incident);
    } catch (error) {
      console.error("Error creating security incident:", error);
      res.status(500).json({ message: "Failed to create security incident" });
    }
  });


  // Monitoring routes  
  app.post('/api/monitoring-logs', async (req, res) => {
    try {
      const data = insertMonitoringLogSchema.parse(req.body);
      const log = await storage.createMonitoringLog(data);
      res.json(log);
    } catch (error) {
      console.error("Error creating monitoring log:", error);
      res.status(500).json({ message: "Failed to create monitoring log" });
    }
  });

  app.get('/api/monitoring-logs/:sessionId', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { sessionId } = req.params;
      const logs = await storage.getMonitoringLogs(sessionId);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching monitoring logs:", error);
      res.status(500).json({ message: "Failed to fetch monitoring logs" });
    }
  });

  app.get('/api/exam-stats', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const stats = await storage.getExamStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching exam stats:", error);
      res.status(500).json({ message: "Failed to fetch exam stats" });
    }
  });

  app.get('/api/exam-sessions', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const sessions = await storage.getAllExamSessions();
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching exam sessions:", error);
      res.status(500).json({ message: "Failed to fetch exam sessions" });
    }
  });

  app.get('/api/active-sessions', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const sessions = await storage.getActiveExamSessions();
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching active sessions:", error);
      res.status(500).json({ message: "Failed to fetch active sessions" });
    }
  });

  // Security incident routes
  app.get('/api/security-incidents', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const incidents = await storage.getSecurityIncidents();
      res.json(incidents);
    } catch (error) {
      console.error("Error fetching security incidents:", error);
      res.status(500).json({ message: "Failed to fetch security incidents" });
    }
  });

  app.patch('/api/security-incidents/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(req.user.claims.sub);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const updates = req.body;
      // Add resolvedAt timestamp on the server side to avoid serialization issues
      if (updates.isResolved) {
        updates.resolvedAt = new Date();
      }
      const updatedIncident = await storage.updateSecurityIncident(id, updates);
      res.json(updatedIncident);
    } catch (error) {
      console.error("Error updating security incident:", error);
      res.status(500).json({ message: "Failed to update security incident" });
    }
  });

  // Question management routes
  app.post('/api/questions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const data = insertQuestionSchema.parse(req.body);
      const question = await storage.createQuestion(data);
      res.json(question);
    } catch (error) {
      console.error("Error creating question:", error);
      res.status(500).json({ message: "Failed to create question" });
    }
  });

  app.get('/api/questions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const questions = await storage.getAllQuestions();
      res.json(questions);
    } catch (error) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });

  app.put('/api/questions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const data = insertQuestionSchema.parse(req.body);
      const question = await storage.updateQuestion(id, data);
      res.json(question);
    } catch (error) {
      console.error("Error updating question:", error);
      res.status(500).json({ message: "Failed to update question" });
    }
  });

  app.delete('/api/questions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      await storage.deleteQuestion(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting question:", error);
      res.status(500).json({ message: "Failed to delete question" });
    }
  });

  // AI-powered ID verification endpoint
  // Simple name-based verification route (new simplified system)
  app.post('/api/verify-name', async (req, res) => {
    try {
      const { idCardImage, expectedName } = req.body;
      
      if (!idCardImage || !expectedName) {
        return res.status(400).json({ 
          message: "Missing required fields: idCardImage and expectedName" 
        });
      }
      
      console.log("Starting simple name verification for:", expectedName);
      
      const result = await extractNameFromDocument(idCardImage, expectedName);
      
      res.json({
        isValid: result.isValid,
        confidence: result.confidence,
        extractedName: result.extractedName,
        reason: result.reason
      });
      
    } catch (error) {
      console.error("Name verification error:", error);
      res.status(500).json({ 
        message: "Verification failed. Please try again.",
        error: process.env.NODE_ENV === 'development' ? (error as Error)?.message : undefined
      });
    }
  });

  // Old complex verification route (kept for fallback)
  app.post('/api/verify-identity', async (req, res) => {
    try {
      const { idCardImage, selfieImage, expectedName, expectedIdNumber, hallTicketId } = req.body;
      
      if (!idCardImage || !selfieImage || !expectedName) {
        return res.status(400).json({ 
          message: "Missing required fields: idCardImage, selfieImage, and expectedName are required" 
        });
      }

      // Verify hall ticket exists if provided
      if (hallTicketId) {
        const hallTicket = await storage.getHallTicketById(hallTicketId);
        if (!hallTicket || !hallTicket.isActive) {
          return res.status(400).json({ message: "Invalid or inactive hall ticket" });
        }
      }

      // Perform AI verification
      const verificationResult = await verifyIDDocument(
        idCardImage,
        selfieImage,
        expectedName,
        expectedIdNumber
      );

      res.json(verificationResult);
    } catch (error) {
      console.error("Identity verification error:", error);
      res.status(500).json({ 
        message: "Identity verification failed",
        error: error.message 
      });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  // Create WebSocket server
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws' 
  });

  wss.on('connection', (ws: WebSocketClient) => {
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'auth') {
          ws.userId = data.userId;
          ws.type = data.userType;
          ws.sessionId = data.sessionId;
        }
        
        if (data.type === 'student_status_update') {
          // Broadcast to admin clients
          wss.clients.forEach((client: WebSocketClient) => {
            if (client.readyState === WebSocket.OPEN && client.type === 'admin') {
              client.send(JSON.stringify({
                type: 'student_status',
                data: data.payload
              }));
            }
          });
        }
        
        if (data.type === 'face_detection_update') {
          // Log monitoring data
          if (data.sessionId) {
            await storage.createMonitoringLog({
              sessionId: data.sessionId,
              eventType: 'face_detected',
              eventData: data.payload
            });
          }
        }

        if (data.type === 'video_snapshot') {
          // Broadcast video snapshot to admin clients for live monitoring
          wss.clients.forEach((client: WebSocketClient) => {
            if (client.readyState === WebSocket.OPEN && client.type === 'admin') {
              client.send(JSON.stringify({
                type: 'video_feed',
                data: {
                  sessionId: data.data.sessionId,
                  studentId: data.data.studentId,
                  studentName: data.data.studentName,
                  rollNumber: data.data.rollNumber,
                  snapshot: data.data.snapshot,
                  timestamp: data.data.timestamp
                }
              }));
            }
          });
          
          // Log to monitoring logs as fallback
          if (data.data.sessionId) {
            await storage.createMonitoringLog({
              sessionId: data.data.sessionId,
              eventType: 'video_snapshot',
              eventData: { 
                studentId: data.data.studentId,
                timestamp: data.data.timestamp
              }
            });
          }
        }
        
        // Handle security violations from students
        if (data.type === 'security_violation' || data.type === 'face_violation') {
          try {
            // Validate required fields for incident creation
            if (!data.data.sessionId || !data.data.incidentType || !data.data.severity || !data.data.description) {
              console.error('Invalid violation data: missing required fields (sessionId, incidentType, severity, description)');
              return;
            }
            
            // Validate sender is a student
            if (ws.type !== 'student') {
              console.error('Unauthorized: Only students can report violations');
              return;
            }
            
            // Validate session exists and belongs to the student
            const session = await storage.getExamSession(data.data.sessionId);
            if (!session) {
              console.error(`Session ${data.data.sessionId} not found`);
              return;
            }
            
            // Rate limiting: check for recent incidents to prevent spam
            const recentIncidents = await storage.getSecurityIncidents(data.data.sessionId);
            const oneMinuteAgo = new Date(Date.now() - 60000);
            const recentSameType = recentIncidents.filter(incident => 
              incident.incidentType === data.data.incidentType && 
              incident.createdAt && new Date(incident.createdAt) > oneMinuteAgo
            );
            
            if (recentSameType.length >= 3) {
              console.log(`Rate limited: Too many ${data.data.incidentType} incidents for session ${data.data.sessionId}`);
              return;
            }
            
            // Create security incident
            const incident = await storage.createSecurityIncident({
              sessionId: data.data.sessionId,
              incidentType: data.data.incidentType,
              severity: data.data.severity,
              description: data.data.description,
              metadata: data.data.metadata || {}
            });
            
            // Broadcast to admin clients
            wss.clients.forEach((client: WebSocketClient) => {
              if (client.readyState === WebSocket.OPEN && client.type === 'admin') {
                client.send(JSON.stringify({
                  type: 'security_incident',
                  data: {
                    ...incident,
                    studentName: data.data.studentName,
                    rollNumber: data.data.rollNumber,
                    violationType: data.data.incidentType // Use actual incident type, not message type
                  }
                }));
              }
            });
            
            console.log(`Security incident created: ${data.data.incidentType} for session ${data.data.sessionId}`);
          } catch (error) {
            console.error('Error creating security incident:', error);
          }
        }
        
        // Handle student status updates (lightweight monitoring)
        if (data.type === 'student_status') {
          try {
            // Broadcast to admin clients
            wss.clients.forEach((client: WebSocketClient) => {
              if (client.readyState === WebSocket.OPEN && client.type === 'admin') {
                client.send(JSON.stringify({
                  type: 'student_monitoring',
                  data: data.data
                }));
              }
            });
          } catch (error) {
            console.error('Error handling student status:', error);
          }
        }
        
        // Handle policy updates (exam paused/auto-submitted) - separate from incidents
        if (data.type === 'policy_update') {
          try {
            // Validate basic required fields
            if (!data.data.sessionId || !data.data.action) {
              console.error('Invalid policy update: missing sessionId or action');
              return;
            }
            
            // Broadcast policy update to admin clients
            wss.clients.forEach((client: WebSocketClient) => {
              if (client.readyState === WebSocket.OPEN && client.type === 'admin') {
                client.send(JSON.stringify({
                  type: 'policy_update',
                  data: data.data
                }));
              }
            });
            
            console.log(`Policy update: ${data.data.action} for session ${data.data.sessionId}`);
          } catch (error) {
            console.error('Error handling policy update:', error);
          }
        }
        
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
    });
  });

  return httpServer;
}
