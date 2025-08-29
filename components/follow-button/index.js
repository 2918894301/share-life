/**
 * 关注按钮组件
 * 功能：
 * - 关注/取消关注用户
 * - 支持不同尺寸的按钮样式
 * - 自动检查登录状态
 * - 防重复操作保护
 * - 乐观更新UI提升用户体验
 */


const { post } = require('../../utils/request');

Component({
  properties: {
    isFollowing: {
      type: Boolean,
      value: false
    },
    
    userId: {
      type: String,
      value: ''
    },
    
    size: {
      type: String,
      value: 'normal'
    }
  },


  data: {
    loading: false 
  },

  methods: {
    async toggleFollow() {
      if (this.data.loading) return;
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
      if (!this.properties.userId) {
        wx.showToast({
          title: '用户信息不存在',
          icon: 'none'
        });
        return;
      }

      this.setData({ loading: true });
      const prevFollowing = this.properties.isFollowing;
      const nextFollowing = !prevFollowing;

      try {
        const res = await post('/follow', { followingId: this.properties.userId }, { auth: true, loading: false });
        
        if (res && res.status === false) {
          throw new Error(res.message || '操作失败');
        }
        this.triggerEvent('followChange', {
          value: nextFollowing,
          isFollowing: nextFollowing,
          userId: this.properties.userId
        });
        wx.showToast({
          title: nextFollowing ? '关注成功' : '已取消关注',
          icon: 'success'
        });
      } catch (error) {
        console.error('关注操作失败:', error);
        wx.showToast({
          title: error.message || '操作失败',
          icon: 'none'
        });
      } finally {
        this.setData({ loading: false });
      }
    }
  }
})
