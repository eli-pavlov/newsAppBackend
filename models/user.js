const { DataTypes } = require('sequelize');
const seqClient = require('../api/sequelizeClient');

if (!seqClient)
    return;

const User = seqClient.define(
    'User',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      // Other model options go here
    },
);

module.exports = User;
