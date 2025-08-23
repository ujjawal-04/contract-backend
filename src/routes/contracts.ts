import express from "express";
import { isAuthenticated, isGoldUser } from "../middleware/auth";
import {
    analyzeContract,
    detectAndConfirmContractType,
    getContractByID,
    getUserContracts,
    uploadMiddleware,
    deleteContract,
    getUserContractStats,
    chatWithContract,
    modifyContract
} from "../controllers/contract.controller";
import { handleErrors } from "../middleware/errors";

const router = express.Router();

// Existing routes...
router.get("/user-stats", isAuthenticated, handleErrors(getUserContractStats));
router.post("/detect-type", isAuthenticated, uploadMiddleware, handleErrors(detectAndConfirmContractType));
router.post("/analyze", isAuthenticated, uploadMiddleware, handleErrors(analyzeContract));
router.get("/user-contracts", isAuthenticated, handleErrors(getUserContracts));
router.get("/contract/:id", isAuthenticated, handleErrors(getContractByID));
router.delete("/:id", isAuthenticated, handleErrors(deleteContract));

// Gold-specific routes
router.post("/chat", isAuthenticated, isGoldUser, handleErrors(chatWithContract));
router.post("/modify", isAuthenticated, isGoldUser, handleErrors(modifyContract));

export default router;