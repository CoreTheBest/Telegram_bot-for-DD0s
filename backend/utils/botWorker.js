const { Worker } = require('worker_threads');
const path = require('path');
const logger = require('@/utils/logger');

let botWorker = null;

// 启动 worker
function startBotWorker() {
    if (botWorker) return logger.warn('Bot Worker 已启动');
    const workerPath = path.resolve(__dirname, '../bot/bot_worker.js');
    botWorker = new Worker(workerPath);

    botWorker.on('message', (msg) => {
        if (msg.type === 'started') logger.success('🤖 Bot Worker 已启动');
        if (msg.type === 'stopped') logger.success('⛔ Bot Worker 已停止');
        if (msg.type === 'restarted') logger.success('♻️ Bot Worker 已重启');
        if (msg.type === 'error') logger.error('Bot Worker 出错:', msg.error);
    });
    botWorker.on('exit', (code) => {
        logger.warn(`Bot Worker 已退出 (code=${code})`);
        botWorker = null;
    });
    botWorker.on('error', (err) => {
        logger.error('Bot Worker 启动异常:', err);
        botWorker = null;
    });
}

// 发送消息到 worker
function sendBotWorkerMsg(msg) {
    if (!botWorker) {
        if (msg === 'start') {
             startBotWorker();
            botWorker.postMessage(msg);
        } else {
            logger.warn('Bot Worker 未启动，无法处理此消息: ' + msg);
        }
    } else {
        botWorker.postMessage(msg);
    }
}


// 获取 worker 实例
function getBotWorker() {
    return botWorker;
}

// 获取 worker 业务状态（异步）
function getStatusFromWorker() {
    return new Promise((resolve, reject) => {
        if (!botWorker) {
            return resolve({ running: false, ready: false, username: '' });
        }
        // 只监听一次响应
        const onMsg = (msg) => {
            if (msg.type === 'status') {
                botWorker.off('message', onMsg);
                resolve(msg);
            }
        };
        botWorker.on('message', onMsg);
        botWorker.postMessage('status');
        // 超时保护
        setTimeout(() => {
            botWorker.off('message', onMsg);
            resolve({ running: false, ready: false, username: '' });
        }, 2000);
    });
}

module.exports = {
    sendBotWorkerMsg,
    startBotWorker,
    getBotWorker,
    getStatusFromWorker, // 导出异步状态查询
};
