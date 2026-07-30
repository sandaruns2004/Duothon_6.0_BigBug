const { internalNotify, internalEmail } = require('../controllers/notification.controller');
const { internalAudit } = require('../controllers/audit.controller');
const { logger } = require('../config/logger');

/**
 * Creates a mock Express request and response object
 * to pass a RabbitMQ message into an existing Express controller.
 */
const createMockReqRes = (payload) => {
  const req = {
    body: payload,
    ip: '127.0.0.1', // Mock IP for internal events
    headers: {}
  };

  const res = {
    statusCode: null,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    },
    send(data) {
      this.data = data;
      return this;
    }
  };

  return { req, res };
};

const handleEmailMessage = async (msg) => {
  logger.info('📩 Consumer received email task');
  const { req, res } = createMockReqRes(msg);
  await internalEmail(req, res);
  if (res.statusCode >= 400) {
    throw new Error(`Email failed with status ${res.statusCode}: ${JSON.stringify(res.data)}`);
  }
};

const handleNotifyMessage = async (msg) => {
  logger.info('📩 Consumer received notification task');
  const { req, res } = createMockReqRes(msg);
  await internalNotify(req, res);
  if (res.statusCode >= 400) {
    throw new Error(`Notify failed with status ${res.statusCode}: ${JSON.stringify(res.data)}`);
  }
};

const handleAuditMessage = async (msg) => {
  logger.info('📩 Consumer received audit task');
  const { req, res } = createMockReqRes(msg);
  await internalAudit(req, res);
  if (res.statusCode >= 400) {
    throw new Error(`Audit failed with status ${res.statusCode}: ${JSON.stringify(res.data)}`);
  }
};

module.exports = {
  handleEmailMessage,
  handleNotifyMessage,
  handleAuditMessage
};
