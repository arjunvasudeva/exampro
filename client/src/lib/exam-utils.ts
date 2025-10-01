export interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  questionType: 'multiple_choice' | 'true_false' | 'short_answer';
  difficulty?: 'easy' | 'medium' | 'hard';
  points?: number;
  timeLimit?: number; // in seconds
}

export interface ExamAnswer {
  questionId: string;
  selectedOption: string;
  timeSpent: number;
  timestamp: string;
}

export interface ExamSession {
  id: string;
  studentId: string;
  hallTicketId: string;
  startTime: string;
  endTime?: string;
  currentQuestion: number;
  answers: Record<string, ExamAnswer>;
  timeRemaining: number;
  status: 'not_started' | 'in_progress' | 'paused' | 'completed' | 'submitted';
}

export function calculateTimeRemaining(startTime: string, durationMinutes: number): number {
  const start = new Date(startTime).getTime();
  const now = Date.now();
  const elapsed = Math.floor((now - start) / 1000); // elapsed in seconds
  const totalSeconds = durationMinutes * 60;
  return Math.max(0, totalSeconds - elapsed);
}

export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function calculateExamProgress(answers: Record<string, ExamAnswer>, totalQuestions: number): {
  answered: number;
  percentage: number;
  remaining: number;
} {
  const answered = Object.keys(answers).length;
  const percentage = Math.round((answered / totalQuestions) * 100);
  const remaining = totalQuestions - answered;
  
  return { answered, percentage, remaining };
}

export function validateAnswer(answer: ExamAnswer): { isValid: boolean; error?: string } {
  if (!answer.questionId) {
    return { isValid: false, error: 'Question ID is required' };
  }
  
  if (!answer.selectedOption) {
    return { isValid: false, error: 'Answer selection is required' };
  }
  
  if (answer.timeSpent < 0) {
    return { isValid: false, error: 'Invalid time spent' };
  }
  
  return { isValid: true };
}

export function shuffleQuestions<T extends Question>(questions: T[]): T[] {
  const shuffled = [...questions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function shuffleOptions(question: Question): Question {
  if (question.questionType !== 'multiple_choice') {
    return question;
  }
  
  const correctIndex = question.options.findIndex((_, index) => 
    String.fromCharCode(65 + index) === question.correctAnswer
  );
  
  if (correctIndex === -1) {
    return question;
  }
  
  const shuffledOptions = [...question.options];
  const correctOption = shuffledOptions[correctIndex];
  
  // Fisher-Yates shuffle
  for (let i = shuffledOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
  }
  
  // Update correct answer based on new position
  const newCorrectIndex = shuffledOptions.findIndex(option => option === correctOption);
  const newCorrectAnswer = String.fromCharCode(65 + newCorrectIndex);
  
  return {
    ...question,
    options: shuffledOptions,
    correctAnswer: newCorrectAnswer
  };
}

export function generateExamReport(session: ExamSession, questions: Question[]): {
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  score: number;
  timeSpent: number;
  averageTimePerQuestion: number;
} {
  const totalQuestions = questions.length;
  const answeredQuestions = Object.keys(session.answers).length;
  
  let correctAnswers = 0;
  let totalTimeSpent = 0;
  
  Object.entries(session.answers).forEach(([questionId, answer]) => {
    const question = questions.find(q => q.id === questionId);
    if (question && answer.selectedOption === question.correctAnswer) {
      correctAnswers++;
    }
    totalTimeSpent += answer.timeSpent;
  });
  
  const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  const averageTimePerQuestion = answeredQuestions > 0 ? Math.round(totalTimeSpent / answeredQuestions) : 0;
  
  return {
    totalQuestions,
    answeredQuestions,
    correctAnswers,
    score,
    timeSpent: totalTimeSpent,
    averageTimePerQuestion
  };
}

export function detectCheatingPatterns(session: ExamSession): {
  suspiciousPatterns: string[];
  riskLevel: 'low' | 'medium' | 'high';
} {
  const patterns: string[] = [];
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  
  const answers = Object.values(session.answers);
  
  if (answers.length === 0) {
    return { suspiciousPatterns: patterns, riskLevel };
  }
  
  // Check for unusually fast answering
  const avgTimePerQuestion = answers.reduce((sum, answer) => sum + answer.timeSpent, 0) / answers.length;
  if (avgTimePerQuestion < 10) { // Less than 10 seconds per question
    patterns.push('Unusually fast answering pattern detected');
    riskLevel = 'medium';
  }
  
  // Check for pattern in answer selection (e.g., all A's, alternating pattern)
  const selectedOptions = answers.map(answer => answer.selectedOption);
  const optionCounts = selectedOptions.reduce((counts, option) => {
    counts[option] = (counts[option] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);
  
  const maxOptionCount = Math.max(...Object.values(optionCounts));
  const totalAnswers = selectedOptions.length;
  
  if (maxOptionCount / totalAnswers > 0.8) { // More than 80% same option
    patterns.push('Repetitive answer pattern detected');
    riskLevel = 'high';
  }
  
  // Check for time gaps that might indicate external help
  const timeGaps = answers.map(answer => answer.timeSpent).filter(time => time > 300); // > 5 minutes
  if (timeGaps.length > totalAnswers * 0.3) { // 30% of questions took too long
    patterns.push('Unusual time delays detected');
    riskLevel = riskLevel === 'high' ? 'high' : 'medium';
  }
  
  return { suspiciousPatterns: patterns, riskLevel };
}

export const EXAM_CONSTANTS = {
  MIN_QUESTION_TIME: 5, // seconds
  MAX_QUESTION_TIME: 600, // 10 minutes
  AUTO_SUBMIT_WARNING: 300, // 5 minutes before auto-submit
  IDLE_TIMEOUT: 1800, // 30 minutes idle timeout
  MAX_LOOKING_AWAY_TIME: 60, // seconds before alert
  MAX_FACE_DETECTION_FAILURES: 10, // consecutive failures before alert
} as const;
