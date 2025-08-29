const { get, post } = require('../../utils/request');

Page({
  data: {
    searchText: '',
    searching: false,
    recommendList: ['穿搭', '家常菜', '文案', '头像', '健身', '学习', '美甲', '装修'],
    searchResults: [],
    hasMore: true,
    total: 0, 
    currentPage: 1, 
    totalPages: 0, 
    isLoading: false 
  },

  onLoad(options) {
    if (options.keyword) {
      this.setData({
        searchText: options.keyword
      });
      this.onSearch();
    }
  },
  // 输入搜索内容
  onSearchInput(e) {
    this.setData({
      searchText: e.detail.value
    });
  },

  // 执行搜索
  onSearch() {
    const keyword = this.data.searchText.trim();
    if (!keyword) {
      wx.showToast({
        title: '请输入搜索关键词',
        icon: 'none'
      });
      return;
    }
    this.setData({
      searching: true,
      searchResults: [],
      currentPage: 1,
      hasMore: true,
      total: 0,
      totalPages: 0,
      isLoading: false
    });
    
    this.loadSearchResults();
  },

  // 加载搜索结果
  async loadSearchResults() {
    if (!this.data.hasMore || this.data.isLoading) return;
    this.setData({ isLoading: true });
    try {
      const res = await get('/search/comprehensive', {
        keyword: this.data.searchText.trim()
      }, { 
        auth: false,
        loading: this.data.searchResults.length === 0 
      });

      if (res.status && res.data) {
        const data = res.data;
        const notes = Array.isArray(data.notes) ? data.notes : [];
        const formattedNotes = notes.map(note => {
          const author = note.author || {};
          
          return {
            id: note.id,
            title: note.title || '',
            coverImageUrl: note.coverImageUrl || '',
            likeCount: note.likeCount || 0,
            commentCount: note.commentCount || 0,
            createdAt: note.createdAt || '',
            isLiked: !!note.isLiked,
            isVideo: !!note.isVideo,
            user: {
              id: author.id || '',
              nickname: author.nickname || '匿名用户',
              username: author.nickname || '匿名用户',
              avatar: author.avatar || ''
            }
          };
        });
        this.setData({
          searchResults: formattedNotes,
          total: data.total || 0,
          currentPage: data.currentPage || 1,
          totalPages: data.totalPages || 1,
          hasMore: false 
        });

        if (formattedNotes.length === 0) {
          wx.showToast({
            title: '没有找到相关内容',
            icon: 'none'
          });
        }
      } else {
        throw new Error(res.message || '搜索失败');
      }
    } catch (error) {
      console.error('搜索失败:', error);
      wx.showToast({
        title: error.message || '搜索失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ isLoading: false });
    }
  },
  // 点击推荐
  onTapRecommend(e) {
    const keyword = e.currentTarget.dataset.keyword;
    this.setData({
      searchText: keyword
    });
    this.onSearch();
  },


  loadMore() {
    // 新的搜索API返回所有结果 待开发
    
  },

  // 跳转到详情页
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/detail/index?id=${id}`
    });
  },

  /**
   * 处理note-card组件的点赞状态变化
   * 同步更新搜索结果中的该笔记数据
   */
  onLikeChanged(e) {
    const { note } = e.detail || {};
    if (!note || !note.id) return;

    // 同步更新搜索结果中的该笔记
    const updatedResults = this.data.searchResults.map(n => 
      n.id === note.id ? { ...n, isLiked: note.isLiked, likeCount: note.likeCount } : n
    );
    this.setData({ searchResults: updatedResults });
  }
}); 