require('module-alias/register')
const { parentPort } = require('worker_threads');
const { initBot, stopBot } = require('@/bot');
let running = false;

parentPort.on('message', async (msg) => {
    if (msg === 'start') {
        try {
            await initBot();
            running = true;
            parentPort.postMessage({ type: 'started' });
        } catch (e) {
            running = false;
            parentPort.postMessage({ type: 'error', error: e.message });
        }
    } else if (msg === 'stop') {
        try {
            await stopBot();
            running = false;
            parentPort.postMessage({ type: 'stopped' });
        } catch (e) {
            parentPort.postMessage({ type: 'error', error: e.message });
        }
    } else if (msg === 'restart') {
        try {
            await stopBot();
            await initBot();
            running = true;
            parentPort.postMessage({ type: 'restarted' });
        } catch (e) {
            parentPort.postMessage({ type: 'error', error: e.message });
        }
    } else if (msg === 'status') {
        parentPort.postMessage({ type: 'status', running });
    }
});
