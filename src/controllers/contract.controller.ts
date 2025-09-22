// src/controllers/contract.controller.ts - FIXED VERSION

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
    extractContractDates // ADD THIS IMPORT
} from "../services/ai.services";
import ContractAnalysisSchema, { IContractAnalysis } from "../models/contract.model";
import mongoose, { FilterQuery } from "mongoose";
import { isvalidMongoId } from "../utils/mongoUtils";
import { generateModifiedContractPDF } from "../services/pdf.service";
import { alertService } from "../services/alert.service"; // ADD THIS IMPORT

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
    fileFilter: (_req, file, cb) => {
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
): Promise<Response> => {
    const user = req.user as IUser;
    const { storeDocument } = req.body;

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
): Promise<Response> => {
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
        const savedAnalysis = await contractAnalysis.save() as IContractAnalysis;
        console.log("Contract analysis saved with ID:", savedAnalysis._id);

        // Process the contract for date extraction after saving
        try {
           await alertService.processContractForDates((savedAnalysis._id as mongoose.Types.ObjectId).toString());
        } catch (dateError) {
            console.error("Error processing contract for dates:", dateError);
            // Don't fail the main request if date extraction fails
        }

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
export const chatWithContract = async (req: Request, res: Response): Promise<Response> => {
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
export const modifyContract = async (req: Request, res: Response): Promise<Response> => {
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
export const downloadModifiedContract = async (req: Request, res: Response): Promise<Response | void> => {
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
        }) as IContractAnalysis | null;
        
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
                contractId: String(contract._id)
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
export const generateRecommendations = async (req: Request, res: Response): Promise<Response> => {
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


// DATE ALERT FUNCTIONS

export const getContractDates = async (req: Request, res: Response): Promise<Response> => {
    const user = req.user as IUser;
    const { id } = req.params;

    if (!isvalidMongoId(id)) {
        return res.status(400).json({ error: "Invalid contract ID" });
    }

    try {
        const contract = await ContractAnalysisSchema.findOne({
            _id: id,
            userId: user._id,
        });

        if (!contract) {
            return res.status(404).json({ error: "Contract not found" });
        }

        // If no dates extracted yet, try to extract them
        if (!contract.contractDates || contract.contractDates.length === 0) {
            try {
                const extractedDates = await extractContractDates(
                    contract.contractText,
                    contract.contractType
                );

                if (extractedDates.dates.length > 0) {
                    // FIXED: Properly type the date info mapping
                    contract.contractDates = extractedDates.dates.map((dateInfo: {
                        dateType: string;
                        date: string;
                        description: string;
                        clause: string;
                        confidence: 'high' | 'medium' | 'low';
                    }) => ({
                        dateType: dateInfo.dateType as any,
                        date: new Date(dateInfo.date),
                        description: dateInfo.description,
                        clause: dateInfo.clause,
                        isActive: dateInfo.confidence === 'high',
                        _id: new mongoose.Types.ObjectId()
                    }));

                    await contract.save();

                    // Process for alert scheduling
                    await alertService.processContractForDates(id);
                }
            } catch (extractError) {
                console.error("Error extracting dates:", extractError);
            }
        }

        // Get upcoming dates for quick view
        const upcomingDates = contract.getUpcomingDates(60); // Next 60 days

        return res.json({
            contractDates: contract.contractDates || [],
            dateAlerts: contract.dateAlerts || [],
            upcomingDates: upcomingDates,
            hasGoldAccess: hasGoldAccess(user)
        });
    } catch (error) {
        console.error("Error getting contract dates:", error);
        return res.status(500).json({ error: "Failed to get contract dates" });
    }
};

export const updateContractDateAlert = async (req: Request, res: Response): Promise<Response> => {
    const user = req.user as IUser;
    const { contractId, dateId } = req.params;
    const { reminderDays, isActive } = req.body;

    if (!isvalidMongoId(contractId) || !reminderDays || typeof isActive !== 'boolean') {
        return res.status(400).json({ error: "Invalid parameters" });
    }

    if (![1, 3, 7, 14, 30].includes(parseInt(reminderDays))) {
        return res.status(400).json({ error: "Invalid reminder days. Must be 1, 3, 7, 14, or 30." });
    }

    try {
        const contract = await ContractAnalysisSchema.findOne({
            _id: contractId,
            userId: user._id,
        });

        if (!contract) {
            return res.status(404).json({ error: "Contract not found" });
        }

        // Toggle the alert
        await contract.toggleDateAlert(dateId, parseInt(reminderDays), isActive);

        return res.json({
            success: true,
            message: `Alert ${isActive ? 'activated' : 'deactivated'} for ${reminderDays} day${reminderDays !== '1' ? 's' : ''} reminder`
        });
    } catch (error) {
        console.error("Error updating date alert:", error);
        return res.status(500).json({ error: "Failed to update date alert" });
    }
};

export const addCustomContractDate = async (req: Request, res: Response): Promise<Response> => {
    const user = req.user as IUser;
    const { contractId } = req.params;
    const { dateType, date, description, clause } = req.body;

    if (!isvalidMongoId(contractId)) {
        return res.status(400).json({ error: "Invalid contract ID" });
    }

    if (!dateType || !date || !description || !clause) {
        return res.status(400).json({ error: "All fields are required" });
    }

    try {
        const contract = await ContractAnalysisSchema.findOne({
            _id: contractId,
            userId: user._id,
        });

        if (!contract) {
            return res.status(404).json({ error: "Contract not found" });
        }

        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
            return res.status(400).json({ error: "Invalid date format" });
        }

        // Add the custom date
        await contract.addContractDate(dateType, parsedDate, description, clause);

        // Process for alert scheduling
        await alertService.processContractForDates(contractId);

        return res.json({
            success: true,
            message: "Custom date added successfully"
        });
    } catch (error) {
        console.error("Error adding custom date:", error);
        return res.status(500).json({ error: "Failed to add custom date" });
    }
};

export const getUpcomingContractDates = async (req: Request, res: Response): Promise<Response> => {
    const user = req.user as IUser;
    const { days = 30 } = req.query;

    try {
        const daysAhead = Math.min(parseInt(days as string) || 30, 90); // Max 90 days
        const now = new Date();
        const futureDate = new Date(now.getTime() + (daysAhead * 24 * 60 * 60 * 1000));

        // Get all user's contracts with upcoming dates
        const contracts = await ContractAnalysisSchema.find({
            userId: user._id,
            'contractDates.date': { $gte: now, $lte: futureDate },
            'contractDates.isActive': true
        }).select('contractType contractDates _id').sort({ 'contractDates.date': 1 });

        // Flatten and sort all upcoming dates
        const upcomingDates: Array<{
            contractId: string;
            contractType: string;
            dateInfo: any;
            daysUntil: number;
            hasAlerts: boolean;
        }> = [];

        contracts.forEach(contract => {
            contract.contractDates?.forEach(dateInfo => {
                if (dateInfo.isActive && dateInfo.date >= now && dateInfo.date <= futureDate) {
                    const daysUntil = Math.ceil((dateInfo.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const hasAlerts = contract.dateAlerts?.some(alert => 
                        alert.contractDateId === dateInfo._id.toString() && alert.isActive
                    ) || false;

                    upcomingDates.push({
                        contractId: (contract._id as mongoose.Types.ObjectId).toString(),
                        contractType: contract.contractType,
                        dateInfo: dateInfo,
                        daysUntil: daysUntil,
                        hasAlerts: hasAlerts
                    });
                }
            });
        });

        // Sort by date
        upcomingDates.sort((a, b) => a.daysUntil - b.daysUntil);

        return res.json({
            upcomingDates: upcomingDates.slice(0, 50), // Limit to 50 results
            totalFound: upcomingDates.length,
            daysAhead: daysAhead
        });
    } catch (error) {
        console.error("Error getting upcoming dates:", error);
        return res.status(500).json({ error: "Failed to get upcoming dates" });
    }
};

export const getAlertStatistics = async (req: Request, res: Response): Promise<Response> => {
    const user = req.user as IUser;

    try {
        // Get user-specific stats
        const userContracts = await ContractAnalysisSchema.find({ userId: user._id });
        
        let totalDates = 0;
        let activeDates = 0;
        let totalAlerts = 0;
        let activeAlerts = 0;
        const dateTypes: { [key: string]: number } = {};

        userContracts.forEach(contract => {
            if (contract.contractDates) {
                totalDates += contract.contractDates.length;
                contract.contractDates.forEach(date => {
                    if (date.isActive) activeDates++;
                    dateTypes[date.dateType] = (dateTypes[date.dateType] || 0) + 1;
                });
            }
            
            if (contract.dateAlerts) {
                totalAlerts += contract.dateAlerts.length;
                activeAlerts += contract.dateAlerts.filter(alert => alert.isActive).length;
            }
        });

        // Get global stats (if user is interested)
        const globalStats = await alertService.getAlertStats();

        return res.json({
            userStats: {
                totalDates,
                activeDates,
                totalAlerts,
                activeAlerts,
                dateTypes,
                contractsWithDates: userContracts.filter(c => c.contractDates?.length > 0).length
            },
            globalStats: globalStats
        });
    } catch (error) {
        console.error("Error getting alert statistics:", error);
        return res.status(500).json({ error: "Failed to get alert statistics" });
    }
};

// EXISTING FUNCTIONS (unchanged)

export const getUserContracts = async (req: Request, res: Response): Promise<Response> => {
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
};

export const getContractByID = async (req: Request, res: Response): Promise<Response> => {
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
export const deleteContract = async (req: Request, res: Response): Promise<Response> => {
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

export const deleteContractDate = async (req: Request, res: Response): Promise<void> => {
    try {
        const { contractId, dateId } = req.params;
        const userId = req.user?._id;

        if (!userId) {
            res.status(401).json({ error: "User not authenticated" });
            return;
        }

        if (!contractId || !dateId) {
            res.status(400).json({ 
                error: "Contract ID and Date ID are required" 
            });
            return;
        }

        // Find the contract and verify ownership
        const contract = await ContractAnalysisSchema.findOne({
            _id: contractId,
            userId: userId
        });

        if (!contract) {
            res.status(404).json({ 
                error: "Contract not found or access denied" 
            });
            return;
        }

        // Check if the date exists
        const dateExists = contract.contractDates?.some(
            date => date._id.toString() === dateId
        );

        if (!dateExists) {
            res.status(404).json({ 
                error: "Contract date not found" 
            });
            return;
        }

        // Remove the contract date
        if (contract.contractDates) {
            contract.contractDates = contract.contractDates.filter(
                date => date._id.toString() !== dateId
            );
        }

        // Remove all associated alerts for this date
        if (contract.dateAlerts) {
            contract.dateAlerts = contract.dateAlerts.filter(
                alert => alert.contractDateId !== dateId
            );
        }

        // Save the updated contract
        await contract.save();

        console.log(`✅ Deleted contract date ${dateId} and associated alerts for contract ${contractId}`);

        res.status(200).json({
            success: true,
            message: "Contract date and associated alerts deleted successfully",
            contractId: contractId,
            deletedDateId: dateId
        });

    } catch (error) {
        console.error("Error deleting contract date:", error);
        
        res.status(500).json({
            error: "Failed to delete contract date",
            message: error instanceof Error ? error.message : "Unknown error occurred"
        });
    }
};

export const trackChanges = async (req: Request, res: Response): Promise<Response> => {
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
        const contract = await ContractAnalysisSchema.findOne({
            _id: contractId,
            userId: user._id,
        });
        
        if (!contract) {
            return res.status(404).json({ error: "Contract not found" });
        }
        
        // Get versions to compare
        let content1: string, content2: string;
        let version1Label: string, version2Label: string;
        
        // Get first version content
        if (version1 === "original" || version1 === "1") {
            content1 = contract.contractText;
            version1Label = "Original Version";
        } else {
            const mod1 = contract.modificationHistory?.find(
                m => m.version === parseInt(version1 as string)
            );
            if (!mod1 || !mod1.modifiedContent) {
                return res.status(404).json({ error: "Version 1 not found" });
            }
            content1 = mod1.modifiedContent;
            version1Label = `Version ${version1}`;
        }
        
        // Get second version content  
        if (version2 === "original" || version2 === "1") {
            content2 = contract.contractText;
            version2Label = "Original Version";
        } else {
            const mod2 = contract.modificationHistory?.find(
                m => m.version === parseInt(version2 as string)
            );
            if (!mod2 || !mod2.modifiedContent) {
                return res.status(404).json({ error: "Version 2 not found" });
            }
            content2 = mod2.modifiedContent;
            version2Label = `Version ${version2}`;
        }
        
        // Simple but effective change detection
        const changes = [];
        let totalChanges = 0;
        
        // Split content into paragraphs for comparison
        const paragraphs1 = content1.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        const paragraphs2 = content2.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        
        const maxParagraphs = Math.max(paragraphs1.length, paragraphs2.length);
        
        for (let i = 0; i < maxParagraphs; i++) {
            const para1 = paragraphs1[i]?.trim() || '';
            const para2 = paragraphs2[i]?.trim() || '';
            
            if (para1 !== para2) {
                totalChanges++;
                
                if (!para1 && para2) {
                    // Addition
                    changes.push({
                        type: "addition",
                        content: `Added new content: "${para2.substring(0, 100)}${para2.length > 100 ? '...' : ''}"`,
                        location: `Section ${i + 1}`,
                        context: `New content added in ${version2Label}`
                    });
                } else if (para1 && !para2) {
                    // Deletion
                    changes.push({
                        type: "deletion", 
                        content: `Removed content: "${para1.substring(0, 100)}${para1.length > 100 ? '...' : ''}"`,
                        location: `Section ${i + 1}`,
                        context: `Content removed in ${version2Label}`
                    });
                } else if (para1 && para2) {
                    // Modification
                    changes.push({
                        type: "modification",
                        content: `Modified content: "${para2.substring(0, 100)}${para2.length > 100 ? '...' : ''}"`,
                        location: `Section ${i + 1}`,
                        context: `Content changed from previous version`
                    });
                }
                
                // Limit to 20 changes for performance
                if (changes.length >= 20) break;
            }
        }
        
        return res.json({
            version1: version1,
            version2: version2,
            changes: changes,
            summary: `Comparison between ${version1Label} and ${version2Label}: ${totalChanges} total changes detected.`,
            totalChanges: totalChanges
        });
        
    } catch (error) {
        console.error("Error tracking changes:", error);
        return res.status(500).json({ error: "Failed to track changes" });
    }
};

// Helper function to detect changes between two versions
const detectChanges = (content1: string, content2: string, version1Info: any, version2Info: any) => {
    const changes: Array<{
        type: 'addition' | 'deletion' | 'modification';
        content: string;
        location: string;
        context: string;
        severity?: 'low' | 'medium' | 'high';
        lineNumber?: number;
    }> = [];
    
    // Split content into lines for comparison
    const lines1 = content1.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const lines2 = content2.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Simple line-by-line comparison (you can enhance this with proper diff algorithms)
    const maxLines = Math.max(lines1.length, lines2.length);
    
    for (let i = 0; i < maxLines; i++) {
        const line1 = lines1[i] || '';
        const line2 = lines2[i] || '';
        
        if (line1 !== line2) {
            if (!line1 && line2) {
                // Addition
                changes.push({
                    type: 'addition',
                    content: line2,
                    location: `Line ${i + 1}`,
                    context: `Added in ${version2Info.label}`,
                    severity: determineSeverity(line2),
                    lineNumber: i + 1
                });
            } else if (line1 && !line2) {
                // Deletion
                changes.push({
                    type: 'deletion',
                    content: line1,
                    location: `Line ${i + 1}`,
                    context: `Removed from ${version1Info.label}`,
                    severity: determineSeverity(line1),
                    lineNumber: i + 1
                });
            } else if (line1 && line2) {
                // Modification
                changes.push({
                    type: 'modification',
                    content: `"${line1}" → "${line2}"`,
                    location: `Line ${i + 1}`,
                    context: `Modified from ${version1Info.label} to ${version2Info.label}`,
                    severity: determineSeverity(line2),
                    lineNumber: i + 1
                });
            }
        }
    }
    
    // If no line-by-line changes found but content is different, detect paragraph-level changes
    if (changes.length === 0 && content1 !== content2) {
        const paragraphs1 = content1.split('\n\n').filter(p => p.trim().length > 0);
        const paragraphs2 = content2.split('\n\n').filter(p => p.trim().length > 0);
        
        for (let i = 0; i < Math.max(paragraphs1.length, paragraphs2.length); i++) {
            const para1 = paragraphs1[i] || '';
            const para2 = paragraphs2[i] || '';
            
            if (para1 !== para2) {
                if (!para1 && para2) {
                    changes.push({
                        type: 'addition',
                        content: para2.substring(0, 100) + (para2.length > 100 ? '...' : ''),
                        location: `Paragraph ${i + 1}`,
                        context: `New paragraph added in ${version2Info.label}`,
                        severity: determineSeverity(para2)
                    });
                } else if (para1 && !para2) {
                    changes.push({
                        type: 'deletion',
                        content: para1.substring(0, 100) + (para1.length > 100 ? '...' : ''),
                        location: `Paragraph ${i + 1}`,
                        context: `Paragraph removed from ${version1Info.label}`,
                        severity: determineSeverity(para1)
                    });
                } else {
                    changes.push({
                        type: 'modification',
                        content: `Paragraph modified (${para2.length - para1.length > 0 ? '+' : ''}${para2.length - para1.length} characters)`,
                        location: `Paragraph ${i + 1}`,
                        context: `Content modified from ${version1Info.label} to ${version2Info.label}`,
                        severity: determineSeverity(para2)
                    });
                }
            }
        }
    }
    
    return changes;
};

// Helper function to determine severity of changes
const determineSeverity = (content: string): 'low' | 'medium' | 'high' => {
    const lowercaseContent = content.toLowerCase();
    
    // High severity keywords
    const highSeverityKeywords = [
        'liability', 'termination', 'breach', 'penalty', 'damages', 'indemnity',
        'confidential', 'proprietary', 'intellectual property', 'copyright',
        'payment', 'fee', 'cost', 'price', 'amount', 'compensation'
    ];
    
    // Medium severity keywords
    const mediumSeverityKeywords = [
        'obligation', 'responsibility', 'requirement', 'deadline', 'timeline',
        'delivery', 'performance', 'standard', 'compliance', 'warranty'
    ];
    
    if (highSeverityKeywords.some(keyword => lowercaseContent.includes(keyword))) {
        return 'high';
    } else if (mediumSeverityKeywords.some(keyword => lowercaseContent.includes(keyword))) {
        return 'medium';
    }
    
    return 'low';
};

// Helper function to generate change summary
const generateChangeSummary = (changes: any[], version1Info: any, version2Info: any): string => {
    const totalChanges = changes.length;
    const additions = changes.filter(c => c.type === 'addition').length;
    const deletions = changes.filter(c => c.type === 'deletion').length;
    const modifications = changes.filter(c => c.type === 'modification').length;
    
    if (totalChanges === 0) {
        return `No changes detected between ${version1Info.label} and ${version2Info.label}.`;
    }
    
    let summary = `${totalChanges} change${totalChanges > 1 ? 's' : ''} detected between ${version1Info.label} and ${version2Info.label}. `;
    
    const changeParts = [];
    if (additions > 0) changeParts.push(`${additions} addition${additions > 1 ? 's' : ''}`);
    if (deletions > 0) changeParts.push(`${deletions} deletion${deletions > 1 ? 's' : ''}`);
    if (modifications > 0) changeParts.push(`${modifications} modification${modifications > 1 ? 's' : ''}`);
    
    summary += `This includes ${changeParts.join(', ')}.`;
    
    // Add severity assessment
    const highSeverityChanges = changes.filter(c => c.severity === 'high').length;
    if (highSeverityChanges > 0) {
        summary += ` ${highSeverityChanges} change${highSeverityChanges > 1 ? 's' : ''} marked as high severity requiring careful review.`;
    }
    
    return summary;
};

// Helper function to calculate impact level
const calculateImpactLevel = (changes: any[]): 'low' | 'medium' | 'high' => {
    const highSeverityCount = changes.filter(c => c.severity === 'high').length;
    const mediumSeverityCount = changes.filter(c => c.severity === 'medium').length;
    const totalChanges = changes.length;
    
    if (highSeverityCount > 0 || totalChanges > 10) {
        return 'high';
    } else if (mediumSeverityCount > 0 || totalChanges > 3) {
        return 'medium';
    }
    
    return 'low';
};

// Add version content viewing endpoint
export const getVersionContent = async (req: Request, res: Response): Promise<Response> => {
    const user = req.user as IUser;
    const { contractId, version } = req.params;
    
    if (!isvalidMongoId(contractId)) {
        return res.status(400).json({ error: "Invalid contract ID" });
    }
    
    try {
        const contract = await ContractAnalysisSchema.findOne({
            _id: contractId,
            userId: user._id,
        });
        
        if (!contract) {
            return res.status(404).json({ error: "Contract not found" });
        }
        
        let content: string;
        let versionInfo: any;
        
        if (version === "original" || version === "1") {
            content = contract.contractText;
            versionInfo = {
                version: "1",
                label: "Original Version",
                date: contract.createdAt,
                modifiedBy: "System",
                changes: "Initial contract upload"
            };
        } else {
            const modification = contract.modificationHistory?.find(
                m => m.version === parseInt(version)
            );
            
            if (!modification) {
                return res.status(404).json({ error: "Version not found" });
            }
            
            content = modification.modifiedContent || contract.contractText;
            versionInfo = {
                version: modification.version,
                label: `Version ${modification.version}`,
                date: modification.modifiedAt,
                modifiedBy: modification.modifiedBy,
                changes: modification.changes
            };
        }
        
        return res.json({
            contractId,
            versionInfo,
            content,
            metadata: {
                contractType: contract.contractType,
                wordCount: content.split(' ').length,
                characterCount: content.length,
                retrievedAt: new Date()
            }
        });
        
    } catch (error) {
        console.error("Error getting version content:", error);
        return res.status(500).json({ error: "Failed to get version content" });
    }
};

// New Gold endpoint: View contract content by version
export const viewContract = async (req: Request, res: Response): Promise<Response> => {
    const user = req.user as IUser;
    const { contractId, version } = req.params;
    
    // Check if user has Gold access for viewing different versions
    if (version !== "original" && !hasGoldAccess(user)) {
        return res.status(403).json({
            error: "Gold subscription required",
            message: "Viewing modified contract versions is only available for Gold subscribers"
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
        
        // Get the requested version content
        let contractContent: string;
        let versionInfo: string;
        
        if (version === "original" || version === "1") {
            contractContent = contract.contractText;
            versionInfo = "Original Version";
        } else {
            const versionNum = parseInt(version);
            const modification = contract.modificationHistory?.find(
                mod => mod.version === versionNum
            );
            
            if (!modification || !modification.modifiedContent) {
                return res.status(404).json({ error: "Contract version not found" });
            }
            
            contractContent = modification.modifiedContent;
            versionInfo = `Version ${versionNum} - Modified on ${new Date(modification.modifiedAt).toLocaleDateString()}`;
        }
        
        return res.json({
            content: contractContent,
            version: version,
            versionInfo: versionInfo,
            contractType: contract.contractType,
            contractId: contractId
        });
        
    } catch (error) {
        console.error("Error viewing contract:", error);
        return res.status(500).json({ error: "Failed to view contract" });
    }
};

export const reAnalyzeContract = async (req: Request, res: Response): Promise<Response> => {
    const user = req.user as IUser;
    const { contractId, version, contractContent, contractType, versionNumber } = req.body;
    
    // Check if user has premium access for re-analysis
    if (!hasPremiumAccess(user)) {
        return res.status(403).json({
            error: "Premium subscription required",
            message: "Re-analysis is only available for Premium and Gold subscribers"
        });
    }

    // Validate required fields
    if (!contractId || !contractContent) {
        return res.status(400).json({ 
            error: "Missing required fields",
            message: "Contract ID and content are required for re-analysis" 
        });
    }

    if (!isvalidMongoId(contractId)) {
        return res.status(400).json({ error: "Invalid contract ID" });
    }

    try {
        // Verify contract ownership
        const contract = await ContractAnalysisSchema.findOne({
            _id: contractId,
            userId: user._id,
        });

        if (!contract) {
            return res.status(404).json({ error: "Contract not found" });
        }

        // Get user's plan for analysis
        const userPlan = getUserPlanLevel(user);

        // Re-analyze the contract content with AI
        console.log(`Re-analyzing contract ${contractId} version ${versionNumber || 0} for user ${user.email}`);
        
        let analysis: any;
        try {
            analysis = await analyzeContractWithAI(contractContent, userPlan, contractType || contract.contractType);
            
            // Parse the AI response if it's a string
            if (typeof analysis === 'string') {
                analysis = JSON.parse(analysis);
            }
        } catch (parseError) {
            console.error("Failed to parse AI response:", parseError);
            throw new Error("Failed to parse AI analysis response");
        }

        // Validate analysis result
        if (!analysis || typeof analysis !== 'object') {
            throw new Error("Invalid analysis result received");
        }

        // Prepare the response with re-analysis results
        const reAnalysisResult = {
            contractId: contractId,
            version: versionNumber || 0,
            overallScore: analysis.overallScore || 0,
            summary: analysis.summary || "No summary available",
            risks: analysis.risks || [],
            opportunities: analysis.opportunities || [],
            recommendations: analysis.recommendations || [],
            keyClauses: analysis.keyClauses || [],
            legalCompliance: analysis.legalCompliance || "",
            negotiationPoints: analysis.negotiationPoints || [],
            contractDuration: analysis.contractDuration || "",
            terminationConditions: analysis.terminationConditions || "",
            financialTerms: analysis.financialTerms || { description: "", details: [] },
            performanceMetrics: analysis.performanceMetrics || [],
            specificClauses: analysis.specificClauses || "",
            intellectualPropertyClauses: analysis.intellectualPropertyClauses || [],
            analysisDate: new Date().toISOString(),
            userPlan: userPlan,
            isReAnalysis: true
        };

        // For Gold users, optionally save re-analysis history
        if (hasGoldAccess(user)) {
            try {
                // You might want to create a separate collection for re-analysis results
                // or add them to the contract document as you prefer
                
                // Option 1: Add to contract's custom field (simple approach)
                if (!contract.customFields) {
                    contract.customFields = {};
                }
                
                const reAnalysisKey = `reanalysis_v${versionNumber || 0}_${Date.now()}`;
                contract.customFields[reAnalysisKey] = JSON.stringify({
                    version: versionNumber || 0,
                    overallScore: analysis.overallScore,
                    summary: analysis.summary,
                    analysisDate: new Date(),
                    risks: analysis.risks?.length || 0,
                    opportunities: analysis.opportunities?.length || 0
                });
                
                await contract.save();
                console.log(`Re-analysis history saved for contract ${contractId}`);
                
            } catch (saveError) {
                console.error("Failed to save re-analysis history:", saveError);
                // Don't fail the request if history saving fails
            }
        }

        console.log(`Re-analysis completed for contract ${contractId}, score: ${analysis.overallScore}`);

        return res.status(200).json(reAnalysisResult);

    } catch (error: any) {
        console.error("Re-analysis error:", error);
        
        let errorMessage = "Failed to re-analyze contract";
        let statusCode = 500;

        if (error.message?.includes("AI analysis")) {
            errorMessage = "AI analysis service temporarily unavailable";
            statusCode = 503;
        } else if (error.message?.includes("parse")) {
            errorMessage = "Failed to process analysis results";
        } else if (error.message?.includes("quota") || error.message?.includes("limit")) {
            errorMessage = "Analysis service quota exceeded, please try again later";
            statusCode = 429;
        }

        return res.status(statusCode).json({ 
            error: errorMessage,
            message: error instanceof Error ? error.message : "Unknown error occurred",
            contractId: contractId
        });
    }
};

// Add this function to get re-analysis results history
export const getReAnalysisResults = async (req: Request, res: Response): Promise<Response> => {
    const user = req.user as IUser;
    const { contractId } = req.params;

    if (!hasPremiumAccess(user)) {
        return res.status(403).json({
            error: "Premium subscription required",
            message: "Re-analysis history is only available for Premium and Gold subscribers"
        });
    }

    if (!isvalidMongoId(contractId)) {
        return res.status(400).json({ error: "Invalid contract ID" });
    }

    try {
        const contract = await ContractAnalysisSchema.findOne({
            _id: contractId,
            userId: user._id,
        });

        if (!contract) {
            return res.status(404).json({ error: "Contract not found" });
        }

        // Extract re-analysis results from custom fields
        const reAnalysisResults: any[] = [];
        
        if (contract.customFields) {
            Object.entries(contract.customFields).forEach(([key, value]) => {
                if (key.startsWith('reanalysis_')) {
                    try {
                        const parsedResult = JSON.parse(value as string);
                        reAnalysisResults.push(parsedResult);
                    } catch (parseError) {
                        console.error("Error parsing re-analysis result:", parseError);
                    }
                }
            });
        }

        // Sort by analysis date
        reAnalysisResults.sort((a, b) => new Date(b.analysisDate).getTime() - new Date(a.analysisDate).getTime());

        return res.status(200).json({
            contractId: contractId,
            results: reAnalysisResults,
            totalResults: reAnalysisResults.length
        });

    } catch (error) {
        console.error("Error getting re-analysis results:", error);
        return res.status(500).json({ 
            error: "Failed to get re-analysis results",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
};

