import { createLogger, format, transport, transports } from "winston";
const { combine, timestamp, json, colorize } = format;

const logFormat = format.combine(
  format.colorize(),
  format.printf(({ timestamp, level, message }) => {
    return ` ${level}: ${message} ${timestamp}`;
  })
);

const logger = createLogger({
  level: "info",
  format: combine(colorize(), timestamp(), json()),
  transports: [
    new transports.Console({
      format: logFormat,
    }),
    new transports.File({
      filename: "./logs/error.log",
    }),
  ],
});

export default logger;
