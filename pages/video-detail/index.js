const { get, post } = require('../../utils/request');
const { formatCommentTime } = require('../../utils/utils');

Page({
  data: {
    note: {
      id: '',
      title: '',
      content: '',
      images: [],
      video: '', 
      tags: [],
      location: '',
      createTime: '',
      likeCount: 0,
      commentCount: 0,
      collectCount:0,
      author: { 
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
    isCollected: false,
    currentPage: 1,
    hasMore: true,
    isLoading: false,
    commentsLoaded: false,
    focusComment: false,
    showCommentInput: true, 
    replyToId: '',
    replyToNickname: '', 

    isPlaying: false,
    videoDuration: 0,
    videoCurrentTime: 0,

    showComment: false,
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

        const author = noteDetail.author || {};
        this.setData({
          note: {
            id: noteDetail.id || '',
            title: noteDetail.title || '',
            content: noteDetail.content || '',
            images: Array.isArray(noteDetail.images) ? noteDetail.images : [],
            video: noteDetail.videoUrl || '',
            tags: Array.isArray(noteDetail.tags) ? noteDetail.tags : [],
            location: noteDetail.locationName || '',
            createTime: noteDetail.createdAt || '',
            likeCount: noteDetail.likeCount || 0,
            commentCount: noteDetail.commentCount || 0,
            collectCount: noteDetail.collectCount || 0,
            author: {
              id: author.id || '',
              avatar: author.avatar || '',
              nickname: author.nickname || '小番薯',
              signature: author.signature || '',
              isFollowing: false 
            }
          }
        });
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
          isCollected: !!res.data.isCollected
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

        const primaryComments = []; 
        const secondaryComments = {}; 
        formattedComments.forEach(comment => {
          if (!comment.replyTo) {
            comment.replies = []; 
            primaryComments.push(comment);
          } else {
            const replyToId = comment.replyTo.id;
            if (!secondaryComments[replyToId]) {
              secondaryComments[replyToId] = [];
            }
            secondaryComments[replyToId].push(comment);
          }
        });

        primaryComments.forEach(primaryComment => {
          if (secondaryComments[primaryComment.id]) {
            primaryComment.replies = secondaryComments[primaryComment.id];
          }
        });

        this.setData({
          comments: primaryComments, 
          currentPage: pagination.current || 1,
          hasMore: false 
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
  async handleCollect() {
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

    const prevCollected = this.data.isCollected;
    const prevCount = this.data.note.collectCount || 0;
    const nextCollect = !prevCollected;
    const nextCount = Math.max(0, prevCount + (nextCollect ? 1 : -1));

    this.setData({
      isCollected: nextCollect,
      'note.collectCount': nextCount
    });

    try {
      const res = await post('/likesAndCollect/collect', { 
        noteId: this.data.note.id 
      }, { auth: true, loading: false });
      
      if (res && res.status === false) {
        throw new Error(res.message || '操作失败');
      }

      wx.showToast({
        title: nextCollect ? '收藏成功' : '已取消收藏',
        icon: 'success'
      });

      this.checkLikeAndCollectStatus();
    } catch (error) {
      // 回滚UI状态
      this.setData({
        isCollected: prevCollected,
        'note.collectCount': prevCount
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
      showCommentInput: false 
    });
    
    this.loadComments({ reset: true });
    this.setData({ commentsLoaded: true });
  },

  // 评论输入框聚焦
  onCommentFocus() {
    
  },

  // 评论输入框失焦
  onCommentBlur() {
    
  },



  // 隐藏评论弹窗
  hideComment() {
    this.setData({ 
      showComment: false,
      focusComment: false,
      showCommentInput: true 
    });
  },


  // 跳转到作者主页 待开发
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
  onCommentSuccess() {
    this.loadComments({ reset: true });
    
    const currentCount = this.data.note.commentCount || 0;
    this.setData({
      'note.commentCount': currentCount + 1,
      replyToId: '',
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