import mongoose, { Document, Schema } from "mongoose";
import { IUser } from "./user.model";

interface IRisk {
    risk: string;
    explanation: string;
    severity: "low" | "medium" | "high";
}

interface IOpportunity {
    opportunity: string;
    explanation: string;
    impact: "low" | "medium" | "high";
}

interface ICompensationStructure {
    baseSalary: string;
    bonuses: string;
    equity: string;
    otherBenefits: string;
}

interface IModificationHistory {
    modifiedAt: Date;
    modifiedBy: string;
    changes: string;
    version: number;
    modifiedContent?: string; // Store the modified contract content
}

interface IChatHistory {
    message: string;
    response: string;
    timestamp: Date;
}

interface ICustomRecommendation {
    generatedAt: Date;
    focusAreas: string[];
    recommendations: string[];
}

interface IContractDate {
    _id: any;
    dateType: 'start_date' | 'end_date' | 'renewal_date' | 'termination_notice' | 'payment_due' | 'review_date' | 'warranty_expiry' | 'other';
    date: Date;
    description: string;
    clause: string; // The specific clause text containing this date
    isActive: boolean; // Whether alerts are enabled for this date
}

interface IDateAlert {
    contractDateId: string; // Reference to the contract date
    reminderDays: number; // Days before the date to send reminder (1, 3, 7, 14, 30)
    isActive: boolean;
    emailSent: boolean;
    scheduledDate: Date; // When to send the alert
    createdAt: Date;
}

export interface IContractAnalysis extends Document {
    userId: IUser["_id"];
    projectId: mongoose.Types.ObjectId;
    contractText: string;
    risks: IRisk[];
    opportunities: IOpportunity[];
    summary: string;
    recommendations: string[];
    keyClauses: string[];
    legalCompliance: string;
    negotiationPoints: string[];
    contractDuration: string;
    terminationConditions: string;
    overallScore: number | string;
    compensationStructure: ICompensationStructure;
    performanceMetrics: string[];
    intellectualPropertyClauses: string | string[];
    createdAt: Date;
    version: number;
    userFeedback: {
        rating: number;
        comments: string;
    };
    customFields: { [key: string]: string };
    expirationDate: Date;
    language: string;
    aimodel: string;
    contractType: string;
    financialTerms?: {
        description: string;
        details: string[];
    };
    specificClauses?: string;
    userPlan: "basic" | "premium" | "gold";
    // Gold-specific fields
    modificationHistory?: IModificationHistory[];
    chatHistory?: IChatHistory[];
    customRecommendations?: ICustomRecommendation[];
    originalFile?: Buffer; // Store original PDF for Gold users
    hasStoredDocument?: boolean; // Track if document is stored
    lastModified?: Date; // Track last modification date
    totalModifications?: number; // Track total number of modifications
    // Methods
    getLatestVersion(): number;
    getVersion(versionNumber: number): string | null;
    contractDates: IContractDate[];
    dateAlerts: IDateAlert[];
    addContractDate(dateType: string, date: Date, description: string, clause: string): Promise<IContractAnalysis>;
    toggleDateAlert(dateId: string, reminderDays: number, isActive: boolean): Promise<IContractAnalysis>;
    getUpcomingDates(daysAhead?: number): IContractDate[];
}


