/**
 * Universal Microservice Proxy Gateway
 * 
 * Routes requests to the appropriate microservice. If the microservice
 * is unavailable or returns a 404, the request falls through to the
 * monolith's own routes (registered AFTER this gateway).
 * 
 * This ensures:
 * 1. Microservices are the primary handler when available
 * 2. The monolith acts as fallback if a microservice is down
 * 3. Existing monolith routes continue to work during migration
 */

const http = require('http');
const https = require('https');

const SERVICE_AUTH_SECRET = process.env.SERVICE_AUTH_SECRET || 'change-me-in-production';

// ─── Service Registry ────────────────────────────────────────────
const SERVICES = {
  auth: {
    url: process.env.AUTH_SERVICE_URL || 'http://localhost:3008',
    prefix: '/api/v1/auth',
    serviceKey: SERVICE_AUTH_SECRET,
  },
  claims: {
    url: process.env.CLAIMS_SERVICE_URL || 'http://localhost:3002',
    prefix: '/api/v1/claims',
    serviceKey: SERVICE_AUTH_SECRET,
  },
  store: {
    url: process.env.STORE_SERVICE_URL || 'http://localhost:3004',
    prefix: '/api/v1/store',
    serviceKey: SERVICE_AUTH_SECRET,
  },
  theatre: {
    url: process.env.THEATRE_SERVICE_URL || 'http://localhost:3005',
    prefix: '/api/v1/theatre',
    serviceKey: SERVICE_AUTH_SECRET,
  },
  consultation: {
    url: process.env.CONSULTATION_SERVICE_URL || 'http://localhost:3006',
    prefix: '/api/v1/consultation',
    serviceKey: SERVICE_AUTH_SECRET,
  },
  maternity: {
    url: process.env.MATERNITY_SERVICE_URL || 'http://localhost:3007',
    prefix: '/api/v1/maternity',
    serviceKey: SERVICE_AUTH_SECRET,
  },
  admission: {
    url: process.env.ADMISSION_SERVICE_URL || 'http://localhost:3003',
    prefix: '/api/v1/admission',
    serviceKey: SERVICE_AUTH_SECRET,
  },
  billing: {
    url: process.env.BILLING_SERVICE_URL || 'http://localhost:8001',
    prefix: '/api/v1/billing',
    serviceKey: SERVICE_AUTH_SECRET,
  },
  lab: {
    url: process.env.LAB_SERVICE_URL || 'http://localhost:5012',
    prefix: '/api/v1/lab',
    serviceKey: SERVICE_AUTH_SECRET,
  },
  subscriptions: {
    url: process.env.SUBSCRIPTION_SERVICE_URL || 'http://localhost:3009',
    prefix: '/api/v1/subscriptions',
    serviceKey: SERVICE_AUTH_SECRET,
  },
  network: {
    url: process.env.NETWORK_SERVICE_URL || 'http://localhost:3011',
    prefix: '/api/v1/network',
    serviceKey: SERVICE_AUTH_SECRET,
  },
};

// Routes that should NOT be proxied (stay on monolith)
const MONOLITH_ONLY_PREFIXES = [
  '/api/v1/auth/staffs',                // Staff listing stays on monolith
  '/api/v1/auth/all-staffs',            // Staff listing stays on monolith
  '/api/v1/auth/single-staff',          // Staff lookup stays on monolith
  '/api/v1/auth/admin/institution',     // Admin staff management stays on monolith
  '/api/v1/auth/departments',           // Department assignment stays on monolith
  '/api/v1/auth/update-user-fcm-token', // FCM token stays on monolith
  '/api/v1/auth/unified',               // Unified auth stays on monolith
  '/api/v1/auth/login/super-admin',     // Super admin stays on monolith
  '/api/v1/prescriptions',              // Prescriptions need billing integration
];

