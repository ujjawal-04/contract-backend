import redis from "../config/redis";
import { getDocument } from "pdfjs-dist";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

// Updated model name to the latest version
const AI_MODEL = "gemini-2.0-flash";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Define the type for the AI model
let aiModel: GenerativeModel;

try {
    aiModel = genAI.getGenerativeModel({ model: AI_MODEL });
} catch (error: any) {
    console.error("Failed to initialize AI model:", error);
    // Instead of setting a fallback model, throw an error at initialization time
    throw new Error(`Failed to initialize AI model: ${error.message || "Unknown error"}`);
}

// Define a custom error type for better handling
interface ApiError extends Error {
    status?: number;
    message: string;
}

// Helper function to clean JSON responses
const cleanJsonResponse = (text: string): string => {
    // Check if the response contains markdown code blocks
    if (text.includes("```json")) {
        // Extract just the JSON part from markdown code blocks
        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
            return jsonMatch[1].trim();
        }
    }
    
    // Check if the response starts with backticks but without "json"
    if (text.includes("```")) {
        // Extract content from any code block
        const codeMatch = text.match(/```\s*([\s\S]*?)\s*```/);
        if (codeMatch && codeMatch[1]) {
            return codeMatch[1].trim();
        }
    }
    
    // If no code blocks found, return the original text
    return text;
};

