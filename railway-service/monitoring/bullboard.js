/**
 * BullBoard Dashboard Configuration
 * Provides a web UI for monitoring BullMQ queues
 * Access at: http://your-server/admin/queues
 */

const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const { Queue } = require('bullmq');
const { ioredisConnection } = require('../config/redis');

/**
 * Create BullBoard dashboard
 * @returns {Object} { router, adapter } - Express router and server adapter
 */
function createQueueDashboard() {
  if (!ioredisConnection) {
    console.warn('⚠️  BullBoard disabled - ioredis connection not available');
    return null;
  }

  try {
    // Create Express adapter for BullBoard
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    // Create queue instances for monitoring
    const broadcastQueue = new Queue('broadcasts', {
      connection: ioredisConnection,
    });

    // Create BullBoard with queues
    createBullBoard({
      queues: [
        new BullMQAdapter(broadcastQueue),
      ],
      serverAdapter,
    });

    console.log('✅ BullBoard dashboard created');
    console.log('📊 Dashboard available at: /admin/queues');

    return {
      router: serverAdapter.getRouter(),
      adapter: serverAdapter,
    };
  } catch (error) {
    console.error('❌ Failed to create BullBoard dashboard:', error);
    return null;
  }
}

/**
 * Simple authentication middleware for BullBoard
 * In production, replace with proper authentication
 * @param {string} username - Admin username
 * @param {string} password - Admin password
 */
function createAuthMiddleware(username = 'admin', password = process.env.ADMIN_PASSWORD || 'changeme') {
  return (req, res, next) => {
    const auth = req.headers.authorization;

    if (!auth) {
      res.setHeader('WWW-Authenticate', 'Basic realm="BullBoard"');
      res.status(401).send('Authentication required');
      return;
    }

    const [scheme, credentials] = auth.split(' ');

    if (scheme !== 'Basic') {
      res.status(401).send('Invalid authentication scheme');
      return;
    }

    const [user, pass] = Buffer.from(credentials, 'base64').toString().split(':');

    if (user === username && pass === password) {
      next();
    } else {
      res.setHeader('WWW-Authenticate', 'Basic realm="BullBoard"');
      res.status(401).send('Invalid credentials');
    }
  };
}

/**
 * Get queue statistics
 * @param {Queue} queue - BullMQ queue instance
 * @returns {Promise<Object>} Queue statistics
 */
async function getQueueStats(queue) {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      name: queue.name,
      counts: {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed,
      },
      health: failed / Math.max(1, completed + failed) < 0.1 ? 'healthy' : 'needs attention',
    };
  } catch (error) {
    console.error('Error getting queue stats:', error);
    return null;
  }
}

/**
 * Get comprehensive queue monitoring data
 * @returns {Promise<Object>} Complete monitoring data
 */
async function getMonitoringData() {
  if (!ioredisConnection) {
    return {
      enabled: false,
      message: 'Queue monitoring not available - ioredis not configured',
    };
  }

  try {
    const broadcastQueue = new Queue('broadcasts', {
      connection: ioredisConnection,
    });

    const stats = await getQueueStats(broadcastQueue);

    return {
      enabled: true,
      timestamp: new Date().toISOString(),
      queues: {
        broadcasts: stats,
      },
      dashboardUrl: '/admin/queues',
    };
  } catch (error) {
    console.error('Error getting monitoring data:', error);
    return {
      enabled: false,
      error: error.message,
    };
  }
}

module.exports = {
  createQueueDashboard,
  createAuthMiddleware,
  getQueueStats,
  getMonitoringData,
};
