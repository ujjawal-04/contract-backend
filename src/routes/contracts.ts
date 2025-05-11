import express from "express";
import { isAuthenticated } from "../middleware/auth";
import {
    analyzeContract,
    detectAndConfirmContractType,
    getContractByID,
    getUserContracts,
    uploadMiddleware,
    deleteContract,
    getUserContractStats // Added the new endpoint import
} from "../controllers/contract.controller";
import { handleErrors } from "../middleware/errors";

const router = express.Router();

// Add new route for user contract stats (for free plan limit tracking)
router.get(
    "/user-stats",
    isAuthenticated,
    handleErrors(getUserContractStats)
);

router.post(
    "/detect-type",
    isAuthenticated,
    uploadMiddleware,
    handleErrors(detectAndConfirmContractType)
);

router.post(
    "/analyze",
    isAuthenticated,
    uploadMiddleware,
    handleErrors(analyzeContract)
);

router.get(
    "/user-contracts",
    isAuthenticated,
    handleErrors(getUserContracts)
);

router.get(
    "/contract/:id",
    isAuthenticated,
    handleErrors(getContractByID)
);

// Delete route
router.delete(
    "/:id",
    isAuthenticated,
    handleErrors(deleteContract)
);

export default router;