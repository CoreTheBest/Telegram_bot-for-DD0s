// backend/utils/botWorker.js
const { Worker } = require('worker_threads');
const path = require('path');
const logger = require('@/utils/logger');

let botWorker = null;

function startBotWorker() {
    if (botWorker) return logger.warn('Bot Worker 已启动');
    botWorker = new Worker(path.resolve(__dirname, '../bot/bot_worker.js'));
    botWorker.on('message', (msg) => {
        if (msg.type === 'started') logger.success('🤖 Bot Worker 已启动');
        if (msg.type === 'stopped') logger.success('⛔ Bot Worker 已停止');
        if (msg.type === 'restarted') logger.success('♻️ Bot Worker 已重启');
        if (msg.type === 'status') logger.info(`Bot Worker 状态: ${msg.running}`);
        if (msg.type === 'error') logger.error('Bot Worker 出错:', msg.error);
    });
    botWorker.on('exit', (code) => {
        logger.warn(`Bot Worker 已退出 (code=${code})`);
        botWorker = null;
    });
}

function sendBotWorkerMsg(msg) {
    if (!botWorker) startBotWorker();
    botWorker.postMessage(msg);
}

// 新增：安全获取当前worker对象
function getBotWorker() {
    return botWorker;
}

module.exports = {
    sendBotWorkerMsg,
    startBotWorker,
    getBotWorker, // 必须导出
};
