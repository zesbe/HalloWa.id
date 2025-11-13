/**
 * Monitoring Dashboard Server
 * Optional: Run this as a separate process for queue monitoring
 * Usage: node monitoring/dashboard-server.js
 */

const express = require('express');
const { createQueueDashboard, createAuthMiddleware, getMonitoringData } = require('./bullboard');

const PORT = process.env.MONITORING_PORT || 3001;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';

/**
 * Start monitoring dashboard server
 */
async function startDashboardServer() {
  try {
    const app = express();

    // Health check
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', service: 'monitoring-dashboard' });
    });

    // Queue statistics API endpoint (no auth for internal monitoring)
    app.get('/api/queue-stats', async (req, res) => {
      try {
        const data = await getMonitoringData();
        res.json(data);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // BullBoard dashboard (with authentication)
    const dashboard = createQueueDashboard();

    if (dashboard) {
      app.use(
        '/admin/queues',
        createAuthMiddleware(ADMIN_USERNAME, ADMIN_PASSWORD),
        dashboard.router
      );

      console.log('✅ BullBoard dashboard mounted at /admin/queues');
      console.log(`📊 Access with: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
    } else {
      console.warn('⚠️  BullBoard dashboard not available');
    }

    // Start server
    app.listen(PORT, () => {
      console.log(`🖥️  Monitoring dashboard running on port ${PORT}`);
      console.log(`🔗 Dashboard: http://localhost:${PORT}/admin/queues`);
      console.log(`📊 Queue Stats API: http://localhost:${PORT}/api/queue-stats`);
    });
  } catch (error) {
    console.error('❌ Failed to start dashboard server:', error);
    process.exit(1);
  }
}

// Start if run directly
if (require.main === module) {
  console.log('🚀 Starting BullMQ Monitoring Dashboard...');
  startDashboardServer();
}

module.exports = { startDashboardServer };
