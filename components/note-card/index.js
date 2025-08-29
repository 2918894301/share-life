/**
 * 笔记卡片组件
 * 功能：
 * - 展示笔记封面图片
 * - 显示笔记标题和作者信息
 * - 支持图文和视频两种类型
 * - 点击卡片跳转到详情页
 * - 支持点赞操作（内置完整的点赞逻辑）
 */

const { post } = require('../../utils/request');

Component({

  properties: {
    note: {
      type: Object,
      value: {}
    },
    type: {
      type: String,
      value: 'image' 
    }
  },


  data: {

    gradientBg: 'linear-gradient(120deg, #e0c3fc 0%, #8ec5fc 100%)'
  },


  methods: {

    onTapCard() {
      const { note } = this.properties;
      

      const isVideo = !!note.isVideo; 
      const url = isVideo 
        ? `/pages/video-detail/index?id=${note.id}` 
        : `/pages/detail/index?id=${note.id}`;       
        
      wx.navigateTo({ url });
    },

    /**
     * 点击点赞按钮事件处理
     * 包含完整的点赞逻辑：登录检查、API调用、乐观更新
     */
    async onTapLike() {
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