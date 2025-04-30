import redis from "../config/redis";
import { getDocument } from "pdfjs-dist";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

// Updated model name to the latest version
const AI_MODEL = "gemini-1.5-pro";
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
    tier: "free" | "premium",
    contractType: string,
): Promise<string> => {
    try {
        if (!aiModel) {
            throw new Error("AI model not initialized");
        }

        let prompt;
        if( tier === "premium") {

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
        11. any performance metrics or KPIs mentioned, if applicable.
        12. A summary of any specific clauses relevant to this type of contract (e.g., intellectual property for employment, contracts, warranties for sales contracts).
        13. A overall score from 1 to 100, with 100 being the highest. This score represents the overall favorability of the contract based on the identified risks and opportunities.

        Format your response as a JSON object with the following structure:
        {
            "risks": [{ "risk": "Risk description", "explanation": "Brief description", "severity": "low|medium|high" }],
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
        }
        `;
    } else {
        prompt = `Analyze the following ${contractType} contract and provide: 
        1. A list of at least 5 potential risks for the party receiving the contract, each with a brief explanation and severity level (low, medium, high).
        2. A list of at least 5 potential opportunities or benefits for the receiving party, each with a brief explanation and impact level (low, medium, high).
        3. A brief summary of the contract, including key terms and conditions
        4. A overall score from 1 to 100, with 100 being the highest. This score represents the overall favorability of the contract based on the identified risks and opportunities.
        
        {
            "risks": [{ "risk": "Risk description",
            "opportunities": [{ "opportunity": "Opportunity description", "explanation": "Brief explanation"}],
            "summary": "brief summary of the contract",
            "overallScore": "Overall score from 1 to 100",
        }`
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