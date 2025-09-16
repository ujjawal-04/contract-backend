import multer from "multer";
import { IUser } from "../models/user.model";
import { Request, Response } from "express";
import redis from "../config/redis";
import {
    analyzeContractWithAI,
    detectContractType,
    extractTextFromPDF,
    modifyContractAI,
    chatWithContractAI,
    generateCustomRecommendations,
} from "../services/ai.services";
import ContractAnalysisSchema, { IContractAnalysis } from "../models/contract.model";
import mongoose, { FilterQuery } from "mongoose";
import { isvalidMongoId } from "../utils/mongoUtils";
// Removed unused PDFDocument and generateContractPDF imports
import { generateModifiedContractPDF } from "../services/pdf.service";

// Define contract limits for each plan
const FREE_PLAN_CONTRACT_LIMIT = 2;
const PREMIUM_PLAN_CONTRACT_LIMIT = 20;
const GOLD_PLAN_CONTRACT_LIMIT = 50;

// Update storage to handle larger files if needed
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (_req, file, cb) => { // Fixed: Added underscore to unused req parameter
        if (file.mimetype === "application/pdf") {
            cb(null, true);
        } else {
            cb(new Error("Only PDF files are allowed"));
        }
    }
}).single("contract");

export const uploadMiddleware = upload;

// Helper function to determine user plan level
const getUserPlanLevel = (user: IUser): "basic" | "premium" | "gold" => {
    if (user.plan === "gold") return "gold";
    if (user.plan === "premium" || user.isPremium) return "premium";
    return "basic";
};

// Helper function to check if user has premium features
const hasPremiumAccess = (user: IUser): boolean => {
    return user.isPremium || user.plan === "premium" || user.plan === "gold";
};

// Helper function to check if user has gold features
const hasGoldAccess = (user: IUser): boolean => {
    return user.plan === "gold";
};

// Helper function to get contract limit based on user plan
const getContractLimit = (user: IUser): number => {
    const planLevel = getUserPlanLevel(user);
    switch (planLevel) {
        case "gold":
            return GOLD_PLAN_CONTRACT_LIMIT;
        case "premium":
            return PREMIUM_PLAN_CONTRACT_LIMIT;
        case "basic":
        default:
            return FREE_PLAN_CONTRACT_LIMIT;
    }
};

