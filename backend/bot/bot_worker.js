require('module-alias/register');
const { parentPort } = require('worker_threads');
const { initBot, stopBot, getBotStatus } = require('@/bot');

parentPort.on('message', async (msg) => {
    if (msg === 'start') {
        try {
            await initBot();
            const status = getBotStatus();
            if (status.ready) {
                parentPort.postMessage({ type: 'started', ...status });
            } else {
                parentPort.postMessage({ type: 'error', error: 'Bot 启动未成功（未 ready）' });
            }
        } catch (e) {
            parentPort.postMessage({ type: 'error', error: e.message });
        }
    } else if (msg === 'stop') {
        try {
            await stopBot();
            const status = getBotStatus();
            if (!status.ready) {
                parentPort.postMessage({ type: 'stopped', ...status });
            } else {
                parentPort.postMessage({ type: 'error', error: 'Bot 停止失败（仍为 ready）' });
            }
        } catch (e) {
            parentPort.postMessage({ type: 'error', error: e.message });
        }
    } else if (msg === 'restart') {
        try {
            await stopBot();
            await new Promise(resolve => setTimeout(resolve, 3000)); // 延迟3秒
            await initBot();
            const status = getBotStatus();
            if (status.ready) {
                parentPort.postMessage({ type: 'restarted', ...status });
            } else {
                parentPort.postMessage({ type: 'error', error: 'Bot 重启未成功（未 ready）' });
            }
        } catch (e) {
            parentPort.postMessage({ type: 'error', error: e.message });
        }
    } else if (msg === 'status') {
        const status = getBotStatus();
        parentPort.postMessage({ type: 'status', ...status });
    }
});
