const winston = require("winston");
const { ElasticsearchTransport } = require("winston-elasticsearch");

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Elasticsearch transport for production
if (process.env.NODE_ENV === "production") {
  const esTransport = new ElasticsearchTransport({
    level: "info",
    clientOpts: { node: process.env.ELASTICSEARCH_URL },
  });
  logger.add(esTransport);
}

module.exports = logger;
