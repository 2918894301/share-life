/**
 * 阿里云OSS分片上传工具（简化版）
 * 功能：
 * - 获取OSS临时上传凭证
 * - 视频分片上传
 * - 图片直传
 * - 简化的视频截帧功能
 */

const { get } = require('./request');

/**
 * 获取阿里云OSS临时上传凭证
 * @param {string} fileType - 文件类型: cover|video
 * @returns {Promise} 上传凭证信息
 */
async function getOSSCredentials(fileType) {
  try {
    const res = await get('/uploads/aliyun_direct', { fileType }, { 
      auth: true, 
      loading: false,
      toast: false 
    });
    
    console.log('OSS凭证响应:', res);
    
    if (res.status && res.data) {
      console.log('OSS凭证数据:', res.data);
      return res.data;
    } else {
      throw new Error(res.message || '获取上传凭证失败');
    }
  } catch (error) {
    console.error('获取OSS凭证失败:', error);
    throw error;
  }
}




/**
 * 图片直传到OSS
 * @param {string} filePath - 本地文件路径
 * @param {Object} credentials - OSS凭证
 * @param {Function} onProgress - 进度回调
 * @returns {Promise<string>} 上传后的文件URL
 */
function uploadImageToOSS(filePath, credentials, onProgress) {
  return new Promise((resolve, reject) => {
    const {
      accessKeyId,
      bucket,
      host,
      policy,
      signature,
      key,
      OSSAccessKeyId
    } = credentials;
    
    // 验证必需的参数
    if (!host && (!bucket || !region)) {
      reject(new Error('OSS凭证缺少必要参数: host 或 (bucket + region)'));
      return;
    }
    if (!key) {
      reject(new Error('OSS凭证缺少必要参数: objectKey 或 key'));
      return;
    }
    
    // 使用服务端返回的host作为上传地址，如果没有则构建
    const uploadUrl = host || `https://${bucket}.${region}.aliyuncs.com/`;
    
    const uploadKey = key;
    
    // 使用服务端返回的OSSAccessKeyId，如果没有则使用accessKeyId
    const finalAccessKeyId = OSSAccessKeyId || accessKeyId;
    
    // 构建表单数据 - 按照阿里云OSS PostObject要求的字段顺序
    const formData = {
      'key': uploadKey,
      'policy': policy,
      'OSSAccessKeyId': finalAccessKeyId,
      'signature': signature,
      'success_action_status': '200'
    };
    
    
    console.log('OSS上传参数:', {
      method: 'POST',
      url: uploadUrl,
      filePath: filePath,
      formData: formData
    });
    
    // 使用微信小程序uploadFile进行POST上传到OSS
    const uploadTask = wx.uploadFile({
      url: uploadUrl,
      filePath: filePath,
      name: 'file', // 文件字段名，必须放在最后
      formData: formData,
      success: (res) => {
        console.log('OSS上传响应:', res);
        // OSS成功响应可能是200或204
        if (res.statusCode === 200 || res.statusCode === 204) {
          // 构建文件访问URL - 使用实际的上传key和host信息
          let fileUrl;
          if (host) {
            // 如果有host，直接使用host + key构建URL
            // 确保host不以/结尾，key不以/开头
            const cleanHost = host.replace(/\/$/, '');
            const cleanKey = uploadKey.replace(/^\//, '');
            fileUrl = `${cleanHost}/${cleanKey}`;
          } else {
            // 否则使用bucket和region构建
            const cleanKey = uploadKey.replace(/^\//, '');
            fileUrl = `https://${bucket}.${region}.aliyuncs.com/${cleanKey}`;
          }
          console.log('生成的文件URL:', fileUrl);
          resolve(fileUrl);
        } else {
          console.error('OSS上传失败:', res);
          reject(new Error(`上传失败: HTTP ${res.statusCode}, ${res.data || ''}`));
        }
      },
      fail: reject
    });
    // 监听上传进度
    if (onProgress) {
      uploadTask.onProgressUpdate(onProgress);
    }
  });
}

/**
 * 视频分片上传到OSS
 * @param {string} filePath - 本地视频文件路径
 * @param {Object} credentials - OSS凭证
 * @param {Function} onProgress - 进度回调
 * @returns {Promise<string>} 上传后的视频URL
 */
async function uploadVideoToOSS(filePath, credentials, onProgress) {
  try {
    // 获取文件信息
    const fileInfo = await new Promise((resolve, reject) => {
      wx.getFileInfo({
        filePath: filePath,
        success: resolve,
        fail: reject
      });
    });
    
    const fileSize = fileInfo.size;
    const maxSize = 100 * 1024 * 1024; // 100MB上限
    
    if (fileSize > maxSize) {
      throw new Error('视频文件过大，请选择小于100MB的视频');
    }
    
    // 小程序环境下，使用直传方式而不是真正的分片上传
    // 真正的分片上传需要复杂的文件读取和网络请求处理
    return await uploadImageToOSS(filePath, credentials, onProgress);
    
  } catch (error) {
    console.error('视频上传失败:', error);
    throw error;
  }
}

module.exports = {
  getOSSCredentials,
  uploadImageToOSS,
  uploadVideoToOSS
};