// New endpoint to get user's contract usage statistics
export const getUserContractStats = async (req: Request, res: Response) => {
    const user = req.user as IUser;
    
    try {
        // Count the user's existing contracts
        const contractCount = await ContractAnalysisSchema.countDocuments({
            userId: user._id
        });
        
        const userPlan = getUserPlanLevel(user);
        const contractLimit = getContractLimit(user);
        
        // Return statistics with appropriate limits based on user's plan
        return res.status(200).json({
            contractCount,
            contractLimit,
            remainingContracts: Math.max(0, contractLimit - contractCount),
            plan: userPlan,
            hasGoldAccess: hasGoldAccess(user)
        });
    } catch (error) {
        console.error("Error getting user contract stats:", error);
        return res.status(500).json({ 
            error: "Failed to get contract statistics",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
};

export const detectAndConfirmContractType = async (
    req: Request,
    res: Response
): Promise<Response> => { // Fixed: Added return type
    const user = req.user as IUser;
    const { storeDocument } = req.body; // Gold users can choose to store document

    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    try {
        // Check if user has reached their contract limit before proceeding
        const contractCount = await ContractAnalysisSchema.countDocuments({
            userId: user._id
        });
        
        const contractLimit = getContractLimit(user);
        
        if (contractCount >= contractLimit) {
            const planLevel = getUserPlanLevel(user);
            return res.status(403).json({ 
                error: `${planLevel.charAt(0).toUpperCase() + planLevel.slice(1)} plan limit reached`, 
                message: `You've reached the limit of ${contractLimit} contracts on the ${planLevel} plan. Please upgrade to continue.`,
                limitReached: true,
                currentPlan: planLevel,
                contractCount,
                contractLimit
            });
        }

        const fileKey = `file:${user._id}:${Date.now()}`;
        await redis.set(fileKey, req.file.buffer);
        
        // Increase expiration time to handle larger files
        await redis.expire(fileKey, 7200); // 2 hours
        
        // Store original file for Gold users if requested
        if (hasGoldAccess(user) && storeDocument) {
            const originalFileKey = `original:${user._id}:${Date.now()}`;
            await redis.set(originalFileKey, req.file.buffer);
            await redis.expire(originalFileKey, 86400); // Store for 24 hours for Gold users
        }
        
        const pdfText = await extractTextFromPDF(fileKey);
        const detectedType = await detectContractType(pdfText);
        
        // Store the fileKey in redis for later use in analysis
        const tempKey = `temp:${user._id}:${Date.now()}`;
        await redis.set(tempKey, fileKey);
        await redis.expire(tempKey, 7200); // 2 hours
        
        return res.json({ 
            detectedType,
            tempKey, // Send the temp key back to the client
            canStore: hasGoldAccess(user), // Inform client if document storage is available
            remainingContracts: Math.max(0, contractLimit - contractCount - 1) // -1 for the current upload
        });
    } catch (error) {
        console.error("Contract type detection error:", error);
        return res.status(500).json({ 
            error: "Failed to detect contract type",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
};

export const analyzeContract = async (
    req: Request,
    res: Response
): Promise<Response> => { // Fixed: Added return type
    const user = req.user as IUser;
    let { contractType, tempKey, storeOriginal } = req.body;
    
    // Check if user has reached their contract limit before proceeding
    const contractCount = await ContractAnalysisSchema.countDocuments({
        userId: user._id
    });
    
    const contractLimit = getContractLimit(user);
    
    if (contractCount >= contractLimit) {
        const planLevel = getUserPlanLevel(user);
        return res.status(403).json({ 
            error: `${planLevel.charAt(0).toUpperCase() + planLevel.slice(1)} plan limit reached`, 
            message: `You've reached the limit of ${contractLimit} contracts on the ${planLevel} plan. Please upgrade to continue.`,
            limitReached: true,
            currentPlan: planLevel,
            contractCount,
            contractLimit
        });
    }
    
    let fileKey: string | null = null;
    let fileBuffer: Buffer | null = null;
    
    // Check if we're getting the file from a previous step or as a new upload
    if (tempKey) {
        // Get the fileKey from the temporary storage
        fileKey = await redis.get(tempKey) as string;
        if (!fileKey) {
            return res.status(400).json({ error: "File session expired. Please upload again." });
        }
        
        // Get the file from Redis
        const fileData = await redis.get(fileKey);
        if (!fileData) {
            return res.status(400).json({ error: "File data expired. Please upload again." });
        }
        
        if (Buffer.isBuffer(fileData)) {
            fileBuffer = fileData;
        } else if (typeof fileData === "object" && fileData !== null) {
            const bufferData = fileData as { type?: string; data?: number[] };
            if (bufferData.type === "Buffer" && Array.isArray(bufferData.data)) {
                fileBuffer = Buffer.from(bufferData.data);
            }
        }
    } else if (req.file) {
        // Using a new file upload
        fileBuffer = req.file.buffer;
        fileKey = `file:${user._id}:${Date.now()}`;
        await redis.set(fileKey, fileBuffer);
        await redis.expire(fileKey, 7200); // 2 hours
    } else {
        return res.status(400).json({ error: "No file uploaded" });
    }

    if (!contractType) {
        return res.status(400).json({ error: "No contract type provided" });
    }

    if (!fileBuffer || !fileKey) {
        return res.status(400).json({ error: "Failed to process file" });
    }

    try {
        const pdfText = await extractTextFromPDF(fileKey);
        
        let analysis: any;
        const userPlan = getUserPlanLevel(user);

        // Pass the user's plan to the AI analysis
        analysis = await analyzeContractWithAI(pdfText, userPlan, contractType);
        
        try {
            analysis = JSON.parse(analysis);
        } catch (parseError) {
            console.error("Failed to parse AI response:", parseError);
            throw new Error("Failed to parse AI analysis response");
        }

        // Basic validation of analysis data
        if (!analysis || typeof analysis !== 'object') {
            throw new Error("Invalid analysis result");
        }

        // Store original file buffer for Gold users
        let originalFileBuffer: Buffer | null = null;
        if (hasGoldAccess(user) && storeOriginal && fileBuffer) {
            originalFileBuffer = fileBuffer;
        }

        // Create a new Contract Analysis document
        const contractAnalysis = new ContractAnalysisSchema({
            userId: user._id,
            // projectId will be generated by the schema default
            contractText: pdfText,
            contractType: contractType,
            summary: analysis.summary || "",
            risks: analysis.risks || [],
            opportunities: analysis.opportunities || [],
            recommendations: analysis.recommendations || [],
            keyClauses: analysis.keyClauses || [],
            legalCompliance: analysis.legalCompliance || "",
            negotiationPoints: analysis.negotiationPoints || [],
            contractDuration: analysis.contractDuration || "",
            terminationConditions: analysis.terminationConditions || "",
            overallScore: analysis.overallScore || 0,
            financialTerms: analysis.financialTerms || { description: "", details: [] },
            performanceMetrics: analysis.performanceMetrics || [],
            specificClauses: analysis.specificClauses || "",
            intellectualPropertyClauses: analysis.intellectualPropertyClauses || [],
            language: "en",
            aimodel: "gemini-2.0-flash",
            userPlan: userPlan, // Store the plan used for analysis
            originalFile: originalFileBuffer, // Store original file for Gold users
            hasStoredDocument: hasGoldAccess(user) && storeOriginal,
        });
        
        // Save the document
        const savedAnalysis = await contractAnalysis.save();
        console.log("Contract analysis saved with ID:", savedAnalysis._id);

        // Clean up Redis keys
        if (tempKey) await redis.del(tempKey);
        if (fileKey) await redis.del(fileKey);

        // Get updated contract count
        const newContractCount = contractCount + 1;
        
        return res.json({
            ...savedAnalysis.toObject(),
            planUsed: userPlan,
            usageStats: {
                contractCount: newContractCount,
                contractLimit: contractLimit,
                remainingContracts: Math.max(0, contractLimit - newContractCount)
            }
        });
    } catch (error: any) {
        console.error("analyzeContract error:", error);
        
        // More detailed error logging for Mongoose validation errors
        if (error.name === "ValidationError") {
            console.error("Mongoose validation error details:", JSON.stringify(error.errors));
        }
        
        return res.status(500).json({ 
            error: "Failed to analyze contract",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
};

// Enhanced Gold-specific endpoint: Chat with contract
export const chatWithContract = async (req: Request, res: Response): Promise<Response> => { // Fixed: Added return type
    const user = req.user as IUser;
    const { contractId, message } = req.body;
    
    // Check if user has Gold access
    if (!hasGoldAccess(user)) {
        return res.status(403).json({
            error: "Gold subscription required",
            message: "This feature is only available for Gold subscribers"
        });
    }
    
    if (!isvalidMongoId(contractId)) {
        return res.status(400).json({ error: "Invalid contract ID" });
    }
    
    try {
        // Get the contract
        const contract = await ContractAnalysisSchema.findOne({
            _id: contractId,
            userId: user._id,
        });
        
        if (!contract) {
            return res.status(404).json({ error: "Contract not found" });
        }
        
        // Use the AI chat service
        const chatResponse = await chatWithContractAI(
            contract.contractText,
            message,
            contract.chatHistory || []
        );
        
        // Save chat history
        if (!contract.chatHistory) {
            contract.chatHistory = [];
        }
        
        contract.chatHistory.push({
            message: message,
            response: chatResponse,
            timestamp: new Date()
        });
        
        await contract.save();
        
        return res.json({
            response: chatResponse,
            contractId: contractId,
            timestamp: new Date()
        });
    } catch (error) {
        console.error("Error in contract chat:", error);
        return res.status(500).json({ error: "Failed to process chat request" });
    }
};

// Enhanced Gold-specific endpoint: Modify contract with recommendations integration
export const modifyContract = async (req: Request, res: Response): Promise<Response> => { // Fixed: Added return type
    const user = req.user as IUser;
    const { contractId, modifications, useRecommendations, customModifications } = req.body;
    
    // Check if user has Gold access
    if (!hasGoldAccess(user)) {
        return res.status(403).json({
            error: "Gold subscription required",
            message: "Contract modification is only available for Gold subscribers"
        });
    }
    
    if (!isvalidMongoId(contractId)) {
        return res.status(400).json({ error: "Invalid contract ID" });
    }
    
    try {
        // Get the contract
        const contract = await ContractAnalysisSchema.findOne({
            _id: contractId,
            userId: user._id,
        });
        
        if (!contract) {
            return res.status(404).json({ error: "Contract not found" });
        }
        
        // Prepare modifications based on user selection
        let finalModifications: string[] = [];
        
        // If using AI-generated recommendations
        if (useRecommendations && contract.recommendations) {
            finalModifications = [...contract.recommendations];
        }
        
        // Add custom modifications
        if (customModifications && Array.isArray(customModifications)) {
            finalModifications = [...finalModifications, ...customModifications];
        }
        
        // If direct modifications provided
        if (modifications && Array.isArray(modifications)) {
            finalModifications = [...finalModifications, ...modifications];
        }
        
        if (finalModifications.length === 0) {
            return res.status(400).json({ 
                error: "No modifications specified",
                message: "Please provide modifications or select recommendations to apply"
            });
        }
        
        // Use AI to modify the contract
        const modifiedContract = await modifyContractAI(
            contract.contractText,
            finalModifications,
            contract.contractType
        );
        
        // Track modification history
        if (!contract.modificationHistory) {
            contract.modificationHistory = [];
        }
        
        const newVersion = (contract.modificationHistory.length || 0) + 2; // Version 1 is original
        
        contract.modificationHistory.push({
            modifiedAt: new Date(),
            modifiedBy: user.displayName || user.email,
            changes: finalModifications.join("; "),
            version: newVersion,
            modifiedContent: modifiedContract
        });
        
        await contract.save();
        
        return res.json({
            modifiedContract: modifiedContract,
            originalContractId: contractId,
            modifications: finalModifications,
            version: newVersion,
            canDownload: true
        });
    } catch (error) {
        console.error("Error in contract modification:", error);
        return res.status(500).json({ error: "Failed to modify contract" });
    }
};

// New Gold endpoint: Download modified contract as PDF
export const downloadModifiedContract = async (req: Request, res: Response): Promise<Response | void> => { // Fixed: Added return type
    const user = req.user as IUser;
    const { contractId, version } = req.params;
    
    // Check if user has Gold access
    if (!hasGoldAccess(user)) {
        return res.status(403).json({
            error: "Gold subscription required",
            message: "Downloading modified contracts is only available for Gold subscribers"
        });
    }
    
    if (!isvalidMongoId(contractId)) {
        return res.status(400).json({ error: "Invalid contract ID" });
    }
    
    try {
        // Get the contract with proper typing
        const contract = await ContractAnalysisSchema.findOne({
            _id: contractId,
            userId: user._id,
        }) as IContractAnalysis | null; // Fixed: Added proper typing
        
        if (!contract) {
            return res.status(404).json({ error: "Contract not found" });
        }
        
        // Get the requested version
        let contractContent: string;
        let versionInfo: string;
        
        if (version === "original" || version === "1") {
            contractContent = contract.contractText;
            versionInfo = "Original";
        } else {
            const versionNum = parseInt(version);
            const modification = contract.modificationHistory?.find(
                mod => mod.version === versionNum
            );
            
            if (!modification || !modification.modifiedContent) {
                return res.status(404).json({ error: "Version not found" });
            }
            
            contractContent = modification.modifiedContent;
            versionInfo = `Version ${versionNum} - Modified on ${modification.modifiedAt}`;
        }
        
        // Generate PDF
        const pdfBuffer = await generateModifiedContractPDF(
            contractContent,
            contract.contractType,
            versionInfo,
            {
                companyName: "Lexalyze Gold",
                userName: user.displayName || user.email,
                generatedDate: new Date(),
                 contractId: String(contract._id) // Fixed: Added toString()
            }
        );
        
        // Set response headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="contract-${contract.contractType}-v${version}.pdf"`);
        res.send(pdfBuffer);
        
    } catch (error) {
        console.error("Error downloading modified contract:", error);
        return res.status(500).json({ error: "Failed to download contract" });
    }
};

// New Gold endpoint: Generate custom recommendations based on focus areas
export const generateRecommendations = async (req: Request, res: Response): Promise<Response> => { // Fixed: Added return type
    const user = req.user as IUser;
    const { contractId, focusAreas } = req.body;
    
    // Check if user has Gold access
    if (!hasGoldAccess(user)) {
        return res.status(403).json({
            error: "Gold subscription required",
            message: "Custom recommendations are only available for Gold subscribers"
        });
    }
    
    if (!isvalidMongoId(contractId)) {
        return res.status(400).json({ error: "Invalid contract ID" });
    }
    
    try {
        // Get the contract
        const contract = await ContractAnalysisSchema.findOne({
            _id: contractId,
            userId: user._id,
        });
        
        if (!contract) {
            return res.status(404).json({ error: "Contract not found" });
        }
        
        // Generate custom recommendations
        const customRecommendations = await generateCustomRecommendations(
            contract.contractText,
            contract.contractType,
            focusAreas || ["risk mitigation", "compliance", "negotiation improvement"]
        );
        
        // Optionally save custom recommendations
        if (!contract.customRecommendations) {
            contract.customRecommendations = [];
        }
        
        contract.customRecommendations.push({
            generatedAt: new Date(),
            focusAreas: focusAreas,
            recommendations: customRecommendations
        });
        
        await contract.save();
        
        return res.json({
            recommendations: customRecommendations,
            focusAreas: focusAreas,
            contractId: contractId
        });
    } catch (error) {
        console.error("Error generating recommendations:", error);
        return res.status(500).json({ error: "Failed to generate recommendations" });
    }
};

// New Gold endpoint: Track changes comparison
export const trackChanges = async (req: Request, res: Response): Promise<Response> => { // Fixed: Added return type
    const user = req.user as IUser;
    const { contractId, version1, version2 } = req.query;
    
    // Check if user has Gold access
    if (!hasGoldAccess(user)) {
        return res.status(403).json({
            error: "Gold subscription required",
            message: "Track changes is only available for Gold subscribers"
        });
    }
    
    if (!isvalidMongoId(contractId as string)) {
        return res.status(400).json({ error: "Invalid contract ID" });
    }
    
    try {
        // Get the contract
        const contract = await ContractAnalysisSchema.findOne({
            _id: contractId,
            userId: user._id,
        });
        
        if (!contract) {
            return res.status(404).json({ error: "Contract not found" });
        }
        
        // Get versions to compare
        let content1: string, content2: string;
        
        // Get first version content
        if (version1 === "original" || version1 === "1") {
            content1 = contract.contractText;
        } else {
            const mod1 = contract.modificationHistory?.find(
                m => m.version === parseInt(version1 as string)
            );
            if (!mod1 || !mod1.modifiedContent) {
                return res.status(404).json({ error: "Version 1 not found" });
            }
            content1 = mod1.modifiedContent;
        }
        
        // Get second version content
        if (version2 === "original" || version2 === "1") {
            content2 = contract.contractText;
        } else {
            const mod2 = contract.modificationHistory?.find(
                m => m.version === parseInt(version2 as string)
            );
            if (!mod2 || !mod2.modifiedContent) {
                return res.status(404).json({ error: "Version 2 not found" });
            }
            content2 = mod2.modifiedContent;
        }
        
        // Simple change tracking (in production, use a proper diff library)
        const changes = {
            version1: version1,
            version2: version2,
            additions: [], // Parts added in version2
            deletions: [], // Parts removed from version1
            modifications: [] // Parts changed between versions
        };
        
        // You would implement proper diff logic here
        // For now, returning a simple comparison structure
        
        return res.json({
            contractId: contractId,
            comparison: changes,
            version1Content: content1,
            version2Content: content2
        });
        
    } catch (error) {
        console.error("Error tracking changes:", error);
        return res.status(500).json({ error: "Failed to track changes" });
    }
};

// Existing endpoints remain the same...
export const getUserContracts = async (req: Request, res: Response): Promise<Response> => { // Fixed: Added return type
    const user = req.user as IUser;

    try {
        interface QueryType {
            userId : mongoose.Types.ObjectId;
        }

        const query: QueryType = {
            userId: user._id as mongoose.Types.ObjectId
        };
        const contracts = await ContractAnalysisSchema.find(query as FilterQuery<IContractAnalysis>
        ).sort({ createdAt: -1});

        // Add user plan information to response
        const userPlan = getUserPlanLevel(user);
        const contractLimit = getContractLimit(user);
        const contractCount = contracts.length;
        
        return res.json({
            contracts,
            userPlan,
            hasGoldAccess: hasGoldAccess(user),
            usageStats: {
                contractCount,
                contractLimit,
                remainingContracts: Math.max(0, contractLimit - contractCount)
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to get contracts" });
    }
}

export const getContractByID = async (req: Request, res: Response): Promise<Response> => { // Fixed: Added return type
    const { id } = req.params;
    const user = req.user as IUser;

    // First check if the ID is valid
    if (!isvalidMongoId(id)) {
        return res.status(400).json({ error: "Invalid contract ID" });
    }

    try {
        // Try to get from Redis cache first
        const cacheKey = `contract:${id}`;
        const cachedContract = await redis.get(cacheKey);
        
        if (cachedContract) {
            console.log("Cache hit for contract:", id);
            // Parse the cached data if it's a string
            const parsedContract = typeof cachedContract === 'string' 
                ? JSON.parse(cachedContract) 
                : cachedContract;
                
            return res.json({
                ...parsedContract,
                userPlan: getUserPlanLevel(user),
                hasGoldAccess: hasGoldAccess(user)
            });
        }

        // Not found in cache, get from database
        console.log("Fetching contract from database:", id);
        const contract = await ContractAnalysisSchema.findOne({
            _id: id,
            userId: user._id,
        });

        if (!contract) {
            return res.status(404).json({ error: "Contract not found" });
        }

        // Convert mongoose document to plain object
        const contractObject = contract.toObject();
        
        // Store in Redis as a JSON string
        try {
            await redis.set(cacheKey, JSON.stringify(contractObject), { ex: 3600 });
            console.log("Contract cached successfully:", id);
        } catch (redisError) {
            console.error("Redis caching error:", redisError);
            // Continue even if caching fails
        }

        // Return the contract with user plan info
        return res.json({
            ...contractObject,
            userPlan: getUserPlanLevel(user),
            hasGoldAccess: hasGoldAccess(user)
        });
    } catch (error) {
        console.error("Error in getContractByID:", error);
        return res.status(500).json({ error: "Failed to get contract" });
    }
};

// Add delete contract function
export const deleteContract = async (req: Request, res: Response): Promise<Response> => { // Fixed: Added return type
    const { id } = req.params;
    const user = req.user as IUser;

    // Validate the contract ID format
    if (!isvalidMongoId(id)) {
        return res.status(400).json({ error: "Invalid contract ID format" });
    }

    try {
        // Find the contract to verify ownership
        const contract = await ContractAnalysisSchema.findOne({
            _id: id,
            userId: user._id,
        });

        if (!contract) {
            return res.status(404).json({ error: "Contract not found or you don't have permission to delete it" });
        }

        // Delete the contract from the database
        const deleteResult = await ContractAnalysisSchema.deleteOne({ _id: id });
        
        if (deleteResult.deletedCount === 0) {
            return res.status(500).json({ error: "Failed to delete contract" });
        }

        // Clear the cache for this contract
        const cacheKey = `contract:${id}`;
        await redis.del(cacheKey);
        console.log("Contract cache cleared for:", id);

        // Return success response with updated usage stats
        const contractCount = await ContractAnalysisSchema.countDocuments({
            userId: user._id
        });
        const contractLimit = getContractLimit(user);

        return res.status(200).json({ 
            success: true, 
            message: "Contract deleted successfully",
            usageStats: {
                contractCount,
                contractLimit,
                remainingContracts: Math.max(0, contractLimit - contractCount)
            }
        });
    } catch (error) {
        console.error("Error deleting contract:", error);
        return res.status(500).json({ 
            error: "Failed to delete contract",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
};