require('module-alias/register');
const fs = require('fs');
const path = require('path')
const config = require('config');
const logger = require('@/utils/logger');
const { syncDatabase } = require('@/database/sync');
const SignConfig = require('@/database/models/SignConfig');
const Data = require('@/database/models/Data');
const { sendBotWorkerMsg } = require('@/utils/botWorker');
const Config_Port = config.get('Core_Bot.Port');
const Config_Host = config.get('Core_Bot.Host');
const fastifyStatic = require('@fastify/static')

// 初始化签到参数
async function initSignConfig() {
    const [signCfg, created] = await SignConfig.findOrCreate({
        where: { id: 1 },
        defaults: {
            mode: '24h',
            point_mode: 'random',
            point_amount: '15-30'
        }
    });
    if (created) {
        logger.success('✅ 签到参数初始化完成');
    } else {
        logger.info('🔄 已加载现有签到参数配置');
    }
}

// 自动尝试启动 Bot worker
async function tryStartBot() {
    const configRow = await Data.findOne();
    if (!configRow?.BOTTOKEN) {
        logger.warn('⚠️ 未检测到 BOTTOKEN，Bot 未启动，请先通过面板或接口配置后手动启动');
        return;
    }
    sendBotWorkerMsg('start');
}


async function startFastifyServer() {
    const fastify = require('fastify')({ logger: false });
    const staticRoot = path.join(process.cwd(), 'frontend', 'bot_web', 'dist');

    fastify.register(fastifyStatic, {
        root: staticRoot,
        prefix: '/',
        decorateReply: false
    });


    fastify.register(require('@/router'), { prefix: '/api' });


    fastify.setNotFoundHandler(function (req, reply) {
        if (req.raw.url.startsWith('/api')) {
            reply.code(404).send({ message: 'API Not Found' });
            return;
        }
        reply.type('text/html').send(
            fs.readFileSync(path.join(staticRoot, 'index.html'))
        );
    });

    await fastify.listen({ port: Config_Port, host: Config_Host });
    logger.success(`🚀 Fastify 启动成功：http://localhost:${Config_Port}`);

}



// 启动入口
(async () => {
    try {
        await syncDatabase();
        await initSignConfig();
        await tryStartBot();
        await startFastifyServer();


    } catch (err) {
        logger.error('❌ 启动失败:', err.message);
        process.exit(1);
    }
})();
