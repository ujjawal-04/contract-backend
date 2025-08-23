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
            text += content.items.map((item: any) => item.str).join(" ") + "\n";
        }
        return text;
    } catch (error: any) {
        console.error("PDF extraction error:", error);
        throw new Error(
            `Failed to extract text from PDF. Error: ${JSON.stringify(error)}`
        );
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

export const modifyContractAI = async (
    contractText: string,
    modifications: string[],
    contractType: string
): Promise<string> => {
    try {
        if (!aiModel) {
            throw new Error("AI model not initialized");
        }

        const prompt = `You are an AI legal assistant specializing in contract modification. Please modify the following ${contractType} contract based on the requested changes.

        ORIGINAL CONTRACT:
        ${contractText}

        REQUESTED MODIFICATIONS:
        ${modifications.map((mod, index) => `${index + 1}. ${mod}`).join('\n')}

        Please provide a modified version of the contract that incorporates these changes while:
        - Maintaining legal coherence and structure
        - Ensuring all modifications are properly integrated
        - Preserving the original contract's intent where not modified
        - Using appropriate legal language and formatting
        - Highlighting what was changed with [MODIFIED] tags around changed sections

        Return only the modified contract text with clear [MODIFIED] tags around changed sections.`;

        const results = await aiModel.generateContent(prompt);
        const response = results.response;
        return response.text();
    } catch (error: unknown) {
        console.error("Contract modification AI error:", error);
        const apiError = error as ApiError;
        throw new Error(`Failed to modify contract: ${apiError.message || "Unknown error"}`);
    }
};

export const generateCustomRecommendations = async (
    contractText: string,
    contractType: string,
    userFocus: string[] // Areas user wants to focus on (e.g., ["risk mitigation", "cost reduction", "legal compliance"])
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

        Return the recommendations as a JSON array of strings:
        ["Recommendation 1", "Recommendation 2", ...]`;

        const results = await aiModel.generateContent(prompt);
        const response = results.response;
        let rawResponseText = response.text();
        
        // Clean the response
        let cleanedResponse = cleanJsonResponse(rawResponseText);
        
        try {
            const recommendations = JSON.parse(cleanedResponse);
            return Array.isArray(recommendations) ? recommendations : [];
        } catch (jsonError) {
            console.error("Failed to parse recommendations JSON:", jsonError);
            // Fallback: try to extract recommendations from text
            const lines = rawResponseText.split('\n').filter(line => 
                line.trim().startsWith('"') || line.includes('Recommendation')
            );
            return lines.slice(0, 15); // Return up to 15 recommendations
        }
    } catch (error: unknown) {
        console.error("Custom recommendations AI error:", error);
        const apiError = error as ApiError;
        throw new Error(`Failed to generate recommendations: ${apiError.message || "Unknown error"}`);
    }
};