'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const columns = [
      { name: 'short_description', type: Sequelize.TEXT },
      { name: 'about', type: Sequelize.TEXT },
      { name: 'mission', type: Sequelize.TEXT },
      { name: 'vision', type: Sequelize.TEXT },
      { name: 'core_values', type: Sequelize.TEXT },
      { name: 'website', type: Sequelize.STRING },
      { name: 'opening_hours', type: Sequelize.JSON, defaultValue: [] },
      { name: 'emergency_contact', type: Sequelize.STRING },
      { name: 'services_offered', type: Sequelize.TEXT },
      { name: 'facilities_available', type: Sequelize.TEXT },
      { name: 'social_media_links', type: Sequelize.JSON, defaultValue: {} },
      { name: 'gallery_images', type: Sequelize.JSON, defaultValue: [] },
      { name: 'banner_image_url', type: Sequelize.STRING }
    ];

    for (const col of columns) {
      try {
        await queryInterface.addColumn('institutions', col.name, {
          type: col.type,
          allowNull: true,
          ...(col.defaultValue !== undefined ? { defaultValue: col.defaultValue } : {})
        });
      } catch (err) {
        if (err.message && err.message.includes('already exists')) {
          continue;
        }
        throw err;
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    const columns = [
      'short_description', 'about', 'mission', 'vision', 'core_values', 'website',
      'opening_hours', 'emergency_contact', 'services_offered', 'facilities_available',
      'social_media_links', 'gallery_images', 'banner_image_url'
    ];

    for (const col of columns) {
      try {
        await queryInterface.removeColumn('institutions', col);
      } catch (err) {
        if (err.message && err.message.includes('does not exist')) {
          continue;
        }
        throw err;
      }
    }
  }
};
