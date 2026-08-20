// utils/api.js —— 云函数调用封装
function call(name, data = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud
      .callFunction({ name, data })
      .then((res) => {
        if (res && res.result && res.result.code !== undefined && res.result.code !== 0) {
          reject(new Error(res.result.error || '调用失败'));
        } else {
          resolve(res.result);
        }
      })
      .catch((err) => reject(err));
  });
}

module.exports = { call };