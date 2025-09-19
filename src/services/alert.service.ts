// src/services/alert.service.ts - FIXED VERSION WITH ALL ISSUES RESOLVED

import cron from 'node-cron';
import mongoose from 'mongoose';
import ContractAnalysisSchema from '../models/contract.model';
import User from '../models/user.model';
import { sendDateAlertEmail } from './email.service';
import { extractContractDates } from './ai.services';

export class AlertService {
    private isRunning = false;

    // Initialize the alert service
    public init(): void {
        if (this.isRunning) {
            console.log('Alert service already running');
            return;
        }

        // Run every hour to check for alerts
        cron.schedule('0 * * * *', async () => {
            await this.checkAndSendAlerts();
        });

        // Run every day at 9 AM to schedule new alerts
        cron.schedule('0 9 * * *', async () => {
            await this.scheduleUpcomingAlerts();
        });

        this.isRunning = true;
        console.log('🔔 Alert service initialized and running');
    }

    // Check and send due alerts - FIXED VERSION
    private async checkAndSendAlerts(): Promise<void> {
        try {
            const now = new Date();
            console.log('Checking for due alerts at:', now.toISOString());

            // FIXED: Use $elemMatch for proper nested query
            const contracts = await ContractAnalysisSchema.find({
                'dateAlerts': {
                    $elemMatch: {
                        'scheduledDate': { $lte: now },
                        'isActive': true,
                        'emailSent': false
                    }
                }
            }).populate('userId');

            console.log(`Found ${contracts.length} contracts with due alerts`);

            for (const contract of contracts) {
                const user = contract.userId as any;
                if (!user || !user.email) {
                    console.log('Skipping contract - no user or email found');
                    continue;
                }

                const dueAlerts = contract.dateAlerts.filter(
                    alert => alert.scheduledDate <= now && 
                             alert.isActive && 
                             !alert.emailSent
                );

                console.log(`Processing ${dueAlerts.length} due alerts for contract ${contract._id}`);

                for (const alert of dueAlerts) {
                    try {
                        // Find the corresponding contract date
                        const contractDate = contract.contractDates.find(
                            cd => cd._id.toString() === alert.contractDateId
                        );

                        if (!contractDate) {
                            console.log('Contract date not found for alert:', alert.contractDateId);
                            continue;
                        }

                        // Calculate days until the actual date
                        const daysUntil = Math.ceil(
                            (contractDate.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                        );

                        console.log(`Sending email alert:`, {
                            userEmail: user.email,
                            contractType: contract.contractType,
                            description: contractDate.description,
                            daysUntil: Math.max(0, daysUntil)
                        });

                        // Send alert email
                        await sendDateAlertEmail(
                            user.email,
                            user.displayName || user.email,
                            (contract._id as mongoose.Types.ObjectId).toString(),
                            contract.contractType,
                            {
                                dateType: contractDate.dateType,
                                date: contractDate.date,
                                description: contractDate.description,
                                clause: contractDate.clause,
                                daysUntil: Math.max(0, daysUntil)
                            }
                        );

                        // Mark alert as sent
                        alert.emailSent = true;
                        console.log(`✅ Alert sent for contract ${contract._id}, date ${contractDate.description}`);
                        
                    } catch (emailError) {
                        console.error(`❌ Failed to send alert for contract ${contract._id}:`, emailError);
                    }
                }

                // Save the contract with updated alert statuses
                await contract.save();
            }

        } catch (error) {
            console.error('Error checking and sending alerts:', error);
        }
    }

    // Schedule alerts for upcoming dates (run daily) - FIXED VERSION
    private async scheduleUpcomingAlerts(): Promise<void> {
        try {
            const now = new Date();
            const futureLimit = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000)); // 90 days ahead

            console.log('📅 Scheduling upcoming alerts...');

            // Find contracts with upcoming dates that don't have all their alerts scheduled
            const contracts = await ContractAnalysisSchema.find({
                'contractDates.date': { $gte: now, $lte: futureLimit },
                'contractDates.isActive': true
            });

            for (const contract of contracts) {
                let contractModified = false;

                for (const contractDate of contract.contractDates) {
                    if (!contractDate.isActive) continue;
                    if (contractDate.date < now || contractDate.date > futureLimit) continue;

                    const dateId = contractDate._id.toString();
                    const reminderOptions = [1, 3, 7, 14, 30]; // Standard reminder intervals

                    for (const days of reminderOptions) {
                        const scheduledDate = new Date(contractDate.date.getTime() - (days * 24 * 60 * 60 * 1000));
                        
                        // Skip if scheduled date is in the past
                        if (scheduledDate < now) continue;

                        // Check if alert already exists
                        const existingAlert = contract.dateAlerts.find(
                            alert => alert.contractDateId === dateId && 
                                   alert.reminderDays === days
                        );

                        if (!existingAlert) {
                            // Create new alert with isActive: true 
                            contract.dateAlerts.push({
                                contractDateId: dateId,
                                reminderDays: days,
                                isActive: true,
                                emailSent: false,
                                scheduledDate: scheduledDate,
                                createdAt: new Date()
                            });
                            contractModified = true;
                            console.log(`Created alert: ${days}d before ${contractDate.description} (scheduled: ${scheduledDate})`);
                        }
                    }
                }

                if (contractModified) {
                    await contract.save();
                    console.log(`🔔 Scheduled alerts for contract ${contract._id}`);
                }
            }

        } catch (error) {
            console.error('Error scheduling upcoming alerts:', error);
        }
    }

    // FIXED: Add method to force create alert
    public async forceCreateAlert(contractId: string, dateId: string, reminderDays: number): Promise<void> {
        try {
            const contract = await ContractAnalysisSchema.findById(contractId);
            if (!contract) throw new Error('Contract not found');

            const contractDate = contract.contractDates?.find(cd => cd._id.toString() === dateId);
            if (!contractDate) throw new Error('Contract date not found');

            const scheduledDate = new Date(contractDate.date.getTime() - (reminderDays * 24 * 60 * 60 * 1000));
            
            // Remove existing alert for this combination
            contract.dateAlerts = contract.dateAlerts?.filter(alert => 
                !(alert.contractDateId === dateId && alert.reminderDays === reminderDays)
            ) || [];

            // Add new alert
            contract.dateAlerts.push({
                contractDateId: dateId,
                reminderDays: reminderDays,
                isActive: true,
                emailSent: false,
                scheduledDate: scheduledDate,
                createdAt: new Date()
            });

            await contract.save();
        } catch (error) {
            console.error('Error force creating alert:', error);
            throw error;
        }
    }

    // Manual method to process contract for date extraction and alert setup
    public async processContractForDates(contractId: string): Promise<void> {
        try {
            const contract = await ContractAnalysisSchema.findById(contractId);
            if (!contract) {
                console.log(`Contract ${contractId} not found for date processing`);
                return;
            }

            // Extract dates using AI if not already done
            if (!contract.contractDates || contract.contractDates.length === 0) {
                try {
                    const extractedDates = await extractContractDates(
                        contract.contractText,
                        contract.contractType
                    );

                    if (extractedDates.dates.length > 0) {
                        contract.contractDates = extractedDates.dates.map(dateInfo => ({
                            _id: new mongoose.Types.ObjectId(),
                            dateType: dateInfo.dateType as any,
                            date: new Date(dateInfo.date),
                            description: dateInfo.description,
                            clause: dateInfo.clause,
                            isActive: dateInfo.confidence === 'high' // Auto-activate high confidence dates
                        }));

                        await contract.save();
                        console.log(`📅 Extracted and saved ${extractedDates.dates.length} dates for contract ${contractId}`);
                    }
                } catch (extractError) {
                    console.error(`Error extracting dates for contract ${contractId}:`, extractError);
                }
            }

            // Schedule alerts for the extracted dates
            await this.scheduleUpcomingAlerts();

        } catch (error) {
            console.error(`Error processing contract ${contractId} for dates:`, error);
        }
    }

    // Get alert statistics
    public async getAlertStats(): Promise<{
        totalActiveAlerts: number;
        alertsDueToday: number;
        alertsDueThisWeek: number;
        totalContractsWithDates: number;
    }> {
        try {
            const now = new Date();
            const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
            const weekEnd = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));

            const [totalActiveAlerts, alertsDueToday, alertsDueThisWeek, totalContractsWithDates] = await Promise.all([
                ContractAnalysisSchema.countDocuments({
                    'dateAlerts.isActive': true,
                    'dateAlerts.emailSent': false
                }),
                ContractAnalysisSchema.countDocuments({
                    'dateAlerts.scheduledDate': { $gte: now, $lte: todayEnd },
                    'dateAlerts.isActive': true,
                    'dateAlerts.emailSent': false
                }),
                ContractAnalysisSchema.countDocuments({
                    'dateAlerts.scheduledDate': { $gte: now, $lte: weekEnd },
                    'dateAlerts.isActive': true,
                    'dateAlerts.emailSent': false
                }),
                ContractAnalysisSchema.countDocuments({
                    'contractDates.0': { $exists: true }
                })
            ]);

            return {
                totalActiveAlerts,
                alertsDueToday,
                alertsDueThisWeek,
                totalContractsWithDates
            };
        } catch (error) {
            console.error('Error getting alert stats:', error);
            return {
                totalActiveAlerts: 0,
                alertsDueToday: 0,
                alertsDueThisWeek: 0,
                totalContractsWithDates: 0
            };
        }
    }

    // Process all existing contracts to extract dates (one-time migration)
    public async processAllContractsForDates(): Promise<void> {
        try {
            console.log('🔄 Processing all contracts for date extraction...');
            
            // Get all contracts that don't have dates extracted yet
            const contracts = await ContractAnalysisSchema.find({
                $or: [
                    { contractDates: { $exists: false } },
                    { contractDates: { $size: 0 } }
                ]
            });

            console.log(`Found ${contracts.length} contracts to process`);

            let processed = 0;
            let errors = 0;

            for (const contract of contracts) {
                try {
                    await this.processContractForDates((contract._id as mongoose.Types.ObjectId).toString());
                    processed++;
                    
                    // Add small delay to avoid API rate limits
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    if (processed % 10 === 0) {
                        console.log(`✅ Processed ${processed}/${contracts.length} contracts`);
                    }
                } catch (error) {
                    errors++;
                    console.error(`❌ Error processing contract ${contract._id}:`, error);
                }
            }

            console.log(`🎉 Date extraction complete: ${processed} processed, ${errors} errors`);
        } catch (error) {
            console.error('Error in bulk contract processing:', error);
        }
    }

    // Manual trigger for immediate alert check (for testing)
    public async triggerImmediateCheck(): Promise<void> {
        console.log('🔄 Manually triggering alert check...');
        await this.checkAndSendAlerts();
    }

    // Get upcoming alerts for a user
    public async getUserUpcomingAlerts(userId: string, days: number = 30): Promise<any[]> {
        try {
            const now = new Date();
            const futureDate = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));

            const contracts = await ContractAnalysisSchema.find({
                userId: userId,
                'dateAlerts.scheduledDate': { $gte: now, $lte: futureDate },
                'dateAlerts.isActive': true,
                'dateAlerts.emailSent': false
            });

            const upcomingAlerts: any[] = [];

            contracts.forEach(contract => {
                contract.dateAlerts?.forEach(alert => {
                    if (alert.isActive && 
                        !alert.emailSent && 
                        alert.scheduledDate >= now && 
                        alert.scheduledDate <= futureDate) {
                        
                        const contractDate = contract.contractDates?.find(
                            cd => cd._id.toString() === alert.contractDateId
                        );

                        if (contractDate) {
                            upcomingAlerts.push({
                                contractId: contract._id,
                                contractType: contract.contractType,
                                alert: alert,
                                dateInfo: contractDate,
                                daysUntilAlert: Math.ceil(
                                    (alert.scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                                )
                            });
                        }
                    }
                });
            });

            return upcomingAlerts.sort((a, b) => 
                a.alert.scheduledDate.getTime() - b.alert.scheduledDate.getTime()
            );

        } catch (error) {
            console.error('Error getting user upcoming alerts:', error);
            return [];
        }
    }

    // Cleanup old alerts (alerts for dates that have passed)
    public async cleanupOldAlerts(): Promise<void> {
        try {
            const now = new Date();
            console.log('🧹 Cleaning up old alerts...');

            const contracts = await ContractAnalysisSchema.find({
                'contractDates.date': { $lt: now }
            });

            let cleanedCount = 0;

            for (const contract of contracts) {
                let modified = false;

                // Remove contract dates that have passed
                const activeDates = contract.contractDates?.filter(date => date.date >= now);
                if (activeDates && activeDates.length !== contract.contractDates?.length) {
                    contract.contractDates = activeDates;
                    modified = true;
                }

                // Remove alerts for dates that have passed or been sent
                const activeAlerts = contract.dateAlerts?.filter(alert => {
                    const contractDate = contract.contractDates?.find(
                        cd => cd._id.toString() === alert.contractDateId
                    );
                    return contractDate && contractDate.date >= now;
                });

                if (activeAlerts && activeAlerts.length !== contract.dateAlerts?.length) {
                    contract.dateAlerts = activeAlerts;
                    modified = true;
                }

                if (modified) {
                    await contract.save();
                    cleanedCount++;
                }
            }

            console.log(`🧹 Cleaned up alerts for ${cleanedCount} contracts`);
        } catch (error) {
            console.error('Error cleaning up old alerts:', error);
        }
    }
}

// Initialize the alert service
export const alertService = new AlertService();

// Admin/testing methods
export const adminAlertControls = {
    // Process all contracts for date extraction (one-time setup)
    processAllContracts: () => alertService.processAllContractsForDates(),
    
    // Trigger immediate alert check
    checkNow: () => alertService.triggerImmediateCheck(),
    
    // Get statistics
    getStats: () => alertService.getAlertStats(),
    
    // Cleanup old alerts
    cleanup: () => alertService.cleanupOldAlerts(),
    
    // Force create alert for testing
    forceCreateAlert: (contractId: string, dateId: string, reminderDays: number) => 
        alertService.forceCreateAlert(contractId, dateId, reminderDays)
};