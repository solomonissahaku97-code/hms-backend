/**
 * Pharmacy Proxy Route
 * 
 * Forwards /api/v1/pharmacy/* requests to the pharmacy-service microservice.
 * This allows the monolith to serve as the single API gateway while the
 * pharmacy microservice handles its own business logic.
 * 
 * Prescriptions are NOT proxied — they stay on the monolith because they
 * need billing, claims, and notification integration.
 */

const express = require('express');
const router = express.Router();
const http = require('http');
const https = require('https');
const authenticateToken = require('../middlewares/authMiddlewares');

const PHARMACY_SERVICE_URL = process.env.PHARMACY_SERVICE_URL || 'http://localhost:3001';
const SERVICE_KEY = process.env.HMS_BACKEND_API_KEY || process.env.PHARMACY_SERVICE_SECRET || process.env.HMS_SERVICE_KEY || '';

/**
 * Proxy helper — forwards the incoming request to the pharmacy microservice.
 * Strips the `/api/v1/pharmacy` prefix before forwarding.
 */
function proxyToPharmacy(targetPath) {
  return async (req, res) => {
    try {
      // Build query string
      const queryString = Object.keys(req.query).length
        ? '?' + new URLSearchParams(req.query).toString()
        : '';

      const fullUrl = `${PHARMACY_SERVICE_URL}/api/v1/pharmacy${targetPath}${queryString}`;
      const urlObj = new URL(fullUrl);

      // Build headers — forward auth, add service key
      const headers = {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'X-Service-Key': SERVICE_KEY,
        'X-Service-User-Id': req.user?.id || '',
        'X-Service-Institution-Id': req.user?.institution_id || '',
      };

      if (req.headers.authorization) {
        headers['Authorization'] = req.headers.authorization;
      }

      // Choose http or https
      const transport = urlObj.protocol === 'https:' ? https : http;

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: req.method,
        headers,
        timeout: 30000,
      };

      const proxyReq = transport.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      });

      proxyReq.on('error', (err) => {
        console.error(`Pharmacy proxy error [${req.method} ${targetPath}]:`, err.message);
        if (!res.headersSent) {
          res.status(502).json({
            error: 'Pharmacy service unavailable',
            detail: err.message,
          });
        }
      });

      proxyReq.on('timeout', () => {
        proxyReq.destroy();
        if (!res.headersSent) {
          res.status(504).json({ error: 'Pharmacy service timeout' });
        }
      });

      // Pipe request body
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        req.pipe(proxyReq, { end: true });
      } else {
        proxyReq.end();
      }
    } catch (err) {
      console.error('Pharmacy proxy fatal error:', err);
      res.status(500).json({ error: 'Internal proxy error', detail: err.message });
    }
  };
}

// ─── Proxied Routes ──────────────────────────────────────────────
// Medications (catalog)
router.get('/medications', authenticateToken, proxyToPharmacy('/medications'));
router.get('/medications/categories', authenticateToken, proxyToPharmacy('/medications/categories'));
router.get('/medications/:id', authenticateToken, proxyToPharmacy('/medications/:id'));
router.post('/medications', authenticateToken, proxyToPharmacy('/medications'));
router.put('/medications/:id', authenticateToken, proxyToPharmacy('/medications/:id'));
router.delete('/medications/:id', authenticateToken, proxyToPharmacy('/medications/:id'));

// Inventory (batches, alerts, valuation)
router.get('/inventory/alerts', authenticateToken, proxyToPharmacy('/inventory/alerts'));
router.get('/inventory/logs', authenticateToken, proxyToPharmacy('/inventory/logs'));
router.get('/inventory/valuation', authenticateToken, proxyToPharmacy('/inventory/valuation'));
router.get('/inventory/batches', authenticateToken, proxyToPharmacy('/inventory/batches'));
router.post('/inventory/batches', authenticateToken, proxyToPharmacy('/inventory/batches'));
router.put('/inventory/batches/:id/adjust', authenticateToken, proxyToPharmacy('/inventory/batches/:id/adjust'));

// Dispensing
router.get('/dispensing/stats', authenticateToken, proxyToPharmacy('/dispensing/stats'));
router.get('/dispensing/history', authenticateToken, proxyToPharmacy('/dispensing/history'));
router.post('/dispensing/dispense', authenticateToken, proxyToPharmacy('/dispensing/dispense'));
router.post('/dispensing/batch-dispense', authenticateToken, proxyToPharmacy('/dispensing/batch-dispense'));

// Dashboard
router.get('/dashboard/overview', authenticateToken, proxyToPharmacy('/dashboard/overview'));
router.get('/dashboard/revenue', authenticateToken, proxyToPharmacy('/dashboard/revenue'));
router.get('/dashboard/activity', authenticateToken, proxyToPharmacy('/dashboard/activity'));

// Prescription routes on the microservice (basic CRUD)
// NOTE: These are secondary — the monolith has the full prescription logic with billing.
// These are for pharmacy-specific views that don't need billing integration.
router.get('/prescriptions/pending', authenticateToken, proxyToPharmacy('/prescriptions/pending'));
router.get('/prescriptions', authenticateToken, proxyToPharmacy('/prescriptions'));

module.exports = router;
