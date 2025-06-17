const { Sequelize } = require('sequelize');
const config = require('config');
const path = require('path');

const dbPath = config.get('Core_Bot.SQL_file');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.resolve(__dirname, '..', '..', dbPath),
    logging: false,
});

module.exports = { sequelize };
