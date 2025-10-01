import {
  users,
  hallTickets,
  examSessions,
  securityIncidents,
  monitoringLogs,
  questions,
  type User,
  type UpsertUser,
  type HallTicket,
  type InsertHallTicket,
  type ExamSession,
  type InsertExamSession,
  type SecurityIncident,
  type InsertSecurityIncident,
  type MonitoringLog,
  type InsertMonitoringLog,
  type Question,
  type InsertQuestion,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Hall ticket operations
  createHallTicket(hallTicket: InsertHallTicket): Promise<HallTicket>;
  getHallTicketByQR(qrData: string): Promise<HallTicket | undefined>;
  getHallTicketById(id: string): Promise<HallTicket | undefined>;
  getHallTicketsByCreator(creatorId: string): Promise<HallTicket[]>;
  updateHallTicket(id: string, updates: Partial<InsertHallTicket>): Promise<HallTicket>;
  
  // Exam session operations
  createExamSession(session: InsertExamSession): Promise<ExamSession>;
  getExamSession(id: string): Promise<ExamSession | undefined>;
  getExamSessionByStudent(studentId: string, hallTicketId: string): Promise<ExamSession | undefined>;
  updateExamSession(id: string, updates: Partial<InsertExamSession>): Promise<ExamSession>;
  getActiveExamSessions(): Promise<ExamSession[]>;
  
  // Security incident operations
  createSecurityIncident(incident: InsertSecurityIncident): Promise<SecurityIncident>;
  getSecurityIncidents(sessionId?: string): Promise<SecurityIncident[]>;
  updateSecurityIncident(id: string, updates: Partial<InsertSecurityIncident>): Promise<SecurityIncident>;
  getActiveSecurityIncidents(): Promise<SecurityIncident[]>;
  
  // Monitoring log operations
  createMonitoringLog(log: InsertMonitoringLog): Promise<MonitoringLog>;
  getMonitoringLogs(sessionId: string): Promise<MonitoringLog[]>;
  
  // Question operations
  createQuestion(question: InsertQuestion): Promise<Question>;
  getAllQuestions(): Promise<Question[]>;
  updateQuestion(id: string, data: InsertQuestion): Promise<Question>;
  deleteQuestion(id: string): Promise<void>;
  getQuestionsByExam(examName: string): Promise<Question[]>;
  getRandomQuestions(examName: string, limit: number): Promise<Question[]>;
  
  // Analytics
  getExamStats(): Promise<{
    activeStudents: number;
    totalSessions: number;
    securityAlerts: number;
    averageProgress: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Hall ticket operations
  async createHallTicket(hallTicket: InsertHallTicket): Promise<HallTicket> {
    const [ticket] = await db.insert(hallTickets).values(hallTicket).returning();
    return ticket;
  }

  async getHallTicketByQR(qrData: string): Promise<HallTicket | undefined> {
    const [ticket] = await db
      .select()
      .from(hallTickets)
      .where(and(eq(hallTickets.qrCodeData, qrData), eq(hallTickets.isActive, true)));
    return ticket;
  }

  async getHallTicketById(id: string): Promise<HallTicket | undefined> {
    const [ticket] = await db.select().from(hallTickets).where(eq(hallTickets.id, id));
    return ticket;
  }

  async getHallTicketsByCreator(creatorId: string): Promise<HallTicket[]> {
    return await db
      .select()
      .from(hallTickets)
      .where(eq(hallTickets.createdBy, creatorId))
      .orderBy(desc(hallTickets.createdAt));
  }

  async updateHallTicket(id: string, updates: Partial<InsertHallTicket>): Promise<HallTicket> {
    const [ticket] = await db
      .update(hallTickets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(hallTickets.id, id))
      .returning();
    return ticket;
  }

  async getHallTicketByIdAndRoll(hallTicketId: string, rollNumber: string): Promise<HallTicket | undefined> {
    const [ticket] = await db
      .select()
      .from(hallTickets)
      .where(and(
        eq(hallTickets.hallTicketId, hallTicketId),
        eq(hallTickets.rollNumber, rollNumber),
        eq(hallTickets.isActive, true)
      ));
    return ticket;
  }

  async deleteHallTicket(id: string): Promise<void> {
    // First, get all exam sessions that reference this hall ticket
    const relatedSessions = await db
      .select()
      .from(examSessions)
      .where(eq(examSessions.hallTicketId, id));

    // Delete security incidents for each related exam session (cascade)
    for (const session of relatedSessions) {
      await db.delete(securityIncidents).where(eq(securityIncidents.sessionId, session.id));
      await db.delete(monitoringLogs).where(eq(monitoringLogs.sessionId, session.id));
    }

    // Delete all exam sessions that reference this hall ticket
    await db.delete(examSessions).where(eq(examSessions.hallTicketId, id));

    // Finally, delete the hall ticket
    await db.delete(hallTickets).where(eq(hallTickets.id, id));
  }

  // Exam session operations
  async createExamSession(session: InsertExamSession): Promise<ExamSession> {
    const [examSession] = await db.insert(examSessions).values(session).returning();
    return examSession;
  }

  async getExamSession(id: string): Promise<ExamSession | undefined> {
    const [session] = await db.select().from(examSessions).where(eq(examSessions.id, id));
    return session;
  }

  async getExamSessionByStudent(studentId: string, hallTicketId: string): Promise<ExamSession | undefined> {
    const [session] = await db
      .select()
      .from(examSessions)
      .where(and(eq(examSessions.studentId, studentId), eq(examSessions.hallTicketId, hallTicketId)));
    return session;
  }

  async updateExamSession(id: string, updates: Partial<InsertExamSession>): Promise<ExamSession> {
    const [session] = await db
      .update(examSessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(examSessions.id, id))
      .returning();
    return session;
  }

  async getAllExamSessions(): Promise<any[]> {
    return await db
      .select({
        id: examSessions.id,
        hallTicketId: examSessions.hallTicketId,
        studentId: examSessions.studentId,
        status: examSessions.status,
        startTime: examSessions.startTime,
        endTime: examSessions.endTime,
        currentQuestion: examSessions.currentQuestion,
        answers: examSessions.answers,
        questionIds: examSessions.questionIds,
        timeRemaining: examSessions.timeRemaining,
        isVerified: examSessions.isVerified,
        verificationData: examSessions.verificationData,
        createdAt: examSessions.createdAt,
        updatedAt: examSessions.updatedAt,
        // Include user information
        studentName: users.firstName,
        studentLastName: users.lastName,
        studentEmail: users.email
      })
      .from(examSessions)
      .leftJoin(users, eq(users.id, examSessions.studentId))
      .orderBy(desc(examSessions.startTime));
  }

  async getActiveExamSessions(): Promise<ExamSession[]> {
    return await db
      .select()
      .from(examSessions)
      .where(eq(examSessions.status, "in_progress"))
      .orderBy(desc(examSessions.startTime));
  }

  // Security incident operations
  async createSecurityIncident(incident: InsertSecurityIncident): Promise<SecurityIncident> {
    const [securityIncident] = await db.insert(securityIncidents).values(incident).returning();
    return securityIncident;
  }

  async getSecurityIncidents(sessionId?: string): Promise<SecurityIncident[]> {
    const query = db.select().from(securityIncidents);
    if (sessionId) {
      return await query.where(eq(securityIncidents.sessionId, sessionId)).orderBy(desc(securityIncidents.createdAt));
    }
    return await query.orderBy(desc(securityIncidents.createdAt));
  }

  async updateSecurityIncident(id: string, updates: Partial<InsertSecurityIncident>): Promise<SecurityIncident> {
    const [incident] = await db
      .update(securityIncidents)
      .set(updates)
      .where(eq(securityIncidents.id, id))
      .returning();
    return incident;
  }

  async getActiveSecurityIncidents(): Promise<SecurityIncident[]> {
    return await db
      .select()
      .from(securityIncidents)
      .where(eq(securityIncidents.isResolved, false))
      .orderBy(desc(securityIncidents.createdAt));
  }

  // Monitoring log operations
  async createMonitoringLog(log: InsertMonitoringLog): Promise<MonitoringLog> {
    const [monitoringLog] = await db.insert(monitoringLogs).values(log).returning();
    return monitoringLog;
  }

  async getMonitoringLogs(sessionId: string): Promise<MonitoringLog[]> {
    return await db
      .select()
      .from(monitoringLogs)
      .where(eq(monitoringLogs.sessionId, sessionId))
      .orderBy(desc(monitoringLogs.timestamp));
  }

  // Question operations
  async createQuestion(question: InsertQuestion): Promise<Question> {
    const [newQuestion] = await db.insert(questions).values(question).returning();
    return newQuestion;
  }

  async getQuestionsByExam(examName: string): Promise<Question[]> {
    return await db.select().from(questions).where(eq(questions.examName, examName));
  }

  async getRandomQuestions(examName: string, limit: number): Promise<Question[]> {
    return await db
      .select()
      .from(questions)
      .where(eq(questions.examName, examName))
      .orderBy(sql`RANDOM()`)
      .limit(limit);
  }

  async getAllQuestions(): Promise<Question[]> {
    return await db
      .select()
      .from(questions)
      .orderBy(desc(questions.createdAt));
  }

  async updateQuestion(id: string, data: InsertQuestion): Promise<Question> {
    const [question] = await db
      .update(questions)
      .set(data)
      .where(eq(questions.id, id))
      .returning();
    return question;
  }

  async deleteQuestion(id: string): Promise<void> {
    await db.delete(questions).where(eq(questions.id, id));
  }

  // Analytics
  async getExamStats(): Promise<{
    activeStudents: number;
    totalSessions: number;
    securityAlerts: number;
    averageProgress: number;
  }> {
    const [activeStudentsResult] = await db
      .select({ count: count() })
      .from(examSessions)
      .where(eq(examSessions.status, "in_progress"));

    const [totalSessionsResult] = await db.select({ count: count() }).from(examSessions);

    const [securityAlertsResult] = await db
      .select({ count: count() })
      .from(securityIncidents)
      .where(eq(securityIncidents.isResolved, false));

    const activeSessions = await db
      .select()
      .from(examSessions)
      .where(eq(examSessions.status, "in_progress"));

    let averageProgress = 0;
    if (activeSessions.length > 0) {
      const totalProgress = activeSessions.reduce((sum, session) => {
        const progress = session.currentQuestion || 1;
        return sum + progress;
      }, 0);
      averageProgress = Math.round((totalProgress / activeSessions.length) * 2); // Assuming 50 total questions
    }

    return {
      activeStudents: activeStudentsResult.count,
      totalSessions: totalSessionsResult.count,
      securityAlerts: securityAlertsResult.count,
      averageProgress,
    };
  }
}

export const storage = new DatabaseStorage();
