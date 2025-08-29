/**
 * 操作栏组件 - 类似小红书的笔记交互栏
 * 功能：点赞、收藏、分享、评论
 * 特点：
 * - 支持暗黑模式
 * - 乐观更新UI，提升用户体验
 * - 自动检查登录状态
 * - 统一错误处理和回滚机制
 */

// 引入封装的请求模块
const { post } = require('../../utils/request');

Component({
  /**
   * 组件属性定义
   * 通过外部传入控制组件的状态和显示
   */
  properties: {
    // 笔记ID 
    noteId: {
      type: String,
      value: ''
    },
    
    // 是否已点赞 
    isLiked: {
      type: Boolean,
      value: false
    },
    
    // 是否已收藏
    isFavorited: {
      type: Boolean,
      value: false
    },
    
    // 点赞数量 
    likeCount: {
      type: Number,
      value: 0
    },
    
    // 收藏数量
    favoriteCount: {
      type: Number,
      value: 0
    },
    
    // 评论数量
    commentCount: {
      type: Number,
      value: 0
    },

  },

  methods: {

    /**
     * 点赞功能处理
     * 简化版：只负责触发事件，由父组件管理状态
     */
    async onLike() {
      // 检查登录状态，未登录则跳转登录页
      const token = wx.getStorageSync('token');
      if (!token) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
        setTimeout(() => {
          wx.navigateTo({
            url: '/pages/login/login'
          });
        }, 1500);
        return;
      }

      try {
        // 发送点赞请求到服务器
        const res = await post('/likesAndCollect/like', { noteId: this.properties.noteId }, { auth: true, loading: false });
        
        // 检查服务器返回的错误状态
        if (res && res.status === false) {
          throw new Error(res.message || '操作失败');
        }

        // 计算新状态
        const nextLiked = !this.properties.isLiked;
        const nextCount = Math.max(0, this.properties.likeCount + (nextLiked ? 1 : -1));

        // 触发事件通知父组件状态变化
        this.triggerEvent('like', {
          isLiked: nextLiked,
          likeCount: nextCount
        });

        // 显示操作成功提示
        wx.showToast({
          title: nextLiked ? '点赞成功' : '已取消点赞',
          icon: 'success'
        });
      } catch (error) {
        console.error('点赞操作失败:', error);
        wx.showToast({
          title: error.message || '操作失败，请重试',
          icon: 'none'
        });
      }
    },

    /**
     * 收藏功能处理
     * 简化版：只负责触发事件，由父组件管理状态
     */
    async onFavorite() {
      // 检查登录状态，未登录则跳转登录页
      const token = wx.getStorageSync('token');
      if (!token) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
        setTimeout(() => {
          wx.navigateTo({
            url: '/pages/login/login'
          });
        }, 1500);
        return;
      }

      try {
        // 发送收藏请求到服务器
        const res = await post('/likesAndCollect/collect', { noteId: this.properties.noteId }, { auth: true, loading: false });
        
        // 检查服务器返回的错误状态
        if (res && res.status === false) {
          throw new Error(res.message || '操作失败');
        }

        // 计算新状态
        const nextFavorited = !this.properties.isFavorited;
        const nextCount = Math.max(0, this.properties.favoriteCount + (nextFavorited ? 1 : -1));

        // 触发事件通知父组件状态变化
        this.triggerEvent('favorite', {
          isFavorited: nextFavorited,
          favoriteCount: nextCount
        });

        wx.showToast({
          title: nextFavorited ? '收藏成功' : '已取消收藏',
          icon: 'success'
        });
      } catch (error) {
        console.error('收藏操作失败:', error);
        wx.showToast({
          title: error.message || '操作失败，请重试',
          icon: 'none'
        });
      }
    },

    onShare() {
      this.triggerEvent('share');
    },

    onComment() {
      this.triggerEvent('comment');
    }
  }
}) 