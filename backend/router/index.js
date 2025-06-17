const jwt = require('jsonwebtoken')
const config = require('config');
const { format } = require('@fast-csv/format');
const logger = require('@/utils/logger');
const { generateCardKeys, redeemCardKey } = require('@/utils/cardkey');
const { sendBotWorkerMsg , getBotWorker } = require('@/utils/botWorker');
const { Data,SignConfig,CardKey,Plan,User,Task,Api,Method } = require('@/database/models');
const { getStatusFromWorker } = require('@/utils/botWorker');
const login_info = config.get('login');


function verifyJWT(request, reply, done) {
    const auth = request.headers.authorization
    if (!auth || !auth.startsWith('Bearer ')) {
        reply.code(401).send({ error: '未授权: 缺少Token' })
        return
    }
    const token = auth.slice(7)
    try {
        const decoded = jwt.verify(token, login_info.jwt_token)
        request.user = decoded
        done() // 继续后续路由
    } catch (e) {
        reply.code(401).send({ error: '未授权: token失效' })
    }
}

module.exports = async function (app) {


    app.post('/login', async (req, reply) => {
        const { username, password } = req.body
        if (!username || !password) {
            return reply.code(400).send({ error: '用户名或密码不能为空' })
        }
        if (
            username !== login_info.username ||
            password !== login_info.password
        ) {
            return reply.code(401).send({ error: '账号或密码错误' })
        }

        // 登录成功，生成 JWT
        const token = jwt.sign(
            { username },
            login_info.jwt_token,
            { expiresIn: '30d' }
        )
        reply.send({ token })
    })

    app.get('/status', { preHandler: verifyJWT }, async (req, reply) => {
        const status = await getStatusFromWorker();
        reply.send({
            running: status.ready || false, // 兼容老写法
            ready: status.ready || false,
            username: status.username || '',
        });
    });

    app.post('/start', { preHandler: verifyJWT }, async (req, reply) => {
        try {
            sendBotWorkerMsg('start');
            reply.send({ success: true });
        } catch (err) {
            reply.code(500).send({ error: err.message });
        }
    });

    app.post('/restart', { preHandler: verifyJWT }, async (req, reply) => {
        try {
            sendBotWorkerMsg('restart');
            reply.send({ success: true });
        } catch (err) {
            reply.code(500).send({ error: err.message });
        }
    });

    app.post('/stop', { preHandler: verifyJWT }, async (req, reply) => {
        try {
            sendBotWorkerMsg('stop');
            reply.send({ success: true });
        } catch (err) {
            reply.code(500).send({ error: err.message });
        }
    });

    app.get('/config', { preHandler: verifyJWT }, async (req, reply) => {
        const config = await Data.findOne();
        if (!config) return reply.send({});
        reply.send({
            BOTTOKEN: config.BOTTOKEN,
            BOT_ADMIN: config.BOT_ADMIN,
            AUTHORIZED_GROUPS: config.AUTHORIZED_GROUPS
        });
    });

    app.post('/config', { preHandler: verifyJWT }, async (req, reply) => {
        const { BOTTOKEN, BOT_ADMIN, AUTHORIZED_GROUPS } = req.body;

        // 只校验 token 和 admin
        if (!BOTTOKEN || !BOT_ADMIN) {
            return reply.code(400).send({ error: '缺少参数：BOTTOKEN、BOT_ADMIN' });
        }

        try {
            const [record] = await Data.findOrCreate({ where: { id: 1 } });
            record.BOTTOKEN = BOTTOKEN;
            record.BOT_ADMIN = BOT_ADMIN;

            // 授权群组可为[]或空，若没传或不是数组就存空数组
            record.AUTHORIZED_GROUPS = Array.isArray(AUTHORIZED_GROUPS)
                ? AUTHORIZED_GROUPS
                : [];

            await record.save();

            logger.success('✅ Bot 配置已更新');
            reply.send({ success: true });
        } catch (err) {
            logger.error('❌ 配置更新失败:', err.message);
            reply.code(500).send({ error: err.message });
        }
    });

    app.get('/signconfig', { preHandler: verifyJWT }, async (req, reply) => {
        const config = await SignConfig.findOne();
        reply.send(config || {});
    });

    app.post('/signconfig', { preHandler: verifyJWT }, async (req, reply) => {
        const { mode, point_mode, point_amount } = req.body;
        let config = await SignConfig.findOne();
        if (!config) {
            config = await SignConfig.create({ mode, point_mode, point_amount });
        } else {
            config.mode = mode;
            config.point_mode = point_mode;
            config.point_amount = point_amount;
            await config.save();
        }
        reply.send({ success: true });
    });

    app.post('/method', { preHandler: verifyJWT }, async (req, reply) => {
        const { name, description, status, slot_limit, point, limit_time } = req.body;
        if (!name) {
            return reply.code(400).send({ error: '缺少必要参数' });
        }
        try {
            const Method = require('@/database/models/Method');
            const record = await Method.create({
                name,
                description,
                status: status || 'active',
                slot_limit: slot_limit || 1000,
                point: typeof point === 'number' ? point : 0,
                limit_time: typeof limit_time === 'number' ? limit_time : 0,
            });
            reply.send({ success: true, id: record.id });
        } catch (err) {
            reply.code(500).send({ error: err.message });
        }
    });

    app.post('/method/:id/point', { preHandler: verifyJWT }, async (req, reply) => {
        const id = req.params.id;
        const { point } = req.body;
        if (typeof point !== 'number' || isNaN(point)) {
            return reply.code(400).send({ error: '缺少或非法的 point 参数' });
        }
        try {
            const Method = require('@/database/models/Method');
            const method = await Method.findByPk(id);
            if (!method) return reply.code(404).send({ error: '方法未找到' });
            method.point = point;
            await method.save();
            reply.send({ success: true });
        } catch (err) {
            reply.code(500).send({ error: err.message });
        }
    });

    app.post('/method/:id', { preHandler: verifyJWT }, async (req, reply) => {
        const id = req.params.id;
        const fields = req.body; // 允许 point, slot_limit, description, status, limit_time ...
        try {
            const Method = require('@/database/models/Method');
            const method = await Method.findByPk(id);
            if (!method) return reply.code(404).send({ error: '方法未找到' });

            // 只更新允许的字段
            [
                'name', 'description', 'status', 'slot_limit', 'point', 'limit_time'
            ].forEach(key => {
                if (typeof fields[key] !== 'undefined') method[key] = fields[key];
            });
            await method.save();
            reply.send({ success: true });
        } catch (err) {
            reply.code(500).send({ error: err.message });
        }
    });

    // 修改 API
    app.post('/api/:id', { preHandler: verifyJWT }, async (req, reply) => {
        const id = req.params.id;
        const { name, url, description, status, max_concurrency, method_ids } = req.body;
        if (!id) return reply.code(400).send({ error: '缺少API id' });

        try {
            const Api = require('@/database/models/Api');
            const api = await Api.findByPk(id);
            if (!api) return reply.code(404).send({ error: 'API未找到' });

            if (name !== undefined) api.name = name;
            if (url !== undefined) api.url = url;
            if (description !== undefined) api.description = description;
            if (status !== undefined) api.status = status;
            if (max_concurrency !== undefined) api.max_concurrency = max_concurrency;
            if (method_ids !== undefined) {
                // 支持传数组或逗号分隔字符串
                api.method_ids = Array.isArray(method_ids) ? method_ids.join(',') : method_ids;
            }

            await api.save();
            reply.send({ success: true });
        } catch (err) {
            reply.code(500).send({ error: err.message });
        }
    });

    // 新增 API
    app.post('/api', { preHandler: verifyJWT }, async (req, reply) => {
        const { name, url, description, status, max_concurrency, method_ids } = req.body;
        if (!name || !url) {
            return reply.code(400).send({ error: '缺少必要参数' });
        }
        try {
            const Api = require('@/database/models/Api');
            const record = await Api.create({
                name,
                url,
                description,
                status: status || 'active',
                max_concurrency: max_concurrency || 1000,
                method_ids: Array.isArray(method_ids) ? method_ids.join(',') : (method_ids || ''),
            });
            reply.send({ success: true, id: record.id });
        } catch (err) {
            reply.code(500).send({ error: err.message });
        }
    });

    // 后端加
    app.get('/api/list', { preHandler: verifyJWT }, async (req, reply) => {
        const Api = require('@/database/models/Api');
        const list = await Api.findAll();
        reply.send(list);
    });

    // 更新 API 绑定的方法
    app.post('/api/:id/methods', { preHandler: verifyJWT }, async (req, reply) => {
        const id = req.params.id;
        let { method_ids } = req.body; // 支持数组或逗号分隔字符串
        if (!id) return reply.code(400).send({ error: '缺少API ID' });

        if (Array.isArray(method_ids)) {
            method_ids = method_ids.join(',');
        }
        try {
            const Api = require('@/database/models/Api');
            const api = await Api.findByPk(id);
            if (!api) return reply.code(404).send({ error: 'API未找到' });
            api.method_ids = method_ids || '';
            await api.save();
            reply.send({ success: true });
        } catch (err) {
            reply.code(500).send({ error: err.message });
        }
    });

    // 获取所有方法
    app.get('/method/list', { preHandler: verifyJWT }, async (req, reply) => {
        const list = await require('@/database/models/Method').findAll();
        reply.send(list);
    });

    // 获取 API 已绑定方法
    app.get('/api/:id/methods', { preHandler: verifyJWT }, async (req, reply) => {
        const Api = require('@/database/models/Api');
        const Method = require('@/database/models/Method');
        const api = await Api.findByPk(req.params.id);
        if (!api) return reply.code(404).send({ error: 'API未找到' });

        const ids = api.method_ids
            ? api.method_ids.split(',').map(id => parseInt(id)).filter(Boolean)
            : [];
        const methods = ids.length
            ? await Method.findAll({ where: { id: ids } })
            : [];
        reply.send(methods);
    });

    app.post('/plan/:id', { preHandler: verifyJWT }, async (req, reply) => {
        const id = req.params.id;
        const fields = req.body;
        try {
            const Plan = require('@/database/models/Plan');
            const plan = await Plan.findByPk(id);
            if (!plan) return reply.code(404).send({ error: '套餐未找到' });
            Object.keys(fields).forEach(key => {
                if (typeof fields[key] !== 'undefined') plan[key] = fields[key];
            });
            await plan.save();
            reply.send({ success: true });
        } catch (err) {
            reply.code(500).send({ error: err.message });
        }
    });

    app.post('/plan', { preHandler: verifyJWT }, async (req, reply) => {
        const { name, price, period, max_time, max_concurrency, description, status } = req.body;
        if (!name || price == null || period == null || max_time == null || max_concurrency == null) {
            return reply.code(400).send({ error: '缺少必要参数' });
        }
        try {
            const Plan = require('@/database/models/Plan');
            const record = await Plan.create({
                name,
                price,
                period,
                max_time,
                max_concurrency,
                description,
                status: status || 'active'
            });
            reply.send({ success: true, id: record.id });
        } catch (err) {
            reply.code(500).send({ error: err.message });
        }
    });

    // 删除套餐
    app.post('/plan/:id/delete', { preHandler: verifyJWT }, async (req, reply) => {
        const id = req.params.id;
        try {
            const Plan = require('@/database/models/Plan');
            const plan = await Plan.findByPk(id);
            if (!plan) return reply.code(404).send({ error: '套餐未找到' });
            await plan.destroy();
            reply.send({ success: true });
        } catch (err) {
            reply.code(500).send({ error: err.message });
        }
    });

    // 套餐列表
    app.get('/plan/list', { preHandler: verifyJWT }, async (req, reply) => {
        const Plan = require('@/database/models/Plan');
        const list = await Plan.findAll();
        reply.send(list);
    });

    app.post('/cardkey/generate', { preHandler: verifyJWT }, async (req, reply) => {
        const { type, plan_id, point, count, prefix, length } = req.body;

        // 必要参数校验
        if (!type || !['plan', 'point'].includes(type)) {
            return reply.code(400).send({ error: 'type 必须是 plan 或 point' });
        }
        if (type === 'plan' && !plan_id) {
            return reply.code(400).send({ error: '套餐卡密需指定 plan_id' });
        }
        if (type === 'point' && !point) {
            return reply.code(400).send({ error: '积分卡密需指定 point' });
        }

        const n = typeof count === 'number' && count > 0 ? count : 1;
        const keys = await generateCardKeys(type, { plan_id, point, count: n, prefix: prefix || '', length: length || 16 });

        reply.send({
            success: true,
            count: keys.length,
            keys,
            message: `成功生成${keys.length}张卡密`,
        });
    });

    app.get('/cardkey/list', { preHandler: verifyJWT }, async (req, reply) => {
        let page = parseInt(req.query.page) || 1;
        let pageSize = parseInt(req.query.pageSize) || 20;
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        const offset = (page - 1) * pageSize;
        const { rows, count } = await CardKey.findAndCountAll({
            offset,
            limit: pageSize,
            order: [['id', 'DESC']]
        });

        // 如果你用 fastify，直接 reply.send，否则 return
        reply.send({
            list: rows,
            total: count,
            page,
            pageSize
        });
    });

    app.get('/cardkey/export', { preHandler: verifyJWT }, async (req, reply) => {
        const cardkeys = await CardKey.findAll({ order: [['id', 'DESC']] });
        // 选取需要导出的字段
        const data = cardkeys.map(item => ({
            id: item.id,
            code: item.code,
            prefix: item.prefix,
            length: item.length,
            type: item.type,
            plan_id: item.plan_id,
            point: item.point,
            status: item.status,
            used_by: item.used_by,
            used_time: item.used_time ? item.used_time.toISOString() : '',
            createdAt: item.createdAt ? item.createdAt.toISOString() : '',
        }));

        // 设置下载 header
        reply.header('Content-Type', 'text/csv; charset=utf-8');
        reply.header('Content-Disposition', `attachment; filename="cardkey_export_${Date.now()}.csv"`);

        // fast-csv 直接pipe到 reply.raw
        format.write(data, { headers: true }).pipe(reply.raw);
    });

    app.get('/user/list', { preHandler: verifyJWT }, async (req, reply) => {
        let page = parseInt(req.query.page) || 1;
        let pageSize = parseInt(req.query.pageSize) || 20;
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;
        const offset = (page - 1) * pageSize;

        const { rows, count } = await User.findAndCountAll({
            offset,
            limit: pageSize,
            order: [['id', 'DESC']],
            // 可以加 include: Plan，但如果没定义关联就注释掉
        });
        reply.send({ list: rows, total: count, page, pageSize });
    });

    // 2. 单用户详情
    app.get('/user/:id', { preHandler: verifyJWT }, async (req, reply) => {
        const user = await User.findByPk(req.params.id);
        if (!user) return reply.code(404).send({ error: '用户不存在' });
        reply.send(user);
    });

    // 3. 注册/新增用户
    app.post('/user/register', { preHandler: verifyJWT }, async (req, reply) => {
        const { tg_uid, username } = req.body;
        if (!tg_uid) return reply.code(400).send({ error: '缺少 tg_uid' });
        let user = await User.findOne({ where: { tg_uid } });
        if (user) return reply.send({ message: '已注册', user });
        user = await User.create({
            tg_uid,
            username: username || '',
            reg_time: new Date(),
            point: 0,
            status: 'active'
        });
        reply.send({ message: '注册成功', user });
    });

    // 4. 修改用户
    app.post('/user/:id/update', { preHandler: verifyJWT }, async (req, reply) => {
        const user = await User.findByPk(req.params.id);
        if (!user) return reply.code(404).send({ error: '用户不存在' });
        Object.assign(user, req.body);
        await user.save();
        reply.send({ success: true, user });
    });

    // 5. 封禁/解封
    app.post('/user/:id/ban', { preHandler: verifyJWT }, async (req, reply) => {
        const user = await User.findByPk(req.params.id);
        if (!user) return reply.code(404).send({ error: '用户不存在' });
        user.status = 'banned';
        await user.save();
        reply.send({ success: true });
    });

    app.post('/user/:id/unban', { preHandler: verifyJWT }, async (req, reply) => {
        const user = await User.findByPk(req.params.id);
        if (!user) return reply.code(404).send({ error: '用户不存在' });
        user.status = 'active';
        await user.save();
        reply.send({ success: true });
    });

    // 6. 积分增减
    app.post('/user/:id/point', { preHandler: verifyJWT }, async (req, reply) => {
        const { amount } = req.body;
        if (typeof amount !== 'number') return reply.code(400).send({ error: 'amount 必须为数字' });
        const user = await User.findByPk(req.params.id);
        if (!user) return reply.code(404).send({ error: '用户不存在' });
        user.point = (user.point || 0) + amount;
        await user.save();
        reply.send({ success: true, point: user.point });
    });

    // 7. 删除用户
    app.post('/user/:id/delete', { preHandler: verifyJWT }, async (req, reply) => {
        const user = await User.findByPk(req.params.id);
        if (!user) return reply.code(404).send({ error: '用户不存在' });
        await user.destroy();
        reply.send({ success: true });
    });

    // 8. 列出所有套餐（下拉用）
    app.get('/user/plan-list', { preHandler: verifyJWT }, async (req, reply) => {
        const plans = await Plan.findAll();
        reply.send(plans);
    });


};
