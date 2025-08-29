/**
 * 笔记卡片组件 - 类似小红书的内容卡片
 * 功能：
 * - 展示笔记封面图片
 * - 显示笔记标题和作者信息
 * - 支持图文和视频两种类型
 * - 点击卡片跳转到详情页
 * - 支持点赞操作（内置完整的点赞逻辑）
 */

// 引入封装的请求模块
const { post } = require('../../utils/request');

Component({
  /**
   * 组件属性定义
   */
  properties: {
    // 笔记数据对象，包含标题、图片、作者等信息
    note: {
      type: Object,
      value: {}
    },
    
    // 笔记类型：'image' 图文笔记 或 'video' 视频笔记
    type: {
      type: String,
      value: 'image' 
    }
  },

  /**
   * 组件内部数据
   */
  data: {
    // 默认渐变背景色，用于图片加载失败时的占位
    gradientBg: 'linear-gradient(120deg, #e0c3fc 0%, #8ec5fc 100%)'
  },

  /**
   * 组件方法定义
   */
  methods: {
    /**
     * 点击卡片事件处理
     * 根据笔记类型跳转到对应的详情页面
     */
    onTapCard() {
      const { note } = this.properties;
      
      // 根据笔记类型判断跳转页面
      const isVideo = !!note.isVideo; // 使用isVideo字段判断是否为视频笔记
      const url = isVideo 
        ? `/pages/video-detail/index?id=${note.id}`  // 视频详情页
        : `/pages/detail/index?id=${note.id}`;       // 图文详情页
        
      wx.navigateTo({ url });
    },

    /**
     * 点击点赞按钮事件处理
     * 包含完整的点赞逻辑：登录检查、API调用、乐观更新
     * @param {Event} e - 事件对象
     */
    async onTapLike(e) {
      const { note } = this.properties;
      if (!note || !note.id) return;

      // 登录校验
      const token = wx.getStorageSync('token');
      if (!token) {
        wx.navigateTo({ url: '/pages/login/login' });
        return;
      }

      // 乐观更新：先更新UI状态
      const isLiked = note.isLiked;
      const likeCount = note.likeCount || 0;
      const newIsLiked = !isLiked;
      const newLikeCount = Math.max(0, likeCount + (newIsLiked ? 1 : -1));

      // 更新组件的note数据
      this.setData({
        'note.isLiked': newIsLiked,
        'note.likeCount': newLikeCount
      });

      // 向父组件传递点赞状态变化事件，用于同步更新父组件的数据
      this.triggerEvent('likeChanged', { 
        note: {
          ...note,
          isLiked: newIsLiked,
          likeCount: newLikeCount
        },
        originalNote: note
      });

      try {
        // 调用后端API
        const res = await post('/likesAndCollect/like', { noteId: note.id }, { 
          auth: true, 
          loading: false,
          toast: false
        });
        
        if (res && res.status === false) {
          throw new Error(res.message || '操作失败');
        }
        
      } catch (err) {
        // 操作失败，回滚UI状态
        this.setData({
          'note.isLiked': isLiked,
          'note.likeCount': likeCount
        });

        // 通知父组件回滚数据
        this.triggerEvent('likeChanged', { 
          note: note,
          originalNote: {
            ...note,
            isLiked: newIsLiked,
            likeCount: newLikeCount
          }
        });

        wx.showToast({ 
          title: err.message || '操作失败', 
          icon: 'none' 
        });
      }
    }
  }
});