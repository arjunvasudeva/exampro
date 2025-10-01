// Simple name-based verification to replace complex AI system
// Just extracts name from ID document and compares with hall ticket

interface NameVerificationResult {
  isValid: boolean;
  confidence: number;
  extractedName?: string;
  reason: string;
}

// Simple fuzzy string matching for names
function calculateNameSimilarity(name1: string, name2: string): number {
  // Normalize names: lowercase, remove extra spaces, common prefixes
  const normalize = (name: string) => {
    return name
      .toLowerCase()
      .replace(/\b(mr|mrs|ms|dr|prof)\b\.?/g, '') // Remove titles
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  };
  
  const norm1 = normalize(name1);
  const norm2 = normalize(name2);
  
  // Direct match
  if (norm1 === norm2) return 1.0;
  
  // Split into words and check overlap
  const words1 = norm1.split(' ').filter(w => w.length > 1);
  const words2 = norm2.split(' ').filter(w => w.length > 1);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  // Count matching words
  let matches = 0;
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
        matches++;
        break;
      }
    }
  }
  
  // Return ratio of matching words
  return matches / Math.max(words1.length, words2.length);
}

// Simple text extraction from image using browser APIs
export async function extractNameFromDocument(
  imageBase64: string,
  expectedName: string
): Promise<NameVerificationResult> {
  try {
    console.log("Starting simple name extraction...");
    
    // For now, use a basic OCR approach
    // In production, you could use Tesseract.js or similar client-side OCR
    // For this demo, we'll simulate extraction and do pattern matching
    
    // Convert base64 to image and try to extract text
    const extractedText = await performBasicOCR(imageBase64);
    
    // Look for name patterns in extracted text
    const extractedName = findNameInText(extractedText);
    
    if (!extractedName) {
      return {
        isValid: false,
        confidence: 0,
        reason: "Could not extract name from document. Please ensure the image is clear and contains readable text."
      };
    }
    
    // Compare with expected name
    const similarity = calculateNameSimilarity(extractedName, expectedName);
    
    // Accept if similarity is 70% or higher
    if (similarity >= 0.7) {
      return {
        isValid: true,
        confidence: similarity,
        extractedName,
        reason: `Name match found: "${extractedName}" matches "${expectedName}" (${Math.round(similarity * 100)}% similarity)`
      };
    } else {
      return {
        isValid: false,
        confidence: similarity,
        extractedName,
        reason: `Name mismatch: extracted "${extractedName}" doesn't match "${expectedName}" (${Math.round(similarity * 100)}% similarity, need 70%)`
      };
    }
    
  } catch (error) {
    console.error("Name extraction error:", error);
    return {
      isValid: false,
      confidence: 0,
      reason: "Failed to process document. Please try uploading a clearer image."
    };
  }
}

// Realistic OCR using OpenAI Vision for text extraction
async function performBasicOCR(imageBase64: string): Promise<string> {
  try {
    // Use OpenAI Vision to extract text from the document
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set. AI verification features are unavailable.");
    }
    const OpenAI = require("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Fast model for text extraction
      messages: [
        {
          role: "system",
          content: "Extract all visible text from this ID document. Return just the raw text, no analysis."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all text from this ID document:"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      max_tokens: 200 // Just need text extraction
    });

    return response.choices[0]?.message?.content || "";
    
  } catch (error) {
    console.error("OCR extraction failed:", error);
    // Fallback: return empty string so name matching will fail gracefully
    return "";
  }
}

// Extract name patterns from OCR text
function findNameInText(text: string): string | null {
  // Common name patterns in ID documents
  const namePatterns = [
    /name[:\s]+([a-zA-Z\s]+)/i,
    /^([A-Z][a-z]+ [A-Z][a-z]+)/m, // First Last pattern
    /([A-Z][A-Z\s]+)/, // All caps name
  ];
  
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // Filter out common non-name text
      if (name.length > 3 && !name.match(/\d/) && !name.includes('GOVERNMENT')) {
        return name;
      }
    }
  }
  
  return null;
}