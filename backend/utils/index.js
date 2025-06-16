const SignConfig = require('@/database/models/SignConfig');

async function getSignPoints() {
    const config = await SignConfig.findOne();
    if (!config) throw new Error('未找到签到配置');

    const { point_mode, point_amount } = config;

    if (point_mode === 'fixed') {
        return parseInt(point_amount);
    }

    const [min, max] = point_amount.includes('-')
        ? point_amount.split('-').map(Number)
        : [0, Number(point_amount)];

    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isSamePeriod(lastSign, now, mode = 'daily') {
    if (!lastSign) return false;
    const last = new Date(lastSign);
    const curr = new Date(now);
    if (mode === '24h') {
        // 24小时机制：上一签和现在的间隔小于24小时不允许
        return (curr - last) < 24 * 60 * 60 * 1000;
    } else {
        // 'daily'机制：同一天只允许一次
        return last.toDateString() === curr.toDateString();
    }
}

function getReward(point_mode, point_amount) {
    if (point_mode === 'random') {
        // 支持 "15-30" 区间
        const m = String(point_amount).match(/^(\d+)\s*-\s*(\d+)$/);
        if (m) {
            const min = parseInt(m[1]);
            const max = parseInt(m[2]);
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }
    }
    // 默认固定分数
    return parseInt(point_amount) || 10;
}



module.exports = {
    getSignPoints,
    getReward,
    isSamePeriod
};