const ContractAnalysisSchema = new Schema({
    userId: { 
        type: Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
    },
    projectId: { 
        type: Schema.Types.ObjectId, 
        ref: "Project", 
        required: true,
        default: () => new mongoose.Types.ObjectId()
    },
    contractText: { 
        type: String, 
        required: true 
    },
    risks: [{ 
        risk: String, 
        explanation: String, 
        severity: {
            type: String,
            enum: ["low", "medium", "high"]
        }
    }],
    opportunities: [{ 
        opportunity: String, 
        explanation: String, 
        impact: {
            type: String,
            enum: ["low", "medium", "high"]
        }
    }],
    summary: { 
        type: String, 
        required: true 
    },
    recommendations: [{ 
        type: String 
    }],
    keyClauses: [{ 
        type: String 
    }],
    legalCompliance: { 
        type: String 
    },
    negotiationPoints: [{ 
        type: String 
    }],
    contractDuration: { 
        type: String 
    },
    terminationConditions: { 
        type: String 
    },
    overallScore: { 
        type: Schema.Types.Mixed,
        validate: {
            validator: function(v: any) {
                return (
                    typeof v === "number" || 
                    (typeof v === "string" && !isNaN(Number(v)))
                );
            },
            message: (props: { value: any }) => 
                `${props.value} is not a valid score number or string!`,
        },
    },
    compensationStructure: {
        baseSalary: String,
        bonuses: String,
        equity: String,
        otherBenefits: String
    },
    performanceMetrics: [{ 
        type: String 
    }],
    intellectualPropertyClauses: {
        type: Schema.Types.Mixed,
        validate: {
            validator: function(v: any) {
                return (
                    typeof v === "string" ||
                    (Array.isArray(v) && v.every((item) => typeof item === "string"))
                );
            },
            message: (props: { value: any }) => 
                `${props.value} is not a valid string or array of strings!`,
        },
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    version: { 
        type: Number, 
        default: 1 
    },
    userFeedback: {
        rating: { 
            type: Number, 
            min: 1, 
            max: 5 
        },
        comments: String,
    },
    customFields: { 
        type: Map, 
        of: String 
    },
    expirationDate: { 
        type: Date, 
        required: false 
    },
    language: { 
        type: String, 
        default: "en" 
    },
    aimodel: { 
        type: String, 
        default: "gemini-2.0-flash"
    },
    contractType: { 
        type: String, 
        required: true 
    },
    financialTerms: {
        description: String,
        details: [String],
    },
    specificClauses: {
        type: String
    },
    userPlan: {
        type: String,
        enum: ["basic", "premium", "gold"],
        default: "basic"
    },
     contractDates: [{
        dateType: {
            type: String,
            enum: ['start_date', 'end_date', 'renewal_date', 'termination_notice', 'payment_due', 'review_date', 'warranty_expiry', 'other'],
            required: true
        },
        date: {
            type: Date,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        clause: {
            type: String,
            required: true
        },
        isActive: {
            type: Boolean,
            default: true
        },
        _id: {
            type: Schema.Types.ObjectId,
            default: () => new mongoose.Types.ObjectId()
        }
    }],
    
    dateAlerts: [{
        contractDateId: {
            type: String,
            required: true
        },
        reminderDays: {
            type: Number,
            enum: [1, 3, 7, 14, 30],
            required: true
        },
        isActive: {
            type: Boolean,
            default: true
        },
        emailSent: {
            type: Boolean,
            default: false
        },
        scheduledDate: {
            type: Date,
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    // Gold-specific fields
    modificationHistory: [{
        modifiedAt: {
            type: Date,
            default: Date.now
        },
        modifiedBy: {
            type: String,
            required: true
        },
        changes: {
            type: String,
            required: true
        },
        version: {
            type: Number,
            required: true
        },
        modifiedContent: {
            type: String,
            required: false
        }
    }],
    chatHistory: [{
        message: {
            type: String,
            required: true
        },
        response: {
            type: String,
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    customRecommendations: [{
        generatedAt: {
            type: Date,
            default: Date.now
        },
        focusAreas: [{
            type: String
        }],
        recommendations: [{
            type: String
        }]
    }],
    originalFile: {
        type: Buffer,
        required: false,
        select: false // Don't include in queries by default (large field)
    },
    hasStoredDocument: {
        type: Boolean,
        default: false
    },
    lastModified: {
        type: Date,
        required: false
    },
    totalModifications: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true, // Adds createdAt and updatedAt automatically
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Add indexes for better performance
ContractAnalysisSchema.index({ userId: 1, createdAt: -1 });
ContractAnalysisSchema.index({ userId: 1, contractType: 1 });
ContractAnalysisSchema.index({ userId: 1, userPlan: 1 });

// Virtual field to check if contract has been modified
ContractAnalysisSchema.virtual('hasModifications').get(function() {
    return this.modificationHistory && this.modificationHistory.length > 0;
});

// Virtual field to get the current version number
ContractAnalysisSchema.virtual('currentVersion').get(function() {
    if (!this.modificationHistory || this.modificationHistory.length === 0) {
        return 1;
    }
    return Math.max(...this.modificationHistory.map(m => m.version));
});

// Virtual field to check if chat feature has been used
ContractAnalysisSchema.virtual('hasChatHistory').get(function() {
    return this.chatHistory && this.chatHistory.length > 0;
});

// Method to get latest version number
ContractAnalysisSchema.methods.getLatestVersion = function() {
    if (!this.modificationHistory || this.modificationHistory.length === 0) {
        return 1; // Original version
    }
    return Math.max(...this.modificationHistory.map((m: { version: any; }) => m.version));
};

// Method to get a specific version of the contract
ContractAnalysisSchema.methods.getVersion = function(versionNumber: number) {
    if (versionNumber === 1) {
        return this.contractText;
    }
    const modification = this.modificationHistory?.find((m: { version: number; }) => m.version === versionNumber);
    return modification?.modifiedContent || null;
};

// Method to get all versions list
ContractAnalysisSchema.methods.getAllVersions = function() {
    const versions = [{
        version: 1,
        date: this.createdAt,
        modifiedBy: 'Original',
        changes: 'Initial contract upload'
    }];
    
    if (this.modificationHistory && this.modificationHistory.length > 0) {
        this.modificationHistory.forEach((mod: { version: any; modifiedAt: any; modifiedBy: any; changes: any; }) => {
            versions.push({
                version: mod.version,
                date: mod.modifiedAt,
                modifiedBy: mod.modifiedBy,
                changes: mod.changes
            });
        });
    }
    
    return versions.sort((a, b) => a.version - b.version);
};

// Method to add a new modification
ContractAnalysisSchema.methods.addModification = function(
    modifiedBy: string, 
    changes: string, 
    modifiedContent: string
) {
    const newVersion = this.getLatestVersion() + 1;
    
    if (!this.modificationHistory) {
        this.modificationHistory = [];
    }
    
    this.modificationHistory.push({
        modifiedAt: new Date(),
        modifiedBy: modifiedBy,
        changes: changes,
        version: newVersion,
        modifiedContent: modifiedContent
    });
    
    this.lastModified = new Date();
    this.totalModifications = (this.totalModifications || 0) + 1;
    
    return this.save();
};

// Method to add chat interaction
ContractAnalysisSchema.methods.addChatInteraction = function(
    message: string,
    response: string
) {
    if (!this.chatHistory) {
        this.chatHistory = [];
    }
    
    this.chatHistory.push({
        message: message,
        response: response,
        timestamp: new Date()
    });
    
    return this.save();
};

// Method to get chat history summary
ContractAnalysisSchema.methods.getChatSummary = function() {
    if (!this.chatHistory || this.chatHistory.length === 0) {
        return null;
    }
    
    return {
        totalInteractions: this.chatHistory.length,
        firstInteraction: this.chatHistory[0].timestamp,
        lastInteraction: this.chatHistory[this.chatHistory.length - 1].timestamp,
        recentMessages: this.chatHistory.slice(-5) // Last 5 messages
    };
};

// Method to check if user can modify (Gold plan only)
ContractAnalysisSchema.methods.canModify = function() {
    return this.userPlan === "gold";
};

// Method to check if user can chat (Gold plan only)
ContractAnalysisSchema.methods.canChat = function() {
    return this.userPlan === "gold";
};

// Method to get modification summary
ContractAnalysisSchema.methods.getModificationSummary = function() {
    if (!this.modificationHistory || this.modificationHistory.length === 0) {
        return {
            hasModifications: false,
            totalModifications: 0,
            versions: [1]
        };
    }
    
    return {
        hasModifications: true,
        totalModifications: this.modificationHistory.length,
        lastModified: this.lastModified || this.modificationHistory[this.modificationHistory.length - 1].modifiedAt,
        versions: [1, ...this.modificationHistory.map((m: { version: any; }) => m.version)],
        latestVersion: this.getLatestVersion()
    };
};

// Pre-save middleware to update lastModified
ContractAnalysisSchema.pre('save', function(next) {
    if (this.isModified('modificationHistory') && this.modificationHistory && this.modificationHistory.length > 0) {
        this.lastModified = new Date();
    }
    next();
});

// Static method to find contracts with modifications
ContractAnalysisSchema.statics.findWithModifications = function(userId: mongoose.Types.ObjectId) {
    return this.find({
        userId: userId,
        'modificationHistory.0': { $exists: true }
    });
};

// Static method to find contracts with chat history
ContractAnalysisSchema.statics.findWithChatHistory = function(userId: mongoose.Types.ObjectId) {
    return this.find({
        userId: userId,
        'chatHistory.0': { $exists: true }
    });
};


ContractAnalysisSchema.methods.addContractDate = function(
    dateType: string, 
    date: Date, 
    description: string, 
    clause: string
): Promise<IContractAnalysis> {
    if (!this.contractDates) {
        this.contractDates = [];
    }
    
    const contractDate: IContractDate = {
        dateType: dateType as any,
        date: date,
        description: description,
        clause: clause,
        isActive: true,
        _id: undefined
    };
    
    this.contractDates.push(contractDate);
    return this.save();
};

ContractAnalysisSchema.methods.toggleDateAlert = function(
    dateId: string, 
    reminderDays: number, 
    isActive: boolean
): Promise<IContractAnalysis> {
    if (!this.dateAlerts) {
        this.dateAlerts = [];
    }
    
    // Find existing alert
    const existingAlert = this.dateAlerts.find(
        (alert: IDateAlert) => alert.contractDateId === dateId && alert.reminderDays === reminderDays
    );
    
    if (existingAlert) {
        existingAlert.isActive = isActive;
        if (isActive && !existingAlert.emailSent) {
            // Recalculate scheduled date
            const contractDate = this.contractDates.find((cd: IContractDate) => cd._id.toString() === dateId);
            if (contractDate) {
                existingAlert.scheduledDate = new Date(contractDate.date.getTime() - (reminderDays * 24 * 60 * 60 * 1000));
            }
        }
    } else if (isActive) {
        // Create new alert
        const contractDate = this.contractDates.find((cd: IContractDate) => cd._id.toString() === dateId);
        if (contractDate) {
            const scheduledDate = new Date(contractDate.date.getTime() - (reminderDays * 24 * 60 * 60 * 1000));
            
            const newAlert: IDateAlert = {
                contractDateId: dateId,
                reminderDays: reminderDays,
                isActive: true,
                emailSent: false,
                scheduledDate: scheduledDate,
                createdAt: new Date()
            };
            
            this.dateAlerts.push(newAlert);
        }
    }
    
    return this.save();
};

ContractAnalysisSchema.methods.getUpcomingDates = function(daysAhead: number = 30): IContractDate[] {
    const now = new Date();
    const futureDate = new Date(now.getTime() + (daysAhead * 24 * 60 * 60 * 1000));
    
    return (this.contractDates || []).filter((date: IContractDate) => 
        date.isActive && date.date >= now && date.date <= futureDate
    ).sort((a: IContractDate, b: IContractDate) => a.date.getTime() - b.date.getTime());
};

// Add index for efficient querying of alerts
ContractAnalysisSchema.index({ 'dateAlerts.scheduledDate': 1, 'dateAlerts.isActive': 1, 'dateAlerts.emailSent': 1 });
ContractAnalysisSchema.index({ 'contractDates.date': 1, 'contractDates.isActive': 1 });


// Static method to get user statistics
ContractAnalysisSchema.statics.getUserStatistics = async function(userId: mongoose.Types.ObjectId) {
    const contracts = await this.find({ userId });
    
    const stats = {
        totalContracts: contracts.length,
        contractsByType: {} as { [key: string]: number },
        totalModifications: 0,
        totalChatInteractions: 0,
        contractsWithModifications: 0,
        contractsWithChat: 0,
        averageScore: 0
    };
    
    let totalScore = 0;
    let scoreCount = 0;
    
    contracts.forEach((contract: { contractType: string | number; modificationHistory: string | any[]; chatHistory: string | any[]; overallScore: string; }) => {
        // Count by type
        stats.contractsByType[contract.contractType] = (stats.contractsByType[contract.contractType] || 0) + 1;
        
        // Count modifications
        if (contract.modificationHistory && contract.modificationHistory.length > 0) {
            stats.totalModifications += contract.modificationHistory.length;
            stats.contractsWithModifications++;
        }
        
        // Count chat interactions
        if (contract.chatHistory && contract.chatHistory.length > 0) {
            stats.totalChatInteractions += contract.chatHistory.length;
            stats.contractsWithChat++;
        }
        
        // Calculate average score
        if (contract.overallScore) {
            const score = typeof contract.overallScore === 'string' ? parseFloat(contract.overallScore) : contract.overallScore;
            if (!isNaN(score)) {
                totalScore += score;
                scoreCount++;
            }
        }
    });
    
    if (scoreCount > 0) {
        stats.averageScore = totalScore / scoreCount;
    }
    
    return stats;
};

export default mongoose.model<IContractAnalysis>(
    "ContractAnalysis",
    ContractAnalysisSchema
);