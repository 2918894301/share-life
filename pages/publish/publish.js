/**
 * 发布页面
 * 功能：
 * - 支持图文和视频两种笔记类型
 * - 图片选择和预览（最多5张）
 * - 视频选择和播放预览（1个）
 * - 分类选择和位置添加
 * - 文件上传和笔记创建
 * - 表单验证和发布状态管理
 */

const { get, post, uploadFile } = require('../../utils/request');
Page({

  data: {

    images: [],              // 选择的图片列表（最多5张）
    videos: [],              // 选择的视频列表（最多1个）
    title: '',               
    content: '',             
    
    // 发布设置
    categories: [],         
    selectedCategory: '',    
    location: null,          
    
    canPublish: false,       
    uploadingVideo: false,  
  },


  onLoad() {
    this.loadCategories();   
  },

  /**
   * 加载分类数据
   */
  async loadCategories() {
    try {
      const res = await get('/categories', {}, { auth: false });
      
      if (res && res.status && res.data) {
        const categories = Array.isArray(res.data) ? res.data : [];
        this.setData({ categories });
  
      } else {
        console.error('分类数据格式错误:', res);
        this.setDefaultCategories();  
      }
    } catch (error) {
      console.error('获取分类失败:', error);
      this.setDefaultCategories();   
    }
  },

  /**
   * 设置默认分类数据
   */
  setDefaultCategories() {
    this.setData({
      categories: [
        { id: 1, name: '生活' },
        { id: 2, name: '美食' },
        { id: 3, name: '旅行' },
        { id: 4, name: '时尚' },
        { id: 5, name: '健身' }
      ]
    });
  },

  //选择媒体文件（图片或视频）
  chooseMedia() {
    if (this.data.videos.length > 0) {
      wx.showToast({
        title: '已上传视频，无法添加更多文件',
        icon: 'none'
      });
      return;
    }

    if (this.data.images.length > 0) {
      if (this.data.images.length >= 5) {
        wx.showToast({
          title: '最多只能选择5张图片',
          icon: 'none'
        });
        return;
      }
      
      // 选择剩余数量的图片
      this.selectImages(5 - this.data.images.length);
      return;
    }
    wx.showActionSheet({
      itemList: ['选择图片', '选择视频'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.selectImages(5);    
        } else {
          this.selectVideo();       
        }
      }
    });
  },

  /**
   * 选择图片文件
   * @param {number} count - 可选择的图片数量
   */
  selectImages(count) {
    wx.chooseMedia({
      count: count,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.processImageFiles(res.tempFiles);
      },
      fail: (err) => {
        console.error('选择图片失败:', err);
      }
    });
  },

  /**
   * 选择视频文件
   */
  selectVideo() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      sourceType: ['album', 'camera'],
      maxDuration: 60,    // 最大60秒
      camera: 'back',     // 后置摄像头
      success: (res) => {
        this.processVideoFiles(res.tempFiles);
      },
      fail: (err) => {
        console.error('选择视频失败:', err);
      }
    });
  },
  // 处理图片文件
  async processImageFiles(tempFiles) {
    wx.showLoading({ title: '处理中...' });

    try {
      const validFiles = [];
      
      for (const file of tempFiles) {
        if (file.size > 10 * 1024 * 1024) {
          wx.showToast({
            title: `图片大小不能超过10MB`,
            icon: 'none'
          });
          continue;
        }
        validFiles.push({
          tempFilePath: file.tempFilePath,
          size: file.size,
          width: file.width || 0,
          height: file.height || 0
        });
      }

      if (validFiles.length > 0) {
        const currentImages = [...this.data.images];
        const newImages = [...currentImages, ...validFiles];
        
        // 确保不超过5张
        if (newImages.length > 5) {
          wx.showToast({
            title: '最多只能选择5张图片',
            icon: 'none'
          });
          this.setData({ images: newImages.slice(0, 5) });
        } else {
          this.setData({ images: newImages });
        }
        this.checkCanPublish();
      }
    } catch (error) {
      console.error('处理图片失败:', error);
      wx.showToast({
        title: '处理图片失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 处理视频文件
  async processVideoFiles(tempFiles) {
    wx.showLoading({ title: '处理中...' });

    try {
      const file = tempFiles[0]; 
      
      // 检查文件大小，限制50MB
      if (file.size > 100 * 1024 * 1024) {
        wx.showToast({
          title: '视频大小不能超过50MB',
          icon: 'none'
        });
        return;
      }

      const videoData = {
        tempFilePath: file.tempFilePath,
        duration: file.duration || 0,
        size: file.size,
        width: file.width || 0,
        height: file.height || 0
      };
      this.setData({ 
        images: [],
        videos: [videoData]
      });
      this.checkCanPublish();
    } catch (error) {
      wx.showToast({
        title: '处理视频失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },
  // 删除媒体文件
  deleteMedia(e) {
    const { index, type } = e.currentTarget.dataset;
    if (type === 'video') {
      this.setData({ videos: [] });
    } else {
      const images = this.data.images;
      images.splice(index, 1);
      this.setData({ images });
    }
    this.checkCanPublish();
  },
  // 标题输入
  onTitleInput(e) {
    this.setData({
      title: e.detail.value
    });
    this.checkCanPublish();
  },

  // 内容输入
  onContentInput(e) {
    this.setData({
      content: e.detail.value
    });
    this.checkCanPublish();
  },

  // 选择分类
  selectCategory(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      selectedCategory: id
    });
    this.checkCanPublish();
  },
  // 提取省份/直辖市名称
  extractProvince(address) {
    if (!address) return '';
    const municipalities = ['北京', '上海', '天津', '重庆'];
    const autonomousRegions = [
      '内蒙古', '广西', '西藏', '宁夏', '新疆', 
      '香港', '澳门'
    ];
    for (const city of municipalities) {
      if (address.includes(city)) {
        return city;
      }
    }
    for (const region of autonomousRegions) {
      if (address.includes(region)) {
        return region;
      }
    }
    const provinceMatch = address.match(/^([^省市区县]*)省/);
    if (provinceMatch) {
      return provinceMatch[1];
    }
  },
  chooseLocation() {
    const that = this;
    // 统一的错误处理函数
    const handleLocationError = (errMsg = '获取位置失败') => {
      console.error(errMsg);
      wx.showToast({
        title: errMsg,
        icon: 'none'
      });
    };
    // 统一的权限处理函数
    const handleAuthError = () => {
      wx.showModal({
        title: '提示',
        content: '需要您授权使用位置信息，是否去设置？',
        success: (res) => {
          if (res.confirm) {
            wx.openSetting({
              success: (settingRes) => {
                if (settingRes.authSetting['scope.userLocation']) {
                  that.chooseLocation();
                }
              }
            });
          }
        }
      });
    };
    wx.authorize({
      scope: 'scope.userLocation',
      success() {
        wx.getLocation({
          type: 'gcj02',
          success(res) {
            wx.chooseLocation({
              latitude: res.latitude,
              longitude: res.longitude,
              success: (location) => {
                const provinceName = that.extractProvince(location.address);
                that.setData({
                  location: {
                    name: provinceName,
                    address: location.address,
                    latitude: location.latitude,
                    longitude: location.longitude
                  }
                });
              },
              fail: (err) => {
                if (err.errMsg && err.errMsg.indexOf('auth deny') !== -1) {
                  handleAuthError();
                } else {
                  handleLocationError('选择位置失败');
                }
              }
            });
          },
          fail: () => handleLocationError('获取位置失败')
        });
      },
      fail: handleAuthError
    });
  },

  // 检查是否可以发布
  checkCanPublish() {
    const { images, videos, title } = this.data;
    const hasMedia = images.length > 0 || videos.length > 0;
    const canPublish = hasMedia && title.trim() ;
    this.setData({ canPublish });
  },

  // 取消发布
  onCancel() {
    wx.navigateBack();
  },

  // 发布笔记
  async onPublish() {
    if (!this.data.canPublish) return;

    const { images, videos } = this.data;
    
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }
    if (images.length > 0) {
      wx.showLoading({ title: '上传图片中...' });
    } else {
      wx.showLoading({ title: '发布中...' });
    }
    try {
      let result;
      if (videos.length > 0) {
        result = await this.uploadVideoNote();
      } else if (images.length > 0) {
        result = await this.uploadImageNote();
      } else {
        wx.hideLoading();
        wx.showToast({
          title: '请选择图片或视频',
          icon: 'none'
        });
        return;
      }
      wx.hideLoading();
      if (result && result.status !== false) {
        wx.showToast({
          title: '发布成功',
          icon: 'success'
        });
        this.clearPageData();
        
        setTimeout(() => {
          // 跳转到首页（tabBar页面）
          wx.switchTab({
            url: '/pages/index/index',
            success: () => {
              // 获取当前所有页面栈
              const pages = getCurrentPages();
              const indexPage = pages.find(page => page.route === 'pages/index/index');
              // 如果找到首页且存在下拉刷新方法，则调用刷新
              if (indexPage && indexPage.onPullDownRefresh) {
                indexPage.onPullDownRefresh();
              }
            }
          });
        }, 1500);
      } else {
        throw new Error(result?.message || '发布失败');
      }
    } catch (error) {
      wx.hideLoading();
      console.error('发布失败:', error);
      wx.showToast({
        title: error.message || '发布失败，请重试',
        icon: 'none'
      });
    }
  },

  async uploadImageNote() {
    const { title, content, selectedCategory, location, images } = this.data;
    
    try {
      if (images.length === 0) throw new Error('没有可上传的图片');
      
      const imageUrls = [];
      const totalImages = images.length;
      
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        
        wx.showLoading({ 
          title: `上传图片 ${i + 1}/${totalImages}...`,
          mask: true 
        });
        try {
          // 使用单张图片上传接口
          const uploadResult = await uploadFile('/note/upload-single-image', image.tempFilePath, 'image', {}, {
            auth: true,
            loading: false, 
            toast: false
          });
  
          if (uploadResult && uploadResult.data && uploadResult.data.imageUrl) {
            imageUrls.push(uploadResult.data.imageUrl);
  
          } else if (uploadResult && uploadResult.imageUrl) {
            imageUrls.push(uploadResult.imageUrl);
  
          } else {
            console.error('上传结果格式异常:', uploadResult);
            throw new Error('图片上传失败，未返回图片URL');
          }
          
        } catch (error) {
          console.error(`第${i + 1}张图片上传失败:`, error);
          throw new Error(`第${i + 1}张图片上传失败: ${error.message || '未知错误'}`);
        }
      }
      
      if (imageUrls.length === 0) {
        throw new Error('没有成功上传的图片');
      }
      wx.showLoading({ 
        title: '创建笔记中...',
        mask: true 
      });
      
      const noteData = {
        title: title,
        content: content || '',
        categoryId: selectedCategory ? String(selectedCategory) : '',
        locationName: location ? location.name : '',
        imageUrls: imageUrls
      };
      const createResult = await post('/note/create-image-note', noteData, {
        auth: true,
        loading: false, 
        toast: false
      });
      return createResult;
      
    } catch (error) {
      throw error;
    }
  },

  async uploadVideoNote() {
    const { title, content, selectedCategory, location, videos } = this.data;
    if (!title || !title.trim()) {
      throw new Error('请输入笔记标题');
    }
    if (!videos || videos.length === 0) {
      throw new Error('请先选择视频');
    }
    const videoFile = videos[0];
    const filePath = videoFile.tempFilePath;
    try {
      const uploadResult = await uploadFile(
        '/note/upload-video',
        filePath,
        'video', 
        {
          title: title.trim(),
          content: content || '',
          categoryId: selectedCategory || '',
          locationName: location ? location.name : '',
        },
        {
          auth: true,
          loading: true,
          toast: true
        }
      );
      
      if (uploadResult.status) {
        return uploadResult;
      } else {
        throw new Error(uploadResult.message || '上传视频笔记失败');
      }
      
    } catch (error) {
      throw error;
    }
  },

  clearPageData() {
    this.setData({
      images: [],
      videos: [],
      title: '',
      content: '',
      selectedCategory: '',
      location: null,
      canPublish: false
    });

  }
});