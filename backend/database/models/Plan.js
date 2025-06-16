const { DataTypes } = require('sequelize');
const { sequelize } = require('@/database');

const Plan = sequelize.define('Plan', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: '套餐名称'
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: '套餐价格'
    },
    period: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 30,
        comment: '有效期，单位天'
    },
    max_time: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 3600,
        comment: '最大单次可用时长，单位秒'
    },
    max_concurrency: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: '最大并发/最大卡槽数'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '套餐描述'
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive'),
        defaultValue: 'active',
        allowNull: false,
        comment: '是否上架'
    }
}, {
    tableName: 'Plan',
    timestamps: true,
});

module.exports = Plan;
