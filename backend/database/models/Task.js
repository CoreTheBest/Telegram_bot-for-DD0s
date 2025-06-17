const { DataTypes } = require('sequelize');
const { sequelize } = require('@/database');

const Task = sequelize.define('Task', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    tg_uid: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '下发任务用户ID',
    },
    target: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '目标（如url/ip/域名）'
    },
    params: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: '任务参数（如method/threads/duration等）'
    },
    method_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '关联的攻击方法ID'
    },
    api_id: {                    // 👈 新增字段！
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '使用的API节点ID'
    },
    status: {
        type: DataTypes.ENUM('pending', 'running', 'finished', 'error', 'aborted'),
        allowNull: false,
        defaultValue: 'pending',
        comment: '任务状态'
    },
    start_time: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '实际开始时间'
    },
    end_time: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '结束时间'
    },
}, {
    tableName: 'Task',
    timestamps: true,
});


module.exports = Task;
