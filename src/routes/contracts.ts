// src/routes/contracts.ts - ADD THESE ROUTES TO YOUR EXISTING ROUTES FILE

import express from "express";
import { isAuthenticated, isGoldUser, isPremiumUser } from "../middleware/auth"; // Add isPremiumUser if needed
import {
    analyzeContract,
    detectAndConfirmContractType,
    getContractByID,
    getUserContracts,
    uploadMiddleware,
    deleteContract,
    getUserContractStats,
    chatWithContract,
    modifyContract,
    downloadModifiedContract,
    generateRecommendations,
    trackChanges,
    getVersionContent,
    reAnalyzeContract,
    getReAnalysisResults,
    // DATE ALERT FUNCTIONS 
    getContractDates,
    updateContractDateAlert,
    addCustomContractDate,
    deleteContractDate,
    getUpcomingContractDates,
    getAlertStatistics,
    viewContract
} from "../controllers/contract.controller";
import { handleErrors } from "../middleware/errors";

const router = express.Router();

// Basic routes (available to all authenticated users)
router.get("/user-stats", isAuthenticated, handleErrors(getUserContractStats));
router.post("/detect-type", isAuthenticated, uploadMiddleware, handleErrors(detectAndConfirmContractType));
router.post("/analyze", isAuthenticated, uploadMiddleware, handleErrors(analyzeContract));
router.get("/user-contracts", isAuthenticated, handleErrors(getUserContracts));
router.get("/contract/:id", isAuthenticated, handleErrors(getContractByID));
router.delete("/:id", isAuthenticated, handleErrors(deleteContract));

// RE-ANALYSIS ROUTES (Premium+ required)
router.post("/reanalyze", isAuthenticated, handleErrors(reAnalyzeContract)); // ADD THIS LINE
router.get("/:contractId/reanalysis-results", isAuthenticated, handleErrors(getReAnalysisResults)); // ADD THIS LINE

// Date and alert management routes (available to all authenticated users)
router.get("/:id/dates", isAuthenticated, handleErrors(getContractDates));
router.put("/:contractId/dates/:dateId/alerts", isAuthenticated, handleErrors(updateContractDateAlert));
router.post("/:contractId/dates", isAuthenticated, handleErrors(addCustomContractDate));
router.delete("/:contractId/dates/:dateId", isAuthenticated, handleErrors(deleteContractDate));
router.get("/upcoming-dates", isAuthenticated, handleErrors(getUpcomingContractDates));
router.get("/alert-statistics", isAuthenticated, handleErrors(getAlertStatistics));

// Version content viewing (available to all authenticated users)
router.get("/:contractId/version/:version/content", isAuthenticated, handleErrors(getVersionContent));

// Gold-specific routes
router.post("/chat", isAuthenticated, isGoldUser, handleErrors(chatWithContract));
router.post("/modify", isAuthenticated, isGoldUser, handleErrors(modifyContract));
router.get("/download/:contractId/version/:version", isAuthenticated, isGoldUser, handleErrors(downloadModifiedContract));
router.post("/recommendations", isAuthenticated, isGoldUser, handleErrors(generateRecommendations));
router.get("/track-changes", isAuthenticated, isGoldUser, handleErrors(trackChanges));
router.get("/compare-versions", isAuthenticated, isGoldUser, handleErrors(trackChanges)); // ALIAS FOR TRACK CHANGES
router.get("/view/:contractId/version/:version", isAuthenticated, isGoldUser, handleErrors(viewContract));

export default router;