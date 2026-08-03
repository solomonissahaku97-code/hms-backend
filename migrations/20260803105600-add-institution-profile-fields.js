'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('institutions', 'short_description', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('institutions', 'about', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('institutions', 'mission', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('institutions', 'vision', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('institutions', 'core_values', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('institutions', 'website', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('institutions', 'opening_hours', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: [],
    });
    await queryInterface.addColumn('institutions', 'emergency_contact', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('institutions', 'services_offered', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('institutions', 'facilities_available', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('institutions', 'social_media_links', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: {},
    });
    await queryInterface.addColumn('institutions', 'gallery_images', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: [],
    });
    await queryInterface.addColumn('institutions', 'banner_image_url', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('institutions', 'short_description');
    await queryInterface.removeColumn('institutions', 'about');
    await queryInterface.removeColumn('institutions', 'mission');
    await queryInterface.removeColumn('institutions', 'vision');
    await queryInterface.removeColumn('institutions', 'core_values');
    await queryInterface.removeColumn('institutions', 'website');
    await queryInterface.removeColumn('institutions', 'opening_hours');
    await queryInterface.removeColumn('institutions', 'emergency_contact');
    await queryInterface.removeColumn('institutions', 'services_offered');
    await queryInterface.removeColumn('institutions', 'facilities_available');
    await queryInterface.removeColumn('institutions', 'social_media_links');
    await queryInterface.removeColumn('institutions', 'gallery_images');
    await queryInterface.removeColumn('institutions', 'banner_image_url');
  },
};
