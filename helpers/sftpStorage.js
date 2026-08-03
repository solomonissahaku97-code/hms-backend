const Client = require('ssh2-sftp-client');
require('dotenv').config();

let sftpClient = null;

async function getSftpClient() {
  if (!sftpClient) {
    sftpClient = new Client();
    const config = {
      host: process.env.BACKUP_STORAGE_HOST,
      port: Number(process.env.BACKUP_STORAGE_PORT || 22),
      username: process.env.BACKUP_STORAGE_USER,
      password: process.env.BACKUP_STORAGE_PASS,
    };

    await sftpClient.connect(config);
  }
  return sftpClient;
}

async function uploadToSftp(localPath, remoteFileName, remoteDir = '') {
  const sftp = await getSftpClient();
  const path = remoteDir ? `${remoteDir}/${remoteFileName}` : remoteFileName;
  const remotePath = `/public_html/${path}`;

  await sftp.fastPut(localPath, remotePath);
  return getPublicUrl(remoteFileName, remoteDir);
}

async function deleteFromSftp(remoteFileName, remoteDir = '') {
  const sftp = await getSftpClient();
  const path = remoteDir ? `${remoteDir}/${remoteFileName}` : remoteFileName;
  const remotePath = `/public_html/${path}`;

  try {
    await sftp.delete(remotePath);
  } catch (err) {
    console.error('SFTP delete failed:', err.message);
  }
}

function getPublicUrl(remoteFileName, remoteDir = '') {
  const base = (process.env.PUBLIC_STORAGE_URL || `http://${process.env.BACKUP_STORAGE_HOST}/public_html`).replace(/\/$/, '');
  const path = remoteDir ? `${remoteDir}/${remoteFileName}` : remoteFileName;
  return `${base}/${path}`;
}

module.exports = {
  uploadToSftp,
  deleteFromSftp,
  getPublicUrl,
};
