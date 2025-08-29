/**
 * 轻量网络请求封装（微信小程序）
 * - GET/POST/PUT/DELETE
 * - 统一 BASE_URL、加载提示、错误提示
 * - 可选鉴权（默认开启）：自动携带 token，缺失时跳转登录
 */

const BASE_URL = 'http://192.168.1.8:3000';

const ensureAbsoluteUrl = (url) => url.startsWith('http') ? url : `${BASE_URL}${url.startsWith('/') ? url : '/' + url}`;

const showLoading = (title = '加载中...') => wx.showLoading({ title, mask: true });
const hideLoading = () => wx.hideLoading();

const showToast = (title = '请求失败') => wx.showToast({ title, icon: 'none', duration: 2000 });

const navigateToLogin = () => {
  const pages = getCurrentPages();
  const currentRoute = pages[pages.length - 1]?.route || '';
  if (currentRoute !== 'pages/login/login') {
    setTimeout(() => wx.navigateTo({ url: '/pages/login/login' }), 300);
  }
};

const clearAuthStorage = () => {
  wx.removeStorageSync('token');
  wx.removeStorageSync('userInfo');
  wx.removeStorageSync('userId');
  wx.removeStorageSync('userPhone');
};

const requireLoginIfNeeded = (needAuth) => {
  if (!needAuth) return true;
  const openid = wx.getStorageSync('openid');
  const token = wx.getStorageSync('token');
  return Boolean(openid || token);
};

const request = (options = {}) => {
  const {
    url = '',
    method = 'GET',
    data = {},
    header = {},
    loading = true,
    auth = true,
    toast = true
  } = options;
  
  if (!url) return Promise.reject({ code: -1, message: '缺少请求地址' });

  if (auth && !requireLoginIfNeeded(true)) {
    if (toast) showToast('请先登录');
    navigateToLogin();
    return Promise.reject({ code: 401, message: '未登录' });
  }

  const finalUrl = ensureAbsoluteUrl(url);
  
  const finalHeader = { 'Content-Type': 'application/json', ...header };
  if (auth) {
    const token = wx.getStorageSync('token');
    if (token) finalHeader.token = token;
  }

  if (loading) showLoading();

  return new Promise((resolve, reject) => {
    wx.request({
      url: finalUrl,
      method,
      data,
      header: finalHeader,
      success: (res) => {
        if (loading) hideLoading();
        const { statusCode, data: resp } = res;

        if (statusCode >= 200 && statusCode < 300) {
          if (resp && resp.status === false) {
            if (toast) showToast(resp.message || (resp.errors && resp.errors[0]) || '请求失败');
            // 仍返回完整响应
            resolve(resp);
          } else {
            resolve(resp);
          }
          return;
        }
        
        if (statusCode === 401) {
          clearAuthStorage();
          if (toast) showToast((resp && resp.message) || '登录已过期，请重新登录');
          navigateToLogin();
          reject({ code: 401, message: '未授权或登录已过期', data: resp });
          return;
        }
        
        if (toast) showToast((resp && resp.message) || '请求失败');
        reject({ code: statusCode, message: (resp && resp.message) || '请求失败', data: resp });
      },
      fail: (err) => {
        if (loading) hideLoading();
        if (toast) showToast('网络请求失败');
        reject({ code: -1, message: '网络请求失败', error: err });
      }
    });
  });
};

const get = (url, data = {}, opts = {}) => request({ url, method: 'GET', data, ...opts });
const post = (url, data = {}, opts = {}) => request({ url, method: 'POST', data, ...opts });

// 统一文件上传方法
const uploadFile = (url, filePath, name = 'file', formData = {}, opts = {}) => {
  const { 
    header = {}, 
    loading = true, 
    auth = true, 
    toast = true 
  } = opts;
  // 参数验证
  if (!url) {
    return Promise.reject({ code: -1, message: '缺少请求地址' });
  }
  
  if (!filePath) {
    return Promise.reject({ code: -1, message: '缺少文件路径' });
  }

  if (auth && !requireLoginIfNeeded(true)) {
    if (toast) showToast('请先登录');
    navigateToLogin();
    return Promise.reject({ code: 401, message: '未登录' });
  }

  const finalUrl = ensureAbsoluteUrl(url);
  const finalHeader = { ...header };
  
  // 添加认证头
  if (auth) {
    const token = wx.getStorageSync('token');
    if (token) {
      finalHeader['Authorization'] = `Bearer ${token}`;
      finalHeader['token'] = token;
    }
  }

  if (loading) showLoading('上传中...');
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: finalUrl,
      filePath: filePath,
      name: name,
      formData: formData,
      header: finalHeader,
      success: (res) => {
        if (loading) hideLoading();

        let resp = res.data;
        try { 
          resp = JSON.parse(res.data); 
        } catch (_) {
          // 如果解析失败，使用原始数据
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (resp && resp.status === false) {
            if (toast) showToast(resp.message || (resp.errors && resp.errors[0]) || '上传失败');
            resolve(resp);
          } else {
            resolve(resp);
          }
          return;
        }
        
        if (res.statusCode === 401) {
          clearAuthStorage();
          if (toast) showToast((resp && resp.message) || '登录已过期，请重新登录');
          navigateToLogin();
          reject({ code: 401, message: '未授权或登录已过期', data: resp });
          return;
        }
        
        if (toast) showToast((resp && resp.message) || '上传失败');
        reject({ code: res.statusCode, message: (resp && resp.message) || '上传失败', data: resp });
      },
      fail: (err) => {
        if (loading) hideLoading();
        if (toast) showToast('上传失败');
        reject({ code: -1, message: '上传失败', error: err });
      }
    });
  });
};


module.exports = {
  BASE_URL,
  request,
  get,
  post,
  uploadFile
};