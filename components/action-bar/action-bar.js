/**
 * 操作栏组件 
 * 功能：点赞、收藏
 */

// 引入封装的请求模块
const { post } = require('../../utils/request');

Component({
  /**
   * 组件属性定义
   * 通过外部传入控制组件的状态和显示
   */
  properties: {
    noteId: {
      type: String,
      value: ''
    },
    
    isLiked: {
      type: Boolean,
      value: false
    },
    
    isCollected: {
      type: Boolean,
      value: false
    },
    
    likeCount: {
      type: Number,
      value: 0
    },
    
    collectCount: {
      type: Number,
      value: 0
    },
    
    commentCount: {
      type: Number,
      value: 0
    },

  },

  methods: {

    /**
     * 点赞功能处理
     */
    async onLike() {
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
        const res = await post('/likesAndCollect/like', { noteId: this.properties.noteId }, { auth: true, loading: false });
        
        if (res && res.status === false) {
          throw new Error(res.message || '操作失败');
        }

        const nextLiked = !this.properties.isLiked;
        const nextCount = Math.max(0, this.properties.likeCount + (nextLiked ? 1 : -1));

        this.triggerEvent('like', {
          isLiked: nextLiked,
          likeCount: nextCount
        });

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
     */
    async onCollect() {
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
        const res = await post('/likesAndCollect/collect', { noteId: this.properties.noteId }, { auth: true, loading: false });
        
        if (res && res.status === false) {
          throw new Error(res.message || '操作失败');
        }
        const nextCollected = !this.properties.isCollected;
        const nextCount = Math.max(0, this.properties.collectCount + (nextCollected ? 1 : -1));
        this.triggerEvent('collect', {
          isCollected: nextCollected,
          collectCount: nextCount
        });

        wx.showToast({
          title: nextCollected ? '收藏成功' : '已取消收藏',
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