// Enhanced helper function to clean and standardize contract formatting
const cleanContractFormatting = (contractText: string): string => {
    let cleaned = contractText;

    // Remove any markdown formatting that might interfere with PDF generation
    cleaned = cleaned.replace(/```[\w]*\n?/g, '');
    cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1'); // Remove bold markdown
    cleaned = cleaned.replace(/\*(.*?)\*/g, '$1'); // Remove italic markdown

    // Standardize section headers - ensure proper spacing and formatting
    cleaned = cleaned.replace(/^(\d+)\.\s*([A-Z][A-Z\s]+[A-Z])$/gm, '\n$1. $2\n');
    cleaned = cleaned.replace(/^([A-Z][A-Z\s]+[A-Z]):?\s*$/gm, '\n$1\n');

    // ENHANCED: Better line spacing control
    // Ensure consistent line spacing between paragraphs
    cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n'); // Limit excessive newlines to triple
    cleaned = cleaned.replace(/\n{2,3}/g, '\n\n'); // Standardize paragraph spacing to double newlines
    
    // Remove empty lines with just spaces but preserve intentional spacing
    cleaned = cleaned.replace(/^\s*$/gm, ''); 
    
    // ENHANCED: Better section spacing
    // Add proper spacing before major sections
    cleaned = cleaned.replace(/^(\d+)\.\s+([A-Z][A-Z\s]*[A-Z])\s*$/gm, '\n\n$1. $2\n');
    
    // Standardize subsection formatting with proper spacing
    cleaned = cleaned.replace(/^(\d+\.\d+)\s+/gm, '\n$1 ');
    cleaned = cleaned.replace(/^([a-z])\)\s+/gm, '\n$1) ');

    // ENHANCED: Ensure proper paragraph formatting with consistent spacing
    cleaned = cleaned.replace(/\.\s+([A-Z])/g, '. $1'); // Proper sentence spacing
    cleaned = cleaned.replace(/([.!?])\s*\n\s*([A-Z])/g, '$1\n\n$2'); // Proper paragraph breaks

    // Standardize contract clause formatting with better spacing
    cleaned = cleaned.replace(/WHEREAS,?\s+/gi, '\nWHEREAS, ');
    cleaned = cleaned.replace(/NOW, THEREFORE,?\s+/gi, '\n\nNOW, THEREFORE, ');

    // Clean up signature blocks with proper spacing
    cleaned = cleaned.replace(/_{3,}/g, '____________________');
    cleaned = cleaned.replace(/Date:\s*_{3,}/g, '\nDate: ____________________');
    
    // ENHANCED: Add proper spacing around signature blocks
    cleaned = cleaned.replace(/(Signature:\s*_+)/g, '\n\n$1');
    cleaned = cleaned.replace(/(Date:\s*_+)/g, '\n$1\n');

    // ENHANCED: Clean up any extra whitespace but preserve paragraph structure
    cleaned = cleaned.replace(/[ \t]+$/gm, ''); // Remove trailing spaces
    cleaned = cleaned.replace(/^[ \t]+/gm, ''); // Remove leading spaces on lines
    
    // ENHANCED: Ensure proper spacing for contract sections
    cleaned = cleaned.replace(/^(IN WITNESS WHEREOF)/gm, '\n\n$1');
    cleaned = cleaned.replace(/^(EXECUTED)/gm, '\n\n$1');
    
    // Final cleanup - remove any leading/trailing whitespace and ensure clean start
    cleaned = cleaned.trim();
    
    // ENHANCED: Ensure document doesn't start with excessive newlines (prevents blank pages)
    cleaned = cleaned.replace(/^\n+/, '');
    
    return cleaned;
};

// Additional function to format for PDF generation specifically
const formatForPDF = (contractText: string): string => {
    let formatted = cleanContractFormatting(contractText);
    
    // Ensure consistent line height by standardizing spacing
    formatted = formatted.replace(/\n/g, '\n'); // Normalize line breaks
    
    // Add proper page break hints before major sections if needed
    formatted = formatted.replace(/^(\d+)\.\s+([A-Z][A-Z\s]*[A-Z])/gm, '\n$1. $2');
    
    // Ensure no blank page at start - remove any leading whitespace/newlines
    formatted = formatted.replace(/^[\s\n]*/, '');
    
    return formatted;
};

// Usage in your contract modification function
export const modifyContractAI = async (
    contractText: string,
    modifications: string[],
    contractType: string
): Promise<string> => {
    try {
        if (!aiModel) {
            throw new Error("AI model not initialized");
        }

        const prompt = `You are a senior legal AI assistant specializing in professional contract drafting and modification. Please modify the following ${contractType} contract based on the requested changes while maintaining the highest professional standards.

        ORIGINAL CONTRACT:
        ${contractText}

        REQUESTED MODIFICATIONS:
        ${modifications.map((mod, index) => `${index + 1}. ${mod}`).join('\n')}

        CRITICAL FORMATTING REQUIREMENTS FOR PDF GENERATION:
        1. DO NOT start the contract with blank lines or excessive spacing
        2. Begin immediately with the contract title
        3. Use consistent single line spacing between paragraphs
        4. Use double line spacing between major sections
        5. Structure with proper professional formatting suitable for legal documents
        6. Use clear section headers with numbering (e.g., "1. PARTIES", "2. TERMS AND CONDITIONS")
        7. Include appropriate sub-sections with proper numbering (1.1, 1.2, etc.)
        8. Maintain consistent paragraph spacing and indentation
        9. Use formal legal language and terminology
        10. Include proper clause structures with clear definitions
        11. Ensure all modifications are seamlessly integrated into the existing structure
        12. Mark modified sections with [MODIFIED] tags around changed content only
        13. NO BLANK PAGES - start content immediately

        SPECIFIC SPACING RULES:
        - Single line break between sentences within paragraphs
        - Double line break between paragraphs
        - Double line break between sections
        - NO triple or quadruple line breaks anywhere
        - Contract should start immediately with title, no leading spaces/lines

        Return the complete modified contract with professional formatting, proper structure, and clear [MODIFIED] tags around only the changed portions. The output should be ready for professional PDF generation with NO blank pages and consistent line spacing.`;

        const results = await aiModel.generateContent(prompt);
        const response = results.response;
        let modifiedContract = response.text();

        // Apply enhanced cleaning and PDF formatting
        modifiedContract = formatForPDF(modifiedContract);

        return modifiedContract;
    } catch (error: unknown) {
        console.error("Contract modification AI error:", error);
        const apiError = error as ApiError;
        throw new Error(`Failed to modify contract: ${apiError.message || "Unknown error"}`);
    }
};

// Enhanced extractTextFromPDF function with better formatting
export const extractTextFromPDF = async (filekey: string): Promise<string> => {
    try {
        const fileData = await redis.get(filekey);
        if (!fileData) {
            throw new Error("File not found");
        }

        let fileBuffer: Uint8Array;
        if (Buffer.isBuffer(fileData)) {
            fileBuffer = new Uint8Array(fileData);
        } else if (typeof fileData === "object" && fileData !== null) {
            const bufferData = fileData as { type?: string; data?: number[] };
            if (bufferData.type === "Buffer" && Array.isArray(bufferData.data)) {
                fileBuffer = new Uint8Array(bufferData.data);
            } else {
                throw new Error("Invalid file data");
            }
        } else {
            throw new Error("Invalid file data");
        }

        const pdf = await getDocument({ data: fileBuffer }).promise;
        let text = "";

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();

            // Build page text with better spacing
            const pageText = content.items
                .map((item: any) => (item.str && typeof item.str === "string" ? cleanJsonResponse(item.str) : ""))
                .filter((str) => str.length > 0)
                .join(" ");

            if (pageText.trim()) {
                text += pageText + "\n\n"; // double new line to separate paragraphs
            }
        }

        // Apply strong cleaning & formatting
        const cleanedText = cleanContractFormatting(text)
            .replace(/\s+/g, " ") // collapse multiple spaces
            .replace(/\n{3,}/g, "\n\n") // limit excessive new lines
            .replace(/([a-z0-9])\s*([.,;:!?])\s*/gi, "$1$2 ") // fix punctuation spacing
            .replace(/\s*-\s*/g, "\n- ") // format bullet points
            .replace(/(\d+)\.\s*/g, "\n$1. ") // format numbered lists
            .replace(/([.!?])\s+/g, "$1\n") // sentence ends → new line
            .replace(/[^\S\r\n]+/g, " ") // clean weird whitespace
            .trim();

        if (!cleanedText || cleanedText.length === 0) {
            throw new Error("No readable text found in PDF");
        }

        return cleanedText;
    } catch (error: any) {
        console.error("PDF extraction error:", error);

        if (error.message?.includes("Invalid PDF")) {
            throw new Error("The uploaded file appears to be corrupted or not a valid PDF");
        } else if (error.message?.includes("Password")) {
            throw new Error("The PDF is password protected and cannot be processed");
        } else if (error.message?.includes("No readable text")) {
            throw new Error("The PDF appears to be image-based or contains no extractable text");
        } else {
            throw new Error(`Failed to extract text from PDF: ${error.message || "Unknown error"}`);
        }
    }
};


export const detectContractType = async (
    contractText: string
): Promise<string> => {
    try {
        if (!aiModel) {
            throw new Error("AI model not initialized");
        }

        const prompt = `Analyze the following contract text and determine the type of contract it is. Provide only the contract type as a single string (e.g., "Employment", "Non-Disclosure Agreement", "Sales", "Lease", etc.). Do not include any additional explanation or text.

        Contract Text:
        ${contractText.substring(0, 2000)}
        `;

        const results = await aiModel.generateContent(prompt);
        const response = results.response;
        return response.text().trim();
    } catch (error: unknown) {
        console.error("Contract type detection error:", error);
        
        // Handle typed errors
        const apiError = error as ApiError;
        
        if (apiError.status === 404) {
            throw new Error("AI model not found. Please check your API configuration.");
        } else if (apiError.status === 403) {
            throw new Error("API key does not have access to the requested model.");
        } else {
            throw new Error(`Failed to detect contract type: ${apiError.message || "Unknown error"}`);
        }
    }
};

export const extractContractDates = async (
    contractText: string,
    contractType: string
): Promise<{
    dates: Array<{
        dateType: string;
        date: string; // ISO string
        description: string;
        clause: string;
        confidence: 'high' | 'medium' | 'low';
    }>;
}> => {
    try {
        if (!aiModel) {
            throw new Error("AI model not initialized");
        }

        const prompt = `Analyze the following ${contractType} contract and extract all important dates with their context. Focus on dates that would require reminders or alerts.

        CONTRACT TEXT:
        ${contractText}

        Please identify and extract:
        1. Contract start date
        2. Contract end/expiration date
        3. Renewal dates or deadlines
        4. Termination notice periods/deadlines
        5. Payment due dates
        6. Review or evaluation dates
        7. Warranty expiry dates
        8. Any other contractually significant dates

        For each date found, provide:
        - dateType: one of ['start_date', 'end_date', 'renewal_date', 'termination_notice', 'payment_due', 'review_date', 'warranty_expiry', 'other']
        - date: the actual date in ISO format (YYYY-MM-DD)
        - description: clear description of what this date represents
        - clause: the exact clause text containing this date (keep it concise, max 200 characters)
        - confidence: your confidence level in the date extraction ('high', 'medium', 'low')

        IMPORTANT GUIDELINES:
        - Only extract dates that are contractually significant and would benefit from reminders
        - Convert relative dates (e.g., "30 days after signing") to approximate dates if possible
        - If you can't determine the exact date, mark confidence as 'low'
        - Focus on future dates that would need monitoring
        - Include context about what happens on each date

        Format your response as a JSON object:
        {
            "dates": [
                {
                    "dateType": "start_date",
                    "date": "2025-01-01",
                    "description": "Contract commencement date",
                    "clause": "This agreement shall commence on January 1, 2025...",
                    "confidence": "high"
                }
            ]
        }

        Return ONLY the JSON object, no additional text or formatting.`;

        const results = await aiModel.generateContent(prompt);
        const response = results.response;
        let rawResponseText = response.text();
        
        // Clean the response
        let cleanedResponse = cleanJsonResponse(rawResponseText);
        
        try {
            const extractedDates = JSON.parse(cleanedResponse);
            return extractedDates;
        } catch (jsonError) {
            console.error("Failed to parse dates JSON:", jsonError);
            return { dates: [] };
        }
    } catch (error: unknown) {
        console.error("Contract dates extraction AI error:", error);
        const apiError = error as ApiError;
        throw new Error(`Failed to extract contract dates: ${apiError.message || "Unknown error"}`);
    }
};

export const analyzeContractWithAI = async (
    contractText: string,
    tier: "basic" | "premium" | "gold",
    contractType: string,
): Promise<string> => {
    try {
        if (!aiModel) {
            throw new Error("AI model not initialized");
        }

        let prompt = "";

        // Gold plan - most comprehensive analysis
        if (tier === "gold") {
            prompt = `Analyze the following ${contractType} contract and provide the most comprehensive analysis possible: 
            1. A list of at least 15 potential risks for the party receiving the contract, each with a detailed explanation and severity level (low, medium, high).
            2. A list of at least 15 potential opportunities or benefits for the receiving party, each with a detailed explanation and impact level (low, medium, high).
            3. A comprehensive and detailed summary of the contract, including all key terms, conditions, and implications
            4. Detailed recommendations for improving the contract from the receiving party's perspective, including specific clause modifications.
            5. A comprehensive list of key clauses in the contract with explanations.
            6. A thorough assessment of the contract's legal compliance and potential legal issues.
            7. An extensive list of potential negotiation points with strategies.
            8. Detailed analysis of the contract duration or term, including renewal and extension options.
            9. A comprehensive summary of all termination conditions, notice requirements, and penalties.
            10. A detailed breakdown of financial terms or compensation structure with analysis of fairness.
            11. All performance metrics or KPIs mentioned, with analysis of achievability and fairness.
            12. A detailed summary of any specific clauses relevant to this type of contract with risk assessment.
            13. A overall score from 1 to 100, with detailed explanation of the scoring rationale.
            14. Additional insights on market standards and industry best practices.
            15. Specific areas where AI-powered contract modification could be beneficial.

            Format your response as a JSON object with the following structure:
            {
                "risks": [{ "risk": "Risk description", "explanation": "Detailed explanation with implications", "severity": "low|medium|high" }],
                "opportunities": [{ "opportunity": "Opportunity description", "explanation": "Detailed explanation with potential benefits", "impact": "low|medium|high" }],
                "summary": "Comprehensive and detailed summary of the contract covering all aspects",
                "recommendations": ["Detailed recommendation 1 with specific actions", "Detailed recommendation 2", ...],
                "keyClauses": ["Detailed clause 1 with explanation", "Detailed clause 2", ...],
                "legalCompliance": "Thorough assessment of legal compliance with specific concerns",
                "negotiationPoints": ["Strategic negotiation point 1 with approach", "Strategic point 2", ...],
                "contractDuration": "Detailed analysis of contract duration, renewals, and extensions",
                "terminationConditions": "Comprehensive summary of all termination conditions and implications",
                "overallScore": "Overall score from 1 to 100",
                "financialTerms": {
                    "description": "Detailed overview of all financial terms and fairness analysis",
                    "details": ["Detailed financial aspect 1", "Detailed aspect 2", ...]
                },
                "performanceMetrics": ["Detailed metric 1 with achievability analysis", "Detailed metric 2", ...],
                "specificClauses": "Comprehensive analysis of clauses specific to this contract type with risk assessment",
                "intellectualPropertyClauses": ["Detailed IP clause 1 with implications", "Detailed IP clause 2", ...]
            }`;

        // Premium plan - enhanced analysis
        } else if (tier === "premium") {
            prompt = `Analyze the following ${contractType} contract and provide: 
            1. A list of at least 10 potential risks for the party receiving the contract, each with a brief explanation and severity level (low, medium, high).
            2. A list of at least 10 potential opportunities or benefits for the receiving party, each with a brief explanation and impact level (low, medium, high).
            3. A comprehensive summary of the contract, including key terms and conditions
            4. Any recommendations for improving the contract from the receiving party's perspective.
            5. A list of key clauses in the contract.
            6. An assessment of the contract's legal compliance.
            7. A list of potential negotiation points.
            8. The contract duration or term, if applicable.
            9. A summary of the termination conditions, if applicable.
            10. A breakdown of financial terms or compensation structure, if applicable.
            11. Any performance metrics or KPIs mentioned, if applicable.
            12. A summary of any specific clauses relevant to this type of contract (e.g., intellectual property for employment contracts, warranties for sales contracts).
            13. An overall score from 1 to 100, with 100 being the highest. This score represents the overall favorability of the contract based on the identified risks and opportunities.

            Format your response as a JSON object with the following structure:
            {
                "risks": [{ "risk": "Risk description", "explanation": "Brief explanation", "severity": "low|medium|high" }],
                "opportunities": [{ "opportunity": "Opportunity description", "explanation": "Brief explanation", "impact": "low|medium|high" }],
                "summary": "Comprehensive summary of the contract",
                "recommendations": ["Recommendation 1", "Recommendation 2", ...],
                "keyClauses": ["Clause 1", "Clause 2", ...],
                "legalCompliance": "Assessment of legal compliance",
                "negotiationPoints": ["Point 1", "Point 2", ...],
                "contractDuration": "Duration of the contract, if applicable",
                "terminationConditions": "Summary of termination conditions, if applicable",
                "overallScore": "Overall score from 1 to 100",
                "financialTerms": {
                    "description": "Overview of financial terms",
                    "details": ["Detail 1", "Detail 2", ...]
                },
                "performanceMetrics": ["Metric 1", "Metric 2", ...],
                "specificClauses": "Summary of clauses specific to this contract type",
                "intellectualPropertyClauses": ["Clause 1", "Clause 2", ...]
            }`;

        // Basic plan - limited analysis
        } else {
            prompt = `Analyze the following ${contractType} contract and provide: 
            1. A list of at least 5 potential risks for the party receiving the contract, each with a brief explanation and severity level (low, medium, high).
            2. A list of at least 5 potential opportunities or benefits for the receiving party, each with a brief explanation and impact level (low, medium, high).
            3. A brief summary of the contract, including key terms and conditions
            4. Basic recommendations for improving the contract from the receiving party's perspective.
            5. A list of key clauses in the contract.
            6. A basic assessment of the contract's legal compliance.
            7. A list of potential negotiation points.
            8. The contract duration or term, if applicable.
            9. A summary of the termination conditions, if applicable.
            10. A basic breakdown of financial terms or compensation structure, if applicable.
            11. Any performance metrics or KPIs mentioned, if applicable.
            12. A summary of any specific clauses relevant to this type of contract.
            13. An overall score from 1 to 100, with 100 being the highest. This score represents the overall favorability of the contract based on the identified risks and opportunities.

            Format your response as a JSON object with the following structure:
            {
                "risks": [{ "risk": "Risk description", "explanation": "Brief explanation", "severity": "low|medium|high" }],
                "opportunities": [{ "opportunity": "Opportunity description", "explanation": "Brief explanation", "impact": "low|medium|high" }],
                "summary": "Brief summary of the contract",
                "recommendations": ["Recommendation 1", "Recommendation 2", ...],
                "keyClauses": ["Clause 1", "Clause 2", ...],
                "legalCompliance": "Assessment of legal compliance",
                "negotiationPoints": ["Point 1", "Point 2", ...],
                "contractDuration": "Duration of the contract, if applicable",
                "terminationConditions": "Summary of termination conditions, if applicable",
                "overallScore": "Overall score from 1 to 100",
                "financialTerms": {
                    "description": "Overview of financial terms",
                    "details": ["Detail 1", "Detail 2", ...]
                },
                "performanceMetrics": ["Metric 1", "Metric 2", ...],
                "specificClauses": "Summary of clauses specific to this contract type",
                "intellectualPropertyClauses": ["Clause 1", "Clause 2", ...]
            }`;
        }

        prompt += `
        Important: Provide ONLY the JSON object in your response, DO NOT include any markdown formatting, code blocks, backticks, or additional text. Return the raw JSON object ONLY.
        
        Contract text:
        ${contractText}
        `;

        const results = await aiModel.generateContent(prompt);
        const response = results.response;
        let rawResponseText = response.text();
        
        // Clean the response to handle markdown code blocks and other formatting
        let cleanedResponse = cleanJsonResponse(rawResponseText);
        console.log("Cleaned JSON response:", cleanedResponse.substring(0, 200) + "...");
        
        // Validate JSON response
        try {
            JSON.parse(cleanedResponse);
            return cleanedResponse;
        } catch (jsonError) {
            console.error("Failed to parse AI response as JSON:", jsonError);
            console.error("Raw response:", rawResponseText.substring(0, 500) + "...");
            
            // Try simple cleanup of code blocks
            let simpleCleaning = rawResponseText
                .replace(/```json/g, '')
                .replace(/```/g, '')
                .trim();
            
            try {
                JSON.parse(simpleCleaning);
                console.log("Successfully parsed JSON after simple cleaning");
                return simpleCleaning;
            } catch (simpleError) {
                console.error("Failed simple cleanup parsing:", simpleError);
            }
            
            // Attempt a more aggressive cleaning
            let lastResortCleaning = rawResponseText
                .replace(/```json/g, '')
                .replace(/```/g, '')
                .trim();
                
            // Remove any non-JSON text before the first { and after the last }
            const firstBrace = lastResortCleaning.indexOf('{');
            const lastBrace = lastResortCleaning.lastIndexOf('}');
            
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                lastResortCleaning = lastResortCleaning.substring(firstBrace, lastBrace + 1);
                try {
                    JSON.parse(lastResortCleaning);
                    console.log("Successfully parsed JSON after aggressive cleaning");
                    return lastResortCleaning;
                } catch (lastError) {
                    console.error("Failed final parsing attempt:", lastError);
                }
            }
            
            throw new Error("AI returned malformed JSON response");
        }
    } catch (error: unknown) {
        console.error("Contract analysis error:", error);
        
        // Handle typed errors
        const apiError = error as ApiError;
        
        if (apiError.status === 404) {
            throw new Error("AI model not found. Please check your API configuration.");
        } else if (apiError.status === 403) {
            throw new Error("API key does not have access to the requested model.");
        } else {
            throw new Error(`Failed to analyze contract: ${apiError.message || "Unknown error"}`);
        }
    }
};

// New Gold-specific AI functions
export const chatWithContractAI = async (
    contractText: string,
    userMessage: string,
    chatHistory: { message: string; response: string; timestamp: Date }[] = []
): Promise<string> => {
    try {
        if (!aiModel) {
            throw new Error("AI model not initialized");
        }

        // Build context from chat history
        const historyContext = chatHistory.length > 0 
            ? chatHistory.map(chat => `User: ${chat.message}\nAI: ${chat.response}`).join('\n\n')
            : '';

        const prompt = `You are an AI legal assistant specializing in contract analysis. You have access to the following contract text and previous conversation history.

        CONTRACT TEXT:
        ${contractText}

        PREVIOUS CONVERSATION:
        ${historyContext}

        USER QUESTION:
        ${userMessage}

        Please provide a helpful, accurate response about the contract. Focus on:
        - Answering the specific question asked
        - Referencing relevant parts of the contract
        - Providing practical insights and implications
        - Maintaining context from previous conversation
        - Being concise but thorough

        Respond in a conversational, helpful tone as if you're a legal expert assistant.`;

        const results = await aiModel.generateContent(prompt);
        const response = results.response;
        return response.text();
    } catch (error: unknown) {
        console.error("Contract chat AI error:", error);
        const apiError = error as ApiError;
        throw new Error(`Failed to process chat request: ${apiError.message || "Unknown error"}`);
    }
};


