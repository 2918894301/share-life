/**
 * 关注按钮组件 - 类似小红书的用户关注功能
 * 功能：
 * - 关注/取消关注用户
 * - 支持不同尺寸的按钮样式
 * - 自动检查登录状态
 * - 防重复操作保护
 * - 乐观更新UI提升用户体验
 */

// 引入封装的请求模块
const { post } = require('../../utils/request');

Component({
  /**
   * 组件属性定义
   */
  properties: {
    // 是否已关注该用户
    isFollowing: {
      type: Boolean,
      value: false
    },
    
    // 被关注用户的ID
    userId: {
      type: String,
      value: ''
    },
    
    // 按钮尺寸，可选值：normal（普通）, small（小）
    size: {
      type: String,
      value: 'normal'
    }
  },

  /**
   * 组件内部数据
   */
  data: {
    loading: false  // 是否正在处理关注操作
  },

  /**
   * 组件方法定义
   */
  methods: {
    /**
     * 切换关注状态
     * 处理关注/取消关注的完整流程
     */
    async toggleFollow() {
      // 防重复操作
      if (this.data.loading) return;
      
      // 检查登录状态，未登录则跳转到登录页
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

      // 验证用户ID是否有效
      if (!this.properties.userId) {
        wx.showToast({
          title: '用户信息不存在',
          icon: 'none'
        });
        return;
      }

      this.setData({ loading: true });

      // 乐观更新UI：预期的新状态
      const prevFollowing = this.properties.isFollowing;
      const nextFollowing = !prevFollowing;

      try {
        // 发送关注/取消关注请求
        const res = await post('/follow', { followingId: this.properties.userId }, { auth: true, loading: false });
        
        // 检查服务器返回的错误状态
        if (res && res.status === false) {
          throw new Error(res.message || '操作失败');
        }

        // 触发关注状态变化事件，通知父组件更新数据
        this.triggerEvent('followChange', {
          value: nextFollowing,
          isFollowing: nextFollowing,
          userId: this.properties.userId
        });

        // 显示操作成功提示
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
