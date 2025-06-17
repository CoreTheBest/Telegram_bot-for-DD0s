const chalk = require('chalk'); // 使用 chalk@4 推荐
const MAX_LABEL_WIDTH = 10;

function timestamp() {
    return new Date().toTimeString().split(' ')[0];
}

function formatPrefix(label, colorFn) {
    const time = `[${timestamp()}]`;
    const paddedLabel = `${label.toUpperCase().padStart((MAX_LABEL_WIDTH + label.length) / 2, ' ').padEnd(MAX_LABEL_WIDTH)}`;
    return `${chalk.gray(time)} | ${colorFn(paddedLabel)} |`;
}

const logger = {
    info(...args) {
        console.log(formatPrefix('INFO', chalk.blue), ...args);
    },
    warn(...args) {
        console.warn(formatPrefix('WARN', chalk.yellow), ...args);
    },
    error(...args) {
        console.error(formatPrefix('ERROR', chalk.red), ...args);
    },
    success(...args) {
        console.log(formatPrefix('SUCCESS', chalk.green), ...args);
    }
};

module.exports = logger;
