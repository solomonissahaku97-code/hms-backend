const PushNotifications = require('@pusher/push-notifications-server');

const beamsClient = new PushNotifications({
    instanceId: "d9fe2540-c217-4b5c-b986-d96c371ccd47",
    secretKey: "21929B8F19C98B84DF90161A38ECEC0531D072C6538922C29B56D9CE311A465F"
});

module.exports = beamsClient;
