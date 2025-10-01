export interface QRCodeData {
  hallTicketId: string;
  rollNumber: string;
  examName: string;
  timestamp: number;
  studentName?: string;
  examDate?: string;
}

export function parseQRCode(qrData: string): QRCodeData {
  try {
    const parsed = JSON.parse(qrData);
    
    // Validate required fields
    if (!parsed.hallTicketId || !parsed.rollNumber) {
      throw new Error('Invalid QR code: Missing required fields');
    }
    
    return {
      hallTicketId: parsed.hallTicketId,
      rollNumber: parsed.rollNumber,
      examName: parsed.examName || 'Unknown Exam',
      timestamp: parsed.timestamp || Date.now(),
      studentName: parsed.studentName,
      examDate: parsed.examDate
    };
  } catch (error) {
    throw new Error('Invalid QR code format');
  }
}

export function generateQRCodeData(data: Omit<QRCodeData, 'timestamp'>): string {
  const qrData: QRCodeData = {
    ...data,
    timestamp: Date.now()
  };
  
  return JSON.stringify(qrData);
}

export function validateQRCode(qrData: string): { isValid: boolean; error?: string } {
  try {
    const parsed = parseQRCode(qrData);
    
    // Check if QR code is not expired (24 hours)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const age = Date.now() - parsed.timestamp;
    
    if (age > maxAge) {
      return { isValid: false, error: 'QR code has expired' };
    }
    
    return { isValid: true };
  } catch (error) {
    return { 
      isValid: false, 
      error: error instanceof Error ? error.message : 'Invalid QR code' 
    };
  }
}

export function formatHallTicketId(rollNumber: string, year: number = new Date().getFullYear()): string {
  // Generate hall ticket ID: HT + year + random chars + roll number suffix
  const suffix = rollNumber.slice(-4); // Last 4 characters of roll number
  const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `HT${year}${randomChars}${suffix}`;
}

export function extractStudentInfo(qrData: string): {
  rollNumber: string;
  hallTicketId: string;
  examName: string;
  studentName?: string;
} {
  const parsed = parseQRCode(qrData);
  return {
    rollNumber: parsed.rollNumber,
    hallTicketId: parsed.hallTicketId,
    examName: parsed.examName,
    studentName: parsed.studentName
  };
}

// QR code generation options for different use cases
export const QR_CODE_CONFIG = {
  hallTicket: {
    width: 300,
    height: 300,
    margin: 2,
    colorDark: '#000000',
    colorLight: '#FFFFFF',
    correctLevel: 'M' as const,
  },
  verification: {
    width: 200,
    height: 200,
    margin: 1,
    colorDark: '#6366f1',
    colorLight: '#FFFFFF',
    correctLevel: 'H' as const,
  },
  mobile: {
    width: 150,
    height: 150,
    margin: 1,
    colorDark: '#000000',
    colorLight: '#FFFFFF',
    correctLevel: 'L' as const,
  }
};
