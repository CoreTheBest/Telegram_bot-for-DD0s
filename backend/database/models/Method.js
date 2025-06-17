const { DataTypes } = require('sequelize');
const { sequelize } = require('@/database');

const Method = sequelize.define('Method', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: '方法名，如 HTTP-FLOOD'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '方法说明'
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive'),
        defaultValue: 'active',
        allowNull: false,
        comment: '是否上架'
    },
    slot_limit: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: '最大卡槽/并发限制'
    },
    point: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '消耗积分/每次使用'
    },
    limit_time: { // 新增
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '最大允许攻击时长（秒），0为不限制'
    }
}, {
    tableName: 'Method',
    timestamps: true,
});


module.exports = Method;
