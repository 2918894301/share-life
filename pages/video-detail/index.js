// pages/video-detail/index.js
// 引入封装的请求模块
const { get, post } = require('../../utils/request');
// 引入工具函数
const { formatCommentTime } = require('../../utils/utils');

Page({
  data: {
    note: {
      id: '',
      title: '',
      content: '',
      images: [],
      video: '', // 原模板使用 video 而不是 videoUrl
      tags: [],
      location: '',
      createTime: '',
      likeCount: 0,
      commentCount: 0,
      author: { // 原模板使用 author
        id: '',
        avatar: '',
        nickname: '小番薯',
        signature: '',
        isFollowing: false
      }
    },
    comments: [],
    isFollowing: false,
    isLiked: false,
    isFavorited: false,
    currentPage: 1,
    hasMore: true,
    isLoading: false,
    commentsLoaded: false,
    focusComment: false,
    showCommentInput: true, // 总是显示底部评论输入框
    replyToId: '', // 回复的评论ID
    replyToNickname: '', // 回复的用户昵称
    // 视频相关
    isPlaying: false,
    videoDuration: 0,
    videoCurrentTime: 0,
    // 新增字段
    showComment: false,
    _commentObserver: null
  },

  onLoad(options) {
    const id = options.id;
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.setData({
      'note.id': id
    });

    this.fetchNoteDetail();
  },
  // 获取笔记详情：/note/noteDetail/{id}
  async fetchNoteDetail() {
    try {
      const res = await get(`/note/noteDetail/${this.data.note.id}`, {}, { auth: true, loading: true });

      if (res.status) {
        const noteDetail = res.data?.noteDetail || {};

        // 同步到原模板所需字段
        const author = noteDetail.author || {};
        this.setData({
          note: {
            id: noteDetail.id || '',
            title: noteDetail.title || '',
            content: noteDetail.content || '',
            images: Array.isArray(noteDetail.images) ? noteDetail.images : [],
            video: noteDetail.videoUrl || '', // 原模板使用 video 字段
            tags: Array.isArray(noteDetail.tags) ? noteDetail.tags : [],
            location: noteDetail.locationName || '',
            createTime: noteDetail.createdAt || '',
            likeCount: noteDetail.likeCount || 0,
            commentCount: noteDetail.commentCount || 0,
            favoriteCount: noteDetail.favoriteCount || 0,
            author: {
              id: author.id || '',
              avatar: author.avatar || '',
              nickname: author.nickname || '小番薯',
              signature: author.signature || '',
              isFollowing: false // 初始化为false，后续通过接口查询
            }
          }
        });

        // 检查登录状态，如果已登录则查询点赞、收藏和关注状态
        const token = wx.getStorageSync('token');
        if (token) {
          this.checkFollowStatus();
          this.checkLikeAndCollectStatus();
        }

  
      } else {
        throw new Error(res.message || '获取笔记详情失败');
      }
    } catch (error) {
      console.error('获取笔记详情失败:', error);
      wx.showToast({ title: error.message || '加载失败', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  // 查询作者关注状态
  async checkFollowStatus() {
    try {
      const res = await get('/follow/status', {
        noteId: this.data.note.id
      }, { auth: true, loading: false });

      if (res.status && res.data) {
        this.setData({
          isFollowing: !!res.data.isFollowing,
          'note.author.isFollowing': !!res.data.isFollowing
        });
      }
    } catch (error) {
      console.error('查询关注状态失败:', error);
    }
  },

  // 查询点赞和收藏状态
  async checkLikeAndCollectStatus() {
    try {
      const res = await get('/likesAndCollect/check', {
        noteId: this.data.note.id
      }, { auth: true, loading: false });

      if (res.status && res.data) {
        this.setData({
          isLiked: !!res.data.isLiked,
          isFavorited: !!res.data.isCollected
        });
      }
    } catch (error) {
      console.error('查询点赞收藏状态失败:', error);
    }
  },

  // 加载评论列表
  async loadComments({ reset = false } = {}) {
    if (this.data.isLoading) return;
    if (!reset && !this.data.hasMore) return;

    this.setData({ isLoading: true });
    
    try {
      const res = await get('/comments', {
        noteId: this.data.note.id
      }, { auth: true, loading: false });

      if (res.status && res.data) {
        const data = res.data;
        const newComments = Array.isArray(data.comments) ? data.comments : [];
        const pagination = data.pagination || {};
      
        // 格式化评论数据
        const formattedComments = newComments.map(comment => ({
          id: comment.id,
          content: comment.content,
          createTime: formatCommentTime(comment.createdAt),
          likeCount: comment.likeCount || 0,
          userInfo: {
            id: comment.author?.id || '',
            avatar: comment.author?.avatar || '',
            nickname: comment.author?.nickname || '匿名用户'
          },
          replyTo: comment.replyTo ? {
            id: comment.replyTo.id,
            content: comment.replyTo.content,
            author: {
              id: comment.replyTo.author?.id || '',
              nickname: comment.replyTo.author?.nickname || '匿名用户'
            }
          } : null
        }));

        // 将评论按照层级关系重新组织
        const primaryComments = []; // 一级评论列表
        const secondaryComments = {}; // 二级评论映射 {replyToId: [comments]}

        // 分离一级评论和二级评论
        formattedComments.forEach(comment => {
          if (!comment.replyTo) {
            // 一级评论
            comment.replies = []; // 添加回复列表
            primaryComments.push(comment);
          } else {
            // 二级评论，按照回复的目标ID分组
            const replyToId = comment.replyTo.id;
            if (!secondaryComments[replyToId]) {
              secondaryComments[replyToId] = [];
            }
            secondaryComments[replyToId].push(comment);
          }
        });

        // 将二级评论附加到对应的一级评论下
        primaryComments.forEach(primaryComment => {
          if (secondaryComments[primaryComment.id]) {
            primaryComment.replies = secondaryComments[primaryComment.id];
          }
        });

        // 由于新接口不支持分页，直接使用返回的所有评论
        this.setData({
          comments: primaryComments, // 只显示一级评论，二级评论在replies中
          currentPage: pagination.current || 1,
          hasMore: false // 新接口返回所有评论，没有分页
        });
      }
    } catch (error) {
      console.error('加载评论失败:', error);
      wx.showToast({ title: '加载评论失败', icon: 'none' });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  // 加载更多评论
  loadMoreComments() {
    this.loadComments({ reset: false });
  },



  // 关注状态改变
  handleFollowChange(e) {
    // follow-button 组件已经处理了请求，这里只需要同步状态
    const { isFollowing, userId } = e.detail;
    this.setData({
      isFollowing,
      'note.author.isFollowing': isFollowing
    });
  },

  // 点赞 - 与 action-bar 保持一致
  async handleLike() {
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

    // 乐观更新UI
    const prevLiked = this.data.isLiked;
    const prevCount = this.data.note.likeCount || 0;
    const nextLiked = !prevLiked;
    const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));

    this.setData({
      isLiked: nextLiked,
      'note.likeCount': nextCount
    });

    try {
      const res = await post('/likesAndCollect/like', { 
        noteId: this.data.note.id 
      }, { auth: true, loading: false });
      
      if (res && res.status === false) {
        throw new Error(res.message || '操作失败');
      }

      wx.showToast({
        title: nextLiked ? '点赞成功' : '已取消点赞',
        icon: 'success'
      });

      // 重新查询状态确保数据一致性
      this.checkLikeAndCollectStatus();
    } catch (error) {
      // 回滚UI状态
      this.setData({
        isLiked: prevLiked,
        'note.likeCount': prevCount
      });
      
      console.error('点赞操作失败:', error);
      wx.showToast({
        title: error.message || '操作失败，请重试',
        icon: 'none'
      });
    }
  },

  // 收藏 - 与 action-bar 保持一致
  async handleFavorite() {
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

    // 乐观更新UI
    const prevFavorited = this.data.isFavorited;
    const prevCount = this.data.note.favoriteCount || 0;
    const nextFavorited = !prevFavorited;
    const nextCount = Math.max(0, prevCount + (nextFavorited ? 1 : -1));

    this.setData({
      isFavorited: nextFavorited,
      'note.favoriteCount': nextCount
    });

    try {
      const res = await post('/likesAndCollect/collect', { 
        noteId: this.data.note.id 
      }, { auth: true, loading: false });
      
      if (res && res.status === false) {
        throw new Error(res.message || '操作失败');
      }

      wx.showToast({
        title: nextFavorited ? '收藏成功' : '已取消收藏',
        icon: 'success'
      });

      // 重新查询状态确保数据一致性
      this.checkLikeAndCollectStatus();
    } catch (error) {
      // 回滚UI状态
      this.setData({
        isFavorited: prevFavorited,
        'note.favoriteCount': prevCount
      });
      
      console.error('收藏操作失败:', error);
      wx.showToast({
        title: error.message || '操作失败，请重试',
        icon: 'none'
      });
    }
  },

  // 评论按钮点击 - 显示评论列表弹窗
  handleComment() {
    this.setData({ 
      showComment: true,
      showCommentInput: false // 显示评论弹出层时隐藏底部评论输入框
    });
    
    // 每次点击都重新加载评论，确保获取最新数据
    this.loadComments({ reset: true });
    this.setData({ commentsLoaded: true });
  },

  // 评论输入框聚焦
  onCommentFocus() {
    // 可以在这里处理聚焦时的逻辑，比如调整布局
  },

  // 评论输入框失焦
  onCommentBlur() {
    // 可以在这里处理失焦时的逻辑
  },



  // 隐藏评论弹窗
  hideComment() {
    this.setData({ 
      showComment: false,
      focusComment: false,
      showCommentInput: true // 隐藏评论弹出层时重新显示底部评论输入框
    });
  },

  // 跳转到搜索页面
  goToSearch() {
    wx.navigateTo({
      url: '/pages/search/search'
    });
  },

  // 跳转到作者主页
  goToAuthorProfile() {
    if (this.data.note.author.id) {
      // wx.navigateTo({
      //   url: `/pages/profile/index?userId=${this.data.note.author.id}`
      // });
    }
  },

  // 分享
  handleShare() {
    wx.showShareMenu({
      withShareTicket: true
    });
  },

  // 视频播放事件
  onVideoPlay() {
    this.setData({ isPlaying: true });
  },

  // 视频暂停事件
  onVideoPause() {
    this.setData({ isPlaying: false });
  },

  // 视频时间更新
  onTimeUpdate(e) {
    const { currentTime, duration } = e.detail;
    this.setData({
      videoCurrentTime: currentTime,
      videoDuration: duration
    });
  },

  // 视频错误处理
  onVideoError(e) {
    console.error('视频播放错误:', e.detail);
    wx.showToast({ title: '视频播放失败', icon: 'none' });
  },

  // 切换播放状态
  togglePlay() {
    const videoContext = wx.createVideoContext('mainVideo', this);
    if (this.data.isPlaying) {
      videoContext.pause();
    } else {
      videoContext.play();
    }
  },

  // 分享配置
  onShareAppMessage() {
    return {
      title: this.data.note.title || this.data.note.content || '精彩视频分享',
      path: `/pages/video-detail/index?id=${this.data.note.id}`,
      imageUrl: this.data.note.images && this.data.note.images[0] || ''
    };
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  },

  // 返回首页
  goHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  // 评论发送成功
  onCommentSuccess(e) {
    const { comment, isReply } = e.detail;
    
    
    // 重新加载评论列表
    this.loadComments({ reset: true });
    
    // 更新评论数量
    const currentCount = this.data.note.commentCount || 0;
    this.setData({
      'note.commentCount': currentCount + 1,
      replyToId: '', // 清空回复状态
      replyToNickname: ''
    });
  },

  // 评论发送失败
  onCommentError(e) {
    console.error('评论发送失败:', e.detail.error);
  },

  // 取消回复
  onCancelReply() {
    this.setData({
      replyToId: '',
      replyToNickname: ''
    });
  },

  // 隐藏评论输入框
  onCommentInputHide() {
    this.setData({
      showCommentInput: false
    });
  },

  // 回复评论
  replyToComment(commentId, nickname) {
    this.setData({
      replyToId: commentId,
      replyToNickname: nickname,
      showCommentInput: true
    });
  }
}); 