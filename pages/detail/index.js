// pages/detail/index.js
// 引入封装的请求模块
const { get, post } = require('../../utils/request');
// 引入工具函数
const { formatCommentTime } = require('../../utils/utils');

Page({
  data: {
    noteData: {
      id: '',
      title: '',
      content: '',
      images: [],
      // videoUrl: '',
      tags: [],
      location: '', // WXML 使用 location
      createTime: '', // WXML 使用 createTime
      likeCount: 0,
      favoriteCount: 0, // WXML 使用 favoriteCount
      commentCount: 0,
      userInfo: { // WXML 使用 userInfo
        id: '',
        avatar: '',
        nickname: '小生活',
        signature: ''
      },

    },
    comments: [],
    isFollowing: false,
    isLiked: false,
    isFavorited: false,
    currentPage: 1,
    hasMore: true,
    isLoading: false,
    commentsLoaded: false,
    _commentObserver: null,
    showCommentInput: true, // 总是显示底部评论输入框
    replyToId: '', // 回复的评论ID
    replyToNickname: '', // 回复的用户昵称
    swiperHeight: 400, // 默认轮播图高度

  },
  //上一个页面传输数据
  onLoad: function(options) {
    const noteId = options.id;
    this.setData({
      'noteData.id': noteId
    });
    this.fetchNoteDetail();
    this.checkUserInteraction();
    this.checkFollowStatus();
  },

  onReady() {
    // 懒加载评论：当评论区域进入视口时加载
    try {
      const observer = wx.createIntersectionObserver(this, { thresholds: [0.1] });
      observer.relativeToViewport({ bottom: 100 });
      observer.observe('.comment-section', (res) => {
        if (res.intersectionRatio > 0 && !this.data.commentsLoaded) {
          this.loadComments({ reset: true });
          this.setData({ commentsLoaded: true });
        }
      });
      this.setData({ _commentObserver: observer });
    } catch (_) {}
  },

  onUnload() {
    try { this.data._commentObserver && this.data._commentObserver.disconnect(); } catch (_) {}
  },

  // 图片加载完成处理
  onImageLoad(e) {
    const index = e.currentTarget.dataset.index;
    const { width, height } = e.detail;
    // 只处理第一张图片来设置容器高度
    if (index === 0) {
      // 获取屏幕宽度
      const systemInfo = wx.getSystemInfoSync();
      const screenWidth = systemInfo.windowWidth;
      
      // 计算第一张图片在屏幕上的实际高度
      const imageHeight = (height * screenWidth) / width;
      
      // 设置合理的高度范围
      const minHeight = 200; // 最小高度300px
      const maxHeight = systemInfo.windowHeight * 0.75; // 最大高度为屏幕高度的75%
      const finalHeight = Math.max(minHeight, Math.min(imageHeight, maxHeight));
      // 动态设置swiper高度，所有图片都会在这个高度内自适应显示
      this.setData({
        swiperHeight: finalHeight
      });
    }
    

  },

  // 图片点击预览
  onImageTap(e) {
    const index = e.currentTarget.dataset.index;
    const currentImage = this.data.noteData.images[index];
    const allImages = this.data.noteData.images;
    
    // 使用微信小程序的图片预览API
    wx.previewImage({
      current: currentImage, // 当前显示图片的链接
      urls: allImages, // 需要预览的图片链接列表
      success: () => {

      },
      fail: (err) => {
        console.error('图片预览失败:', err);
        wx.showToast({
          title: '预览失败',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 获取笔记详情：/note/noteDetail/{id}
  async fetchNoteDetail() {
    try {
 
      const res = await get(`/note/noteDetail/${this.data.noteData.id}`, {}, { auth: true, loading: true });


      if (res.status) {
        const noteDetail = res.data?.noteDetail || {};
        // 同步到 WXML 所需字段
        const author = noteDetail.author || {};
        this.setData({
          noteData: {
            id: noteDetail.id || '',
            title: noteDetail.title || '',
            content: noteDetail.content || '',
            images:  noteDetail.images,
            // videoUrl: noteDetail.videoUrl || '',
            tags: Array.isArray(noteDetail.tags) ? noteDetail.tags : [],
            location: noteDetail.locationName || '',
            createTime: noteDetail.createdAt || '',
            likeCount: noteDetail.likeCount || 0,
            favoriteCount: noteDetail.collectCount || 0,
            commentCount: noteDetail.commentCount || 0,
            userInfo: {
              id: author.id || '',
              avatar: author.avatar || '',
              nickname: author.nickname || '小生活',
              signature: author.signature || ''
            }
          },
          isFollowing: !!author.isFollowing
        });
      } else {
        throw new Error(res.message || '获取笔记详情失败');
      }
    } catch (error) {
      console.error('获取笔记详情失败:', error);
      wx.showToast({ title: '获取笔记详情失败', icon: 'none' });
    }
  },

  // 检查用户是否点赞和收藏：/likesAndCollect/check?noteId=xxx
  async checkUserInteraction() {
    const token = wx.getStorageSync('token');
    if (!token) {
      this.setData({ isLiked: false, isFavorited: false });
      return;
    }
    try {
      const res = await get('/likesAndCollect/check', { noteId: this.data.noteData.id }, { auth: true, loading: false, toast: false });
      if (res && res.status && res.data) {
        this.setData({
          isLiked: !!res.data.isLiked,
          isFavorited: !!res.data.isCollected
        });
      }
    } catch (error) {
      console.warn('检查点赞/收藏状态失败', error);
    }
  },

  // 查询关注状态：/follow/status?noteId=xxx
  async checkFollowStatus() {
    try {
      const res = await get('/follow/status', { noteId: this.data.noteData.id }, { auth: true, loading: false, toast: false });
      if (res && res.status && res.data) {
        const isFollowing = !!res.data.isFollowing;
        const authorId = res.data.authorId || this.data.noteData.userInfo.id;
        this.setData({
          isFollowing,
          'noteData.userInfo.id': authorId || this.data.noteData.userInfo.id,
          'noteData.author.isFollowing': isFollowing
        });
      }
    } catch (error) {
      console.warn('查询关注状态失败', error);
    }
  },

  // 加载评论：使用新的/comments接口
  async loadComments() {
    if (this.data.isLoading) return;

    this.setData({ isLoading: true });
    
    try {
      const res = await get('/comments', {
        noteId: this.data.noteData.id
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

  // 点击评论按钮
  handleComment() {
    this.setData({ showCommentInput: true });
  },





  // 关注状态变化
  handleFollowChange(e) {
    // follow-button 组件已经处理了请求，这里只需要同步状态
    const { isFollowing, userId } = e.detail;
    this.setData({
      isFollowing,
      'noteData.author.isFollowing': isFollowing
    });
  },

  // 处理action-bar的点赞事件
  handleLike(e) {
    const { isLiked, likeCount } = e.detail;
    this.setData({
      isLiked,
      'noteData.likeCount': likeCount
    });
  },

  // 处理action-bar的收藏事件
  handleFavorite(e) {
    const { isFavorited, favoriteCount } = e.detail;
    this.setData({
      isFavorited,
      'noteData.favoriteCount': favoriteCount
    });
  },

  // 分享
  handleShare() {
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] });
  },



  // 评论发送成功
  onCommentSuccess(e) {
    // 重新加载评论列表
    this.loadComments({ reset: true });
    
    // 更新评论数量
    const currentCount = this.data.noteData.commentCount || 0;
    this.setData({
      'noteData.commentCount': currentCount + 1,
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


});