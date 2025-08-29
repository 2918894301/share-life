// 引入封装的请求模块
const { uploadFile, post } = require('../../utils/request');

Page({
  data: {
    userInfo: {
      avatar: '',
      nickname: '',
      bio: '',
      userId: ''
    },
    isLoading: false,
    tempAvatarPath: '' // 临时头像路径
  },

  onLoad() {
    this.getCurrentUser();
  },

  // 获取当前用户信息
  getCurrentUser() {
    // 从本地存储获取用户信息
    const userInfo = wx.getStorageSync('userInfo');
    
    if (userInfo) {
      this.setData({
        userInfo: {
          userId: userInfo.id || '',
          avatar: userInfo.avatar || '',
          nickname: userInfo.nickname || '',
          bio: userInfo.signature || ''
        }
      });
    } else {
      // 如果本地没有用户信息，跳转到登录页
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        success: () => {
          setTimeout(() => {
            wx.navigateTo({
              url: '/pages/login/login'
            });
          }, 1500);
        }
      });
    }
  },

  // 选择头像
  chooseAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        
        // 检查文件类型是否为图片
        if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(tempFilePath)) {
          wx.showToast({
            title: '只能上传图片文件',
            icon: 'none'
          });
          return;
        }
        
        // 先预览头像
        this.setData({
          'userInfo.avatar': tempFilePath,
          tempAvatarPath: tempFilePath // 保存临时路径，用于后续上传
        });
      }
    });
  },

  // 昵称输入
  onNicknameInput(e) {
    this.setData({
      'userInfo.nickname': e.detail.value
    });
  },

  // 个性签名输入
  onBioInput(e) {
    this.setData({
      'userInfo.bio': e.detail.value
    });
  },

  // 保存用户信息
  async saveUserInfo() {
    // 验证昵称
    if (!this.data.userInfo.nickname.trim()) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      });
      return;
    }

    // 防止重复提交
    if (this.data.isLoading) return;
    
    this.setData({
      isLoading: true
    });

    try {
      // 显示保存中提示
      wx.showLoading({
        title: '保存中...'
      });
      
      // 准备表单数据
      const formData = {
        nickname: this.data.userInfo.nickname,
        signature: this.data.userInfo.bio
      };
      
      // 确定要上传的头像路径
      const avatarPath = this.data.tempAvatarPath || this.data.userInfo.avatar;
      
      // 检查是否需要上传头像
      const needUploadAvatar = this.data.tempAvatarPath && 
                              (this.data.tempAvatarPath.startsWith('http://tmp') || 
                               this.data.tempAvatarPath.startsWith('wxfile://'));
      
      let res;
      if (needUploadAvatar) {
        // 使用uploadFile方法上传头像和其他数据
        res = await uploadFile(
          '/users/updateUserInfo',
          avatarPath,
          'avatar',
          formData,
          {
            auth: true,
            loading: false, // 已经显示了loading
            toast: true
          }
        );
      } else {
        // 只更新用户信息，不上传头像
        res = await post('/users/updateUserInfo', formData, {
          auth: true,
          loading: false,
          toast: true
        });
      }
      
      // 处理响应
      if (res.status) {
        // 更新本地存储的用户信息
        const userData = res.data;
        wx.setStorageSync('userInfo', userData);
        
        wx.hideLoading();
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
        
        // 返回上一页并刷新
        const pages = getCurrentPages();
        const prevPage = pages[pages.length - 2];
        if (prevPage && prevPage.getCurrentUser) {
          prevPage.getCurrentUser();
        }
        
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        throw new Error(res.message || '保存失败');
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({
        title: err.message || '保存失败',
        icon: 'none'
      });
      console.error('保存用户信息失败:', err);
    } finally {
      this.setData({
        isLoading: false
      });
    }
  },

  // 退出登录
  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      showCancel: true,
      cancelText: '取消',
      confirmText: '退出',
      confirmColor: '#ff2442',
      success: (res) => {
        if (res.confirm) {
          this.performLogout();
        }
      }
    });
  },

  // 执行退出登录操作
  performLogout() {
    try {
      // 清除本地存储的用户信息和token
      wx.removeStorageSync('userInfo');
      wx.removeStorageSync('token');
      wx.removeStorageSync('userId');
      
      wx.showToast({
        title: '退出成功',
        icon: 'success',
        duration: 1500
      });

      // 延迟跳转到登录页面
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/login/login'
        });
      }, 1500);
      
    } catch (error) {
      console.error('退出登录失败:', error);
      wx.showToast({
        title: '退出失败',
        icon: 'none'
      });
    }
  }
})