const { getUnreadMessagesByUser } = require("../controllers/messageController");

const unreadMessagesHandler = async (ws, { userId, institutionId }) => {
  try {
    const unreadData = await getUnreadMessagesByUser(userId, institutionId = null)

    ws.send(
      JSON.stringify({
        event: 'unreadMessages',
        unreadCount: unreadData.count,
        groupData: unreadData.groups,
      })
    );
  } catch (error) {
    ws.send(
      JSON.stringify({
        event: 'error',
        message: 'Failed to fetch unread messages.',
      })
    );
  }
};

module.exports = unreadMessagesHandler;
