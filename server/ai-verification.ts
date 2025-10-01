import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set. AI verification features are unavailable.");
    }
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export interface IDVerificationResult {
  isValid: boolean;
  confidence: number;
  extractedData: {
    name?: string;
    dateOfBirth?: string;
    idNumber?: string;
    documentType?: string;
  };
  faceMatch: {
    matches: boolean;
    confidence: number;
  };
  reasons: string[];
}

export async function verifyIDDocument(
  idCardImage: string, // base64 image
  selfieImage: string,  // base64 image
  expectedName: string,
  expectedIdNumber?: string
): Promise<IDVerificationResult> {
  try {
    const openai = getOpenAIClient();
    
    // Ultra-fast verification with 8-second timeout
    const verificationPromise = openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `Fast ID checker. Extract name from ID and check if faces match. Reply with JSON:
{
  "name": "name from ID",
  "faceMatch": boolean,
  "passed": boolean
}`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract name from ID and check if faces match. Expected: "${expectedName}"`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${idCardImage}`
              }
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${selfieImage}`
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 150 // Minimal response for speed
    });

    // 8-second timeout for fast processing
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Verification timeout')), 8000)
    );

    const verificationResponse = await Promise.race([verificationPromise, timeoutPromise]) as any;

    const result = JSON.parse(verificationResponse.choices[0].message.content || '{}');

    // Fast validation logic with lenient matching
    const reasons: string[] = [];
    let isValid = false;
    let confidence = 0.6; // Default confidence
    
    // Check name match with secure threshold (80% for security)
    if (result.name && expectedName) {
      const nameSimilarity = calculateNameSimilarity(result.name.toLowerCase(), expectedName.toLowerCase());
      if (nameSimilarity >= 0.8) { // Secure threshold
        isValid = true;
        confidence = nameSimilarity;
        reasons.push(`Name match found: "${result.name}" ≈ "${expectedName}"`);
      } else {
        reasons.push(`Name similarity too low: ${Math.round(nameSimilarity * 100)}% (need 80%)`);
      }
    }

    // Require BOTH AI approval AND face match for security
    if (result.passed && result.faceMatch && isValid) {
      confidence = Math.max(confidence, 0.8);
      reasons.push("AI verification passed with face match and name verification");
    } else {
      isValid = false;
      if (!result.passed) reasons.push("AI verification failed");
      if (!result.faceMatch) reasons.push("Face match failed");
    }

    return {
      isValid,
      confidence,
      extractedData: {
        name: result.name || "Unknown",
        documentType: "ID Document",
        idNumber: expectedIdNumber,
        dateOfBirth: undefined
      },
      faceMatch: {
        matches: result.faceMatch || false,
        confidence: confidence
      },
      reasons: reasons.length > 0 ? reasons : ["Quick verification completed"]
    };

  } catch (error) {
    console.error("ID verification error:", error);
    
    // Secure timeout handling: No auto-approval in production
    if (error instanceof Error && error.message && error.message.includes('timeout')) {
      console.log("AI verification timed out - security failure");
      
      // NEVER auto-approve in production for security
      return {
        isValid: false,
        confidence: 0,
        extractedData: {
          name: undefined,
          documentType: undefined,
          idNumber: expectedIdNumber,
          dateOfBirth: undefined
        },
        faceMatch: {
          matches: false,
          confidence: 0
        },
        reasons: ["Verification timed out - please try again or contact support"]
      };
    }
    
    return {
      isValid: false,
      confidence: 0,
      extractedData: {},
      faceMatch: { matches: false, confidence: 0 },
      reasons: [`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

// Simple name similarity calculation using Levenshtein distance
function calculateNameSimilarity(name1: string, name2: string): number {
  const longer = name1.length > name2.length ? name1 : name2;
  const shorter = name1.length > name2.length ? name2 : name1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + indicator   // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}