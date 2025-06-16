const { DataTypes } = require('sequelize');
const { sequelize } = require('@/database');

const Api = sequelize.define('Api', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'API名称'
    },
    url: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'API地址/节点地址，如 https://xxx/api'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '描述/备注'
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive'),
        defaultValue: 'active',
        allowNull: false,
        comment: '是否可用'
    },
    max_concurrency: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: '最大可用并发数'
    },
    method_ids: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '可用Method的ID列表，用逗号分隔，例如: 1,5,2'
    }
}, {
    tableName: 'Api',
    timestamps: true,
});

module.exports = Api;