// ─── Proxy Helper ────────────────────────────────────────────────
function proxyRequest(serviceUrl, originalUrl, req, res, timeoutMs = 12000) {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(serviceUrl + originalUrl);

      const headers = {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'X-Service-Key': SERVICE_AUTH_SECRET,
        'X-Service-User-Id': req.user?.id || '',
        'X-Service-Institution-Id': req.user?.institution_id || '',
      };

      if (req.headers.authorization) {
        headers['Authorization'] = req.headers.authorization;
      }

      const transport = urlObj.protocol === 'https:' ? https : http;
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: req.method,
        headers,
        timeout: timeoutMs,
      };

      const proxyReq = transport.request(options, (proxyRes) => {
        // Track whether we actually wrote a response to the client
        let responseStarted = false;

        proxyRes.on('data', (chunk) => {
          if (!responseStarted) {
            // If 404 from microservice, don't forward — fall through to monolith
            if (proxyRes.statusCode === 404) {
              resolve(false);
              proxyRes.destroy();
              return;
            }
            // Forward the response
            responseStarted = true;
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            res.write(chunk);
          } else {
            res.write(chunk);
          }
        });

        proxyRes.on('end', () => {
          if (responseStarted) {
            // We forwarded data from the microservice — close the response
            try { res.end(); } catch (e) { /* already closed */ }
            resolve(true);
          } else {
            // No data written to client (404, error, etc.) — let monolith handle it
            resolve(false);
          }
        });

        proxyRes.on('error', () => resolve(false));
      });

      proxyReq.on('error', () => {
        resolve(false); // Service unavailable — let monolith handle it
      });

      proxyReq.on('timeout', () => {
        proxyReq.destroy();
        resolve(false); // Timeout — let monolith handle it
      });

      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        // Express body-parser already consumed the stream, so use req.body
        const body = (req.body && Object.keys(req.body).length > 0)
          ? JSON.stringify(req.body)
          : '';
        if (body) {
          headers['Content-Length'] = Buffer.byteLength(body);
        }
        proxyReq.write(body);
        proxyReq.end();
      } else {
        proxyReq.end();
      }
    } catch {
      resolve(false);
    }
  });
}

/**
 * Create proxy middleware for all microservices.
 * Call this BEFORE mounting monolith routes.
 * 
 * Usage in routes/index.js:
 *   const microserviceGateway = require('./microserviceGateway');
 *   microserviceGateway(app);  // Mount before monolith routes
 *   app.use('/api/v1/prescriptions', prescriptionRoutes); // Monolith fallback
 */
function mountGateway(app) {
  // Health check for the gateway
  app.get('/api/v1/gateway/health', (req, res) => {
    const status = {};
    for (const [name, svc] of Object.entries(SERVICES)) {
      status[name] = { url: svc.url, prefix: svc.prefix };
    }
    res.json({ status: 'ok', services: status });
  });

  // Mount a proxy handler for each service
  for (const [serviceName, service] of Object.entries(SERVICES)) {
    const { prefix, url } = service;

    // Catch-all route for this service's prefix
    app.use(prefix, async (req, res, next) => {
      // Skip if this path should stay on the monolith
      if (MONOLITH_ONLY_PREFIXES.some(p => req.originalUrl.startsWith(p))) {
        return next();
      }

      // Skip old monolith registration routes (they use /auth/register/staff, /auth/register/admin)
      // New self-registration routes (/auth/register/institution, /auth/register/admin, /auth/register/subscription-plans) go to auth-service
      if (serviceName === 'auth' && req.originalUrl.includes('/register/staff')) {
        return next();
      }
      // Build the path the microservice expects (it receives the full /api/v1/... path)
      const targetPath = req.originalUrl || (req.url);

      console.log(`[Gateway] ${req.method} ${targetPath} → ${serviceName} (${url})`);

      const handled = await proxyRequest(url, targetPath, req, res, 12000);

      if (handled) {
        // Microservice responded — done
        return;
      }

      // Microservice unavailable or errored — fall through to monolith routes
      console.log(`[Gateway] ${serviceName} unavailable, falling through to monolith`);
      next();
    });
  }
}

module.exports = { mountGateway, SERVICES };
