// cloudfunctions/login/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  const { OPENID, APPID } = cloud.getWXContext();
  if (!OPENID) return { openid: '' };

  const users = db.collection('users');
  const exist = await users.where({ openid: OPENID }).limit(1).get();

  if (!exist.data.length) {
    await users.add({
      data: {
        openid: OPENID,
        nickname: '',
        avatar: '',
        createdAt: Date.now(),
        lastChatAt: null
      }
    });
  }

  return { openid: OPENID, appid: APPID };
};