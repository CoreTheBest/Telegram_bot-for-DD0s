const { sequelize } = require('@/database');
const logger = require('@/utils/logger');
const { Data,SignConfig,CardKey,Plan,User,Task,Api,Method } = require('@/database/models');
// 同步所有模型（自动创建表）
async function syncDatabase() {
    try {
        await sequelize.sync({ alter: true }); // 使用 alter 可更新字段结构
        logger.success('✅ 数据库已成功同步（SQLite）');
    } catch (err) {
        logger.error('❌ 数据库同步失败:', err.message);
        process.exit(1); // 失败退出程序
    }
}

module.exports = { syncDatabase };
