import multer from "multer";
import { IUser } from "../models/user.model";
import { Request, Response } from "express";
import redis from "../config/redis";
import {
    analyzeContractWithAI,
    detectContractType,
    extractTextFromPDF,
} from "../services/ai.services";
import ContractAnalysisSchema, { IContractAnalysis } from "../models/contract.model";
import mongoose, { FilterQuery } from "mongoose";
import { isvalidMongoId } from "../utils/mongoUtils";

// Define free plan contract limit constant
const FREE_PLAN_CONTRACT_LIMIT = 2;

// Update storage to handle larger files if needed
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
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

// New endpoint to get user's contract usage statistics
export const getUserContractStats = async (req: Request, res: Response) => {
    const user = req.user as IUser;
    
    try {
        // Count the user's existing contracts
        const contractCount = await ContractAnalysisSchema.countDocuments({
            userId: user._id
        });
        
        const userPlan = getUserPlanLevel(user);
        
        // Return statistics with appropriate limits based on user's plan
        return res.status(200).json({
            contractCount,
            contractLimit: hasPremiumAccess(user) ? Infinity : FREE_PLAN_CONTRACT_LIMIT,
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
) => {
    const user = req.user as IUser;

    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    try {
        // For basic users, check if they've reached their contract limit before proceeding
        if (!hasPremiumAccess(user)) {
            const contractCount = await ContractAnalysisSchema.countDocuments({
                userId: user._id
            });
            
            if (contractCount >= FREE_PLAN_CONTRACT_LIMIT) {
                return res.status(403).json({ 
                    error: "Free plan limit reached", 
                    message: `You've reached the limit of ${FREE_PLAN_CONTRACT_LIMIT} contracts on the free plan. Please upgrade to continue.`,
                    limitReached: true
                });
            }
        }

        const fileKey = `file:${user._id}:${Date.now()}`;
        await redis.set(fileKey, req.file.buffer);
        
        // Increase expiration time to handle larger files
        await redis.expire(fileKey, 7200); // 2 hours
        
        const pdfText = await extractTextFromPDF(fileKey);
        const detectedType = await detectContractType(pdfText);
        
        // Store the fileKey in redis for later use in analysis
        const tempKey = `temp:${user._id}:${Date.now()}`;
        await redis.set(tempKey, fileKey);
        await redis.expire(tempKey, 7200); // 2 hours
        
        res.json({ 
            detectedType,
            tempKey // Send the temp key back to the client
        });
    } catch (error) {
        console.error("Contract type detection error:", error);
        res.status(500).json({ 
            error: "Failed to detect contract type",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
};

export const analyzeContract = async (
    req: Request,
    res: Response
) => {
    const user = req.user as IUser;
    let { contractType, tempKey } = req.body;
    
    // For basic users, check if they've reached their contract limit before proceeding
    if (!hasPremiumAccess(user)) {
        const contractCount = await ContractAnalysisSchema.countDocuments({
            userId: user._id
        });
        
        if (contractCount >= FREE_PLAN_CONTRACT_LIMIT) {
            return res.status(403).json({ 
                error: "Free plan limit reached", 
                message: `You've reached the limit of ${FREE_PLAN_CONTRACT_LIMIT} contracts on the free plan. Please upgrade to continue.`,
                limitReached: true
            });
        }
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
            aimodel: "gemini-1.5-pro",
            userPlan: userPlan, // Store the plan used for analysis
        });
        
        // Save the document
        const savedAnalysis = await contractAnalysis.save();
        console.log("Contract analysis saved with ID:", savedAnalysis._id);

        // Clean up Redis keys
        if (tempKey) await redis.del(tempKey);
        if (fileKey) await redis.del(fileKey);

        // Include contract usage stats in the response for basic users
        if (!hasPremiumAccess(user)) {
            const contractCount = await ContractAnalysisSchema.countDocuments({
                userId: user._id
            });
            
            return res.json({
                ...savedAnalysis.toObject(),
                usageStats: {
                    contractCount,
                    contractLimit: FREE_PLAN_CONTRACT_LIMIT,
                    remainingContracts: Math.max(0, FREE_PLAN_CONTRACT_LIMIT - contractCount)
                }
            });
        }

        res.json({
            ...savedAnalysis.toObject(),
            planUsed: userPlan
        });
    } catch (error: any) {
        console.error("analyzeContract error:", error);
        
        // More detailed error logging for Mongoose validation errors
        if (error.name === "ValidationError") {
            console.error("Mongoose validation error details:", JSON.stringify(error.errors));
        }
        
        res.status(500).json({ 
            error: "Failed to analyze contract",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
};

export const getUserContracts = async (req: Request, res: Response) => {
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
        
        res.json({
            contracts,
            userPlan,
            hasGoldAccess: hasGoldAccess(user)
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to get contracts" });
    }
}

export const getContractByID = async (req: Request, res: Response) => {
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
        res.json({
            ...contractObject,
            userPlan: getUserPlanLevel(user),
            hasGoldAccess: hasGoldAccess(user)
        });
    } catch (error) {
        console.error("Error in getContractByID:", error);
        res.status(500).json({ error: "Failed to get contract" });
    }
};

// Add delete contract function
export const deleteContract = async (req: Request, res: Response) => {
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

        // Return success response
        return res.status(200).json({ 
            success: true, 
            message: "Contract deleted successfully" 
        });
    } catch (error) {
        console.error("Error deleting contract:", error);
        return res.status(500).json({ 
            error: "Failed to delete contract",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
};

// New Gold-specific endpoint: Chat with contract (Gold only)
export const chatWithContract = async (req: Request, res: Response) => {
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
        
        // Here you would implement the AI chat functionality
        // This is a placeholder for the actual AI chat implementation
        const chatResponse = `AI Response to: ${message} (This is a Gold feature)`;
        
        res.json({
            response: chatResponse,
            contractId: contractId
        });
    } catch (error) {
        console.error("Error in contract chat:", error);
        res.status(500).json({ error: "Failed to process chat request" });
    }
};

// New Gold-specific endpoint: Modify contract (Gold only)
export const modifyContract = async (req: Request, res: Response) => {
    const user = req.user as IUser;
    const { contractId, modifications } = req.body;
    
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
        
        // Here you would implement the AI contract modification functionality
        // This is a placeholder for the actual AI modification implementation
        const modifiedContract = `Modified contract content based on: ${JSON.stringify(modifications)}`;
        
        res.json({
            modifiedContract: modifiedContract,
            originalContractId: contractId,
            modifications: modifications
        });
    } catch (error) {
        console.error("Error in contract modification:", error);
        res.status(500).json({ error: "Failed to modify contract" });
    }
};