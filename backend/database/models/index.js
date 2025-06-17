const fs = require('fs');
const path = require('path');
const basename = path.basename(__filename);

const models = {};

// 1. 先全部加载模型
fs.readdirSync(__dirname)
    .filter((file) =>
        file !== basename &&
        file.endsWith('.js')
    )
    .forEach((file) => {
        const model = require(path.join(__dirname, file));
        // 防止有 module.exports = {...} 不是 sequelize.define
        if (model && model.name) {
            models[model.name] = model;
        }
    });

// 2. 统一配置模型关联
// 约定：User, Task, Method, Plan等模型都已加载到 models
if (models.User && models.Task) {
    // 假设 Task 用 user_id 关联 User（推荐），否则用 tg_uid 也可以
    models.User.hasMany(models.Task, { foreignKey: 'tg_uid', sourceKey: 'tg_uid', as: 'tasks' });
    models.Task.belongsTo(models.User, { foreignKey: 'tg_uid', targetKey: 'tg_uid', as: 'user' });
}

if (models.Method && models.Task) {
    // Task <-> Method
    models.Method.hasMany(models.Task, { foreignKey: 'method_id', sourceKey: 'id', as: 'tasks' });
    models.Task.belongsTo(models.Method, { foreignKey: 'method_id', targetKey: 'id', as: 'method' });
}

if (models.Plan && models.User) {
    // User <-> Plan
    models.Plan.hasMany(models.User, { foreignKey: 'plan_id', sourceKey: 'id', as: 'users' });
    models.User.belongsTo(models.Plan, { foreignKey: 'plan_id', targetKey: 'id', as: 'plan' });
}


module.exports = models;
