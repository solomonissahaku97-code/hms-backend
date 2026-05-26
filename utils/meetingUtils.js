const crypto = require("crypto");

function generateMeetingRoom() {
  const randomString = crypto.randomBytes(6).toString("hex");
  return `virtual-meeting-${randomString}`;
}


function generateGoodLink() {
  const timestamp = Date.now().toString().slice(-5); // Use last 5 digits of timestamp
  return `overcomers-consultation-${timestamp}`;
}

module.exports = {
  generateMeetingRoom,
  generateGoodLink,
};