// Enhanced generateCustomRecommendations function
export const generateCustomRecommendations = async (
    contractText: string,
    contractType: string,
    userFocus: string[]
): Promise<string[]> => {
    try {
        if (!aiModel) {
            throw new Error("AI model not initialized");
        }

        const prompt = `Analyze the following ${contractType} contract and generate custom recommendations focusing on the specified areas.

        CONTRACT TEXT:
        ${contractText}

        FOCUS AREAS:
        ${userFocus.join(', ')}

        Please provide 10-15 specific, actionable recommendations that address the focus areas. Each recommendation should:
        - Be specific and actionable
        - Reference relevant contract clauses
        - Explain the potential impact
        - Consider the focus areas specified

        IMPORTANT: Return ONLY a clean JSON array of strings with no markdown formatting, no asterisks, no special symbols, and no code blocks. Format exactly like this:
        ["Recommendation 1 text here", "Recommendation 2 text here", "Recommendation 3 text here"]

        Do not include any markdown, asterisks (*), underscores (_), hash symbols (#), or any other formatting. Return only plain text within the JSON array.`;

        const results = await aiModel.generateContent(prompt);
        const response = results.response;
        let rawResponseText = response.text();
        
        // Enhanced cleaning for recommendations
        let cleanedResponse = cleanJsonResponse(rawResponseText);
        
        try {
            const recommendations = JSON.parse(cleanedResponse);
            if (Array.isArray(recommendations)) {
                // Clean each recommendation text
                const cleanedRecommendations = recommendations.map(rec => 
                    typeof rec === 'string' ? cleanJsonResponse(rec) : String(rec)
                );
                return cleanedRecommendations;
            }
            return [];
        } catch (jsonError) {
            console.error("Failed to parse recommendations JSON:", jsonError);
            console.log("Raw response:", rawResponseText.substring(0, 500));
            console.log("Cleaned response:", cleanedResponse.substring(0, 500));
            
            // Enhanced fallback: extract recommendations from text
            const lines = rawResponseText
                .split('\n')
                .map(line => cleanJsonResponse(line)) // Clean each line
                .filter(line => {
                    const trimmed = line.trim();
                    return trimmed.length > 20 && // Minimum length for a meaningful recommendation
                           (trimmed.startsWith('"') || 
                            trimmed.includes('recommend') ||
                            trimmed.includes('should') ||
                            trimmed.includes('consider') ||
                            /^\d+\./.test(trimmed)); // Numbered items
                })
                .map(line => {
                    // Remove quotes and numbering
                    return line.replace(/^["']*/, '').replace(/["']*$/, '').replace(/^\d+\.\s*/, '');
                })
                .slice(0, 15); // Return up to 15 recommendations

            return lines.length > 0 ? lines : ["Unable to generate recommendations. Please try again."];
        }
    } catch (error: unknown) {
        console.error("Custom recommendations AI error:", error);
        const apiError = error as ApiError;
        throw new Error(`Failed to generate recommendations: ${apiError.message || "Unknown error"}`);
    }
};

// Enhanced function for generating structured contract recommendations
export const generateStructuredRecommendations = async (
    contractText: string,
    contractType: string,
    userFocus: string[]
): Promise<{
    riskMitigation: string[];
    legalCompliance: string[];
    businessOptimization: string[];
    negotiationPoints: string[];
}> => {
    try {
        if (!aiModel) {
            throw new Error("AI model not initialized");
        }

        const prompt = `Analyze the following ${contractType} contract and generate structured recommendations organized by category.

        CONTRACT TEXT:
        ${contractText}

        USER FOCUS AREAS:
        ${userFocus.join(', ')}

        Please provide recommendations in the following categories, with 3-5 specific recommendations per category:

        1. RISK MITIGATION: Recommendations to reduce legal and business risks
        2. LEGAL COMPLIANCE: Suggestions for better legal compliance and protection
        3. BUSINESS OPTIMIZATION: Ways to improve business terms and outcomes
        4. NEGOTIATION POINTS: Strategic points for contract negotiation

        Format your response as a JSON object:
        {
            "riskMitigation": ["Risk mitigation recommendation 1", "Risk mitigation recommendation 2", ...],
            "legalCompliance": ["Legal compliance recommendation 1", "Legal compliance recommendation 2", ...],
            "businessOptimization": ["Business optimization recommendation 1", "Business optimization recommendation 2", ...],
            "negotiationPoints": ["Negotiation point 1", "Negotiation point 2", ...]
        }

        Each recommendation should be specific, actionable, and reference relevant contract clauses where applicable.`;

        const results = await aiModel.generateContent(prompt);
        const response = results.response;
        let rawResponseText = response.text();
        
        // Clean the response
        let cleanedResponse = cleanJsonResponse(rawResponseText);
        
        try {
            const recommendations = JSON.parse(cleanedResponse);
            return {
                riskMitigation: recommendations.riskMitigation || [],
                legalCompliance: recommendations.legalCompliance || [],
                businessOptimization: recommendations.businessOptimization || [],
                negotiationPoints: recommendations.negotiationPoints || []
            };
        } catch (jsonError) {
            console.error("Failed to parse structured recommendations JSON:", jsonError);
            // Return empty structure if parsing fails
            return {
                riskMitigation: [],
                legalCompliance: [],
                businessOptimization: [],
                negotiationPoints: []
            };
        }
    } catch (error: unknown) {
        console.error("Structured recommendations AI error:", error);
        const apiError = error as ApiError;
        throw new Error(`Failed to generate structured recommendations: ${apiError.message || "Unknown error"}`);
    }
};

// Enhanced contract validation function
export const validateContractModifications = async (
    originalContract: string,
    modifiedContract: string,
    contractType: string
): Promise<{
    isValid: boolean;
    issues: string[];
    suggestions: string[];
    legalityScore: number;
}> => {
    try {
        if (!aiModel) {
            throw new Error("AI model not initialized");
        }

        const prompt = `You are a legal validation AI. Please analyze the modifications made to this ${contractType} contract and validate their legal soundness.

        ORIGINAL CONTRACT:
        ${originalContract}

        MODIFIED CONTRACT:
        ${modifiedContract}

        Please validate the modifications and provide:
        1. Overall validity assessment (true/false)
        2. Any legal issues or concerns identified
        3. Suggestions for improvement
        4. Legal soundness score (0-100)

        Focus on:
        - Legal coherence and consistency
        - Potential conflicts between clauses
        - Enforceability concerns
        - Missing critical elements
        - Compliance with standard legal practices

        Format response as JSON:
        {
            "isValid": boolean,
            "issues": ["Issue 1", "Issue 2", ...],
            "suggestions": ["Suggestion 1", "Suggestion 2", ...],
            "legalityScore": number (0-100)
        }`;

        const results = await aiModel.generateContent(prompt);
        const response = results.response;
        let rawResponseText = response.text();
        
        let cleanedResponse = cleanJsonResponse(rawResponseText);
        
        try {
            const validation = JSON.parse(cleanedResponse);
            return {
                isValid: validation.isValid || false,
                issues: validation.issues || [],
                suggestions: validation.suggestions || [],
                legalityScore: validation.legalityScore || 0
            };
        } catch (jsonError) {
            console.error("Failed to parse validation JSON:", jsonError);
            return {
                isValid: false,
                issues: ["Failed to validate contract modifications"],
                suggestions: ["Please review modifications manually"],
                legalityScore: 0
            };
        }
    } catch (error: unknown) {
        console.error("Contract validation AI error:", error);
        const apiError = error as ApiError;
        throw new Error(`Failed to validate contract: ${apiError.message || "Unknown error"}`);
    }
};

// Professional contract template generator
export const generateContractTemplate = async (
    contractType: string,
    basicTerms: {
        parties: string[];
        duration?: string;
        jurisdiction?: string;
        keyTerms?: string[];
    }
): Promise<string> => {
    try {
        if (!aiModel) {
            throw new Error("AI model not initialized");
        }

        const prompt = `Generate a professional ${contractType} contract template with proper legal formatting suitable for PDF generation.

        CONTRACT DETAILS:
        - Contract Type: ${contractType}
        - Parties: ${basicTerms.parties.join(', ')}
        - Duration: ${basicTerms.duration || 'To be specified'}
        - Jurisdiction: ${basicTerms.jurisdiction || 'To be specified'}
        - Key Terms: ${basicTerms.keyTerms?.join(', ') || 'Standard terms'}

        REQUIREMENTS:
        1. Include all standard sections for this contract type
        2. Use professional legal formatting suitable for PDF generation
        3. Include proper section numbering and structure
        4. Add placeholder text where specific details need to be filled
        5. Include standard legal clauses (governing law, severability, etc.)
        6. Ensure the template is legally sound and enforceable
        7. Format for easy customization and professional appearance

        STRUCTURE GUIDELINES:
        - Contract title (ALL CAPS, centered)
        - Parties section with proper identification
        - Recitals (WHEREAS clauses, if appropriate)
        - Terms and conditions with numbered sections
        - Standard legal provisions (governing law, entire agreement, severability)
        - Signature blocks with proper formatting

        FORMATTING STANDARDS:
        - Professional spacing and indentation
        - Clear section headers with numbering
        - Consistent paragraph formatting
        - Proper legal clause structure
        - Standard signature block formatting

        Return a complete, professionally formatted contract template ready for PDF generation with placeholders clearly marked.`;

        const results = await aiModel.generateContent(prompt);
        const response = results.response;
        let template = response.text();

        // Clean and format the template
        template = cleanContractFormatting(template);

        return template;
    } catch (error: unknown) {
        console.error("Contract template generation AI error:", error);
        const apiError = error as ApiError;
        throw new Error(`Failed to generate contract template: ${apiError.message || "Unknown error"}`);
    }
};

// Advanced contract comparison function
export const compareContracts = async (
    originalContract: string,
    modifiedContract: string,
    contractType: string
): Promise<{
    changes: Array<{
        section: string;
        type: 'added' | 'modified' | 'removed';
        original: string;
        modified: string;
        impact: 'low' | 'medium' | 'high';
    }>;
    summary: string;
    riskAssessment: string;
}> => {
    try {
        if (!aiModel) {
            throw new Error("AI model not initialized");
        }

        const prompt = `Compare the following original and modified ${contractType} contracts and identify all changes.

        ORIGINAL CONTRACT:
        ${originalContract}

        MODIFIED CONTRACT:
        ${modifiedContract}

        Please provide a detailed comparison analysis including:
        1. All changes made (additions, modifications, removals)
        2. Impact assessment for each change (low, medium, high)
        3. Overall summary of changes
        4. Risk assessment of the modifications

        Format your response as JSON:
        {
            "changes": [
                {
                    "section": "Section name or clause identifier",
                    "type": "added|modified|removed",
                    "original": "Original text (empty if added)",
                    "modified": "Modified text (empty if removed)",
                    "impact": "low|medium|high"
                }
            ],
            "summary": "Overall summary of all changes made",
            "riskAssessment": "Assessment of risks introduced or mitigated by the changes"
        }`;

        const results = await aiModel.generateContent(prompt);
        const response = results.response;
        let rawResponseText = response.text();
        
        let cleanedResponse = cleanJsonResponse(rawResponseText);
        
        try {
            const comparison = JSON.parse(cleanedResponse);
            return {
                changes: comparison.changes || [],
                summary: comparison.summary || '',
                riskAssessment: comparison.riskAssessment || ''
            };
        } catch (jsonError) {
            console.error("Failed to parse comparison JSON:", jsonError);
            return {
                changes: [],
                summary: "Failed to analyze contract changes",
                riskAssessment: "Unable to assess risks due to parsing error"
            };
        }
    } catch (error: unknown) {
        console.error("Contract comparison AI error:", error);
        const apiError = error as ApiError;
        throw new Error(`Failed to compare contracts: ${apiError.message || "Unknown error"}`);
    }
};

// Extract key contract terms for quick reference
export const extractKeyTerms = async (
    contractText: string,
    contractType: string
): Promise<{
    parties: string[];
    keyDates: string[];
    financialTerms: string[];
    obligations: string[];
    termination: string[];
    governance: string[];
}> => {
    try {
        if (!aiModel) {
            throw new Error("AI model not initialized");
        }

        const prompt = `Extract the key terms from the following ${contractType} contract and organize them by category.

        CONTRACT TEXT:
        ${contractText}

        Please extract and organize the following information:
        1. All parties mentioned (individuals, companies, entities)
        2. Key dates (start, end, renewal, notice periods, etc.)
        3. Financial terms (amounts, payment schedules, penalties, etc.)
        4. Key obligations and responsibilities
        5. Termination conditions and procedures
        6. Governance and legal provisions

        Format as JSON:
        {
            "parties": ["Party 1", "Party 2", ...],
            "keyDates": ["Date description 1", "Date description 2", ...],
            "financialTerms": ["Financial term 1", "Financial term 2", ...],
            "obligations": ["Obligation 1", "Obligation 2", ...],
            "termination": ["Termination condition 1", "Termination condition 2", ...],
            "governance": ["Governance clause 1", "Governance clause 2", ...]
        }`;

        const results = await aiModel.generateContent(prompt);
        const response = results.response;
        let rawResponseText = response.text();
        
        let cleanedResponse = cleanJsonResponse(rawResponseText);
        
        try {
            const keyTerms = JSON.parse(cleanedResponse);
            return {
                parties: keyTerms.parties || [],
                keyDates: keyTerms.keyDates || [],
                financialTerms: keyTerms.financialTerms || [],
                obligations: keyTerms.obligations || [],
                termination: keyTerms.termination || [],
                governance: keyTerms.governance || []
            };
        } catch (jsonError) {
            console.error("Failed to parse key terms JSON:", jsonError);
            return {
                parties: [],
                keyDates: [],
                financialTerms: [],
                obligations: [],
                termination: [],
                governance: []
            };
        }
    } catch (error: unknown) {
        console.error("Key terms extraction AI error:", error);
        const apiError = error as ApiError;
        throw new Error(`Failed to extract key terms: ${apiError.message || "Unknown error"}`);
    }
};

// Generate contract summary for executive briefing
export const generateExecutiveSummary = async (
    contractText: string,
    contractType: string,
    analysisData?: any
): Promise<string> => {
    try {
        if (!aiModel) {
            throw new Error("AI model not initialized");
        }

        const prompt = `Generate an executive summary for the following ${contractType} contract. This summary should be suitable for senior management review.

        CONTRACT TEXT:
        ${contractText}

        ${analysisData ? `ANALYSIS DATA:\n${JSON.stringify(analysisData, null, 2)}` : ''}

        Please provide a concise executive summary that includes:
        1. Contract overview and purpose
        2. Key parties and their roles
        3. Critical terms and conditions
        4. Financial implications
        5. Key risks and opportunities
        6. Recommended actions or decisions needed
        7. Timeline and important dates

        The summary should be:
        - Professional and executive-level appropriate
        - Concise but comprehensive
        - Action-oriented
        - Highlighting critical decision points
        - Maximum 500 words

        Format as a well-structured executive summary suitable for PDF generation.`;

        const results = await aiModel.generateContent(prompt);
        const response = results.response;
        let summary = response.text();

        // Clean formatting for professional appearance
        summary = cleanContractFormatting(summary);

        return summary;
    } catch (error: unknown) {
        console.error("Executive summary AI error:", error);
        const apiError = error as ApiError;
        throw new Error(`Failed to generate executive summary: ${apiError.message || "Unknown error"}`);
    }
};