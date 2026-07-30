const amqp = require('amqp-connection-manager');
const { logger } = require('../config/logger');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

// Exchanges
const COMMAND_EXCHANGE = 'aegisvault.commands';
const EVENT_EXCHANGE = 'aegisvault.events';

class RabbitMQService {
  constructor() {
    this.connection = null;
    this.channelWrapper = null;
  }

  async connect() {
    if (this.connection) return;

    logger.info('🐇 Connecting to RabbitMQ...');

    this.connection = amqp.connect([RABBITMQ_URL]);

    this.connection.on('connect', () => {
      logger.info('✅ RabbitMQ Connected!');
    });

    this.connection.on('disconnect', (err) => {
      logger.error('❌ RabbitMQ Disconnected.', { error: err.err ? err.err.message : 'Unknown' });
    });

    this.channelWrapper = this.connection.createChannel({
      json: true,
      setup: async (channel) => {
        // Assert exchanges
        await channel.assertExchange(COMMAND_EXCHANGE, 'direct', { durable: true });
        await channel.assertExchange(EVENT_EXCHANGE, 'topic', { durable: true });
      }
    });
  }

  async publishWithTimeout(exchange, routingKey, message, timeoutMs = 3000) {
    if (!this.channelWrapper) await this.connect();

    return Promise.race([
      this.channelWrapper.publish(exchange, routingKey, message, { persistent: true }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`RabbitMQ publish timed out after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  async publishCommand(routingKey, message) {
    try {
      await this.publishWithTimeout(COMMAND_EXCHANGE, routingKey, message, 3000);
      logger.debug('📤 Published Command to RabbitMQ', { routingKey });
    } catch (err) {
      logger.error('Failed to publish command', { error: err.message, routingKey });
    }
  }

  async publishEvent(routingKey, message) {
    try {
      await this.publishWithTimeout(EVENT_EXCHANGE, routingKey, message, 3000);
      logger.debug('📤 Published Event to RabbitMQ', { routingKey });
    } catch (err) {
      logger.error('Failed to publish event', { error: err.message, routingKey });
    }
  }

  /**
   * For consumers (notification-service)
   */
  async consume(queueName, exchange, routingKey, callback) {
    if (!this.channelWrapper) await this.connect();

    this.channelWrapper.addSetup(async (channel) => {
      await channel.assertQueue(queueName, { durable: true });
      await channel.bindQueue(queueName, exchange, routingKey);
      await channel.consume(queueName, async (msg) => {
        if (msg !== null) {
          try {
            const content = JSON.parse(msg.content.toString());
            await callback(content);
            channel.ack(msg);
          } catch (err) {
            logger.error('Error processing message', { error: err.message, queueName });
            channel.nack(msg, false, false);
          }
        }
      });
    });
  }
}

const rabbitmq = new RabbitMQService();
module.exports = rabbitmq;
