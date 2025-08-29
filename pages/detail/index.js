const { get, post } = require('../../utils/request');
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
      location: '', 
      createTime: '', 
      likeCount: 0,
      collectCount: 0, 
      commentCount: 0,
      userInfo: { 
        id: '',
        avatar: '',
        nickname: '小生活',
        signature: ''
      },

    },
    comments: [],
    isFollowing: false,
    isLiked: false,
    isCollected: false,
    currentPage: 1,
    hasMore: true,
    isLoading: false,
    showCommentInput: true, 
    replyToId: '', 
    replyToNickname: '', 
    swiperHeight: 400, 

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
    this.loadComments();
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
      const minHeight = 200; // 最小高度200px
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
    
    wx.previewImage({
      current: currentImage, 
      urls: allImages, 
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
            collectCount: noteDetail.collectCount || 0,
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
      this.setData({ isLiked: false, isCollected: false });
      return;
    }
    try {
      const res = await get('/likesAndCollect/check', { noteId: this.data.noteData.id }, { auth: true, loading: false, toast: false });
      if (res && res.status && res.data) {
        this.setData({
          isLiked: !!res.data.isLiked,
          isCollected: !!res.data.isCollected
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

  // 加载评论
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

        // 分离一级评论和二级评论
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
  // 关注状态变化
  handleFollowChange(e) {
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
  handleCollect(e) {
    const { isCollected, collectCount } = e.detail;
    this.setData({
      isCollected,
      'noteData.collectCount': collectCount
    });
  },

  // 分享  待开发
  handleShare() {
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] });
  },

  // 评论发送成功
  onCommentSuccess() {
    this.loadComments({ reset: true });
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


});