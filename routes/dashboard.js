import express from 'express';
import {
    getDashboardStats,
    getDepartmentDistribution,
    getEmploymentStatusDistribution,
    getCandidatePipeline,
    getEmailProviderDistribution,
    getWorkAnniversaries,
    getUpForRegularization,
    getUpcomingActions,
    getHiringTrends,
    getAttritionRate,
    getRecruitmentMetrics,
    getGenderDistribution,
    getActiveByDept,
    getActiveStatus,
    getMonthlyTrend,
    getSeparationReasons,
    getSeparationsByDept,
    getRecruitmentPipeline
} from '../controllers/dashboardController.js';

const router = express.Router();

// Get all dashboard statistics
router.get('/stats', getDashboardStats);

// Get department distribution
router.get('/departments', getDepartmentDistribution);

// Get employment status
router.get('/employment-status', getEmploymentStatusDistribution);

// Get candidate pipeline
router.get('/candidates', getCandidatePipeline);

// Get email provider distribution
router.get('/email-providers', getEmailProviderDistribution);

// Get work anniversaries (within next 30 days, computed live)
router.get('/anniversaries', getWorkAnniversaries);

// Get employees up for regularization (within next 30 days)
router.get('/regularization', getUpForRegularization);

// Combined endpoint the frontend actually calls for the Actionable HR
// Trackers section (both tables in one response)
router.get('/upcoming-actions', getUpcomingActions);

// Get hiring trends
router.get('/hiring-trends', getHiringTrends);

// Get attrition rate
router.get('/attrition', getAttritionRate);

// Get recruitment metrics
router.get('/recruitment-metrics', getRecruitmentMetrics);

// Get gender distribution
router.get('/gender-distribution', getGenderDistribution);

// 6 new routes
router.get('/active-by-dept', getActiveByDept);
router.get('/active-status', getActiveStatus);
router.get('/monthly-trend', getMonthlyTrend);
router.get('/separation-reasons', getSeparationReasons);
router.get('/separations-by-dept', getSeparationsByDept);
router.get('/recruitment-pipeline', getRecruitmentPipeline);

export default router;
