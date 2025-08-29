/**
 * 首页页面
 * 功能：
 * - 瀑布流展示笔记列表
 * - 分类筛选切换
 * - 下拉刷新和上拉加载更多
 * - 支持"我的发布"模式查看个人笔记
 * - 点赞交互功能
 * - 搜索和发布导航
 */
const { get, post } = require('../../utils/request');

Page({

  data: {
    statusBarHeight: 0,     // 状态栏高度，用于适配不同设备
    navHeight: 44,          // 导航栏高度

    categories: [
      { id: 0, name: '推荐' },
      { id: 1, name: '旅行' },
      { id: 2, name: '美食' },
      { id: 3, name: '时尚' },
      { id: 4, name: '健身' }
    ],
    
    currentTab: 0,        
    
    contentList: [],        // 完整的笔记列表
    leftList: [],          
    rightList: [],        
    
    // 分页参数
    pageNum: 1,            
    pageSize: 10,         
    hasMore: true,        
    
    // 加载状态
    isRefreshing: false,   
    isLoadingMore: false   
  },
  

  onLoad() {
    // 获取系统信息，适配不同设备的状态栏和导航栏高度
    const systemInfo = wx.getSystemInfoSync();
    const navHeight = 44; 
    
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      navHeight: systemInfo.statusBarHeight + navHeight
    });
    
    // 加载分类数据和初始内容
    this.loadCategories();
    this.loadInitialData(); 
  },
  
  /**
   * 加载分类数据
   * 从服务器获取所有可用的内容分类，并在首位添加"推荐"分类
   */
  async loadCategories() {
    try {
      const res = await get('/categories', {}, { auth: false });
      if (res.status) {
        const categories = [{ id: 0, name: '推荐' }];

        const serverList = (res.data && Array.isArray(res.data)) ? res.data : [];
        serverList.forEach(category => {
          categories.push({ id: category.id, name: category.name });
        });
        
        this.setData({ categories });
      } else {
        console.error('加载分类失败:', res.message);
      }
    } catch (error) {
      console.error('加载分类失败:', error);
      wx.showToast({ title: '加载分类失败', icon: 'none' });
    }
  },

  /**
   * 格式化公共流笔记数据
   * 将服务器返回的笔记数据转换为组件需要的标准格式
   * @param {Array} notes - 原始笔记数据列表
   * @returns {Array} 格式化后的笔记数据
   */
  formatNotes(notes) {
    return notes.map(note => {
      const isImage = note.images && note.images.length > 0;
      
      return {
        id: note.id,
        title: note.title || note.content || '',    
        content: note.content || '',                
        isVideo: !!note.isVideo,                   
      
        user: {
          id: note.author?.id || '',
          username: note.author?.username || '',
          nickname: note.author?.nickname || '匿名用户',
          avatar: note.author?.avatar || ''
        },
        
        likeCount: note.likeCount || 0,           
        commentCount: note.commentCount || 0,     
        collectCount: note.collectCount || 0,     
        viewCount: note.viewCount || 0,           
        
        images: note.images || [],               
        coverImageUrl: note.coverImageUrl || '' , 
        
        // 其他信息
        createdAt: note.createdAt || '',          
        isLiked: !!note.isLiked                
      };
    });
  },
  updateWaterfallData(notes) {
    const leftList = [...this.data.leftList];
    const rightList = [...this.data.rightList];
    notes.forEach((note, index) => {
      if (index % 2 === 0) leftList.push(note);
      else rightList.push(note);
    });
    return { leftList, rightList };
  },

  buildListParams(page) {
    const params = { page, pageSize: this.data.pageSize };
    if (this.data.currentTab > 0) {
      const category = this.data.categories[this.data.currentTab];
      if (category && category.id) params.categoryId = category.id;
    }
    const userId = wx.getStorageSync('userId');
    if (userId) params.userId = userId;
    return params;
  },

  async loadInitialData() {
    try {
      this.setData({
        contentList: [],
        leftList: [],
        rightList: [],
        pageNum: 1,
        hasMore: true
      });
      
      const params = this.buildListParams(1);
      const res = await get('/latest', params, { auth: false });
      
      if (res.status) {
        const pageData = res.data || {};
        const list = Array.isArray(pageData.data) ? pageData.data : [];
        const formattedNotes = this.formatNotes(list);
        const { leftList, rightList } = this.updateWaterfallData(formattedNotes);
        
        this.setData({
          contentList: formattedNotes,
          leftList,
          rightList,
          hasMore: (pageData.currentPage || 1) < (pageData.totalPages || 1)
        });
      } else {
        console.error('加载数据失败:', res.message);
        wx.showToast({ title: '加载数据失败', icon: 'none' });
      }
    } catch (error) {
      console.error('加载数据失败:', error);
      wx.showToast({ title: '加载数据失败', icon: 'none' });
    }
  },

  async loadMore() {
    if (!this.data.hasMore || this.data.isLoadingMore) return;
    
    this.setData({ isLoadingMore: true });
    
    try {
      const nextPage = this.data.pageNum + 1;
      const params = this.buildListParams(nextPage);
      const res = await get('/latest', params, { auth: false, loading: false });
      
      if (res.status) {
        const pageData = res.data || {};
        const list = Array.isArray(pageData.data) ? pageData.data : [];
        
        if (list.length === 0) {
          this.setData({ hasMore: false });
          return;
        }
        
        const formattedNotes = this.formatNotes(list);
        const { leftList, rightList } = this.updateWaterfallData(formattedNotes);
        
        this.setData({
          contentList: [...this.data.contentList, ...formattedNotes],
          leftList,
          rightList,
          pageNum: nextPage,
          hasMore: (pageData.currentPage || nextPage) < (pageData.totalPages || nextPage)
        });
      } else {
        if (res.message !== '没有更多数据') {
          wx.showToast({ title: '加载失败', icon: 'none' });
        } else {
          this.setData({ hasMore: false });
        }
      }
    } catch (error) {
      console.error('加载更多数据失败:', error);
      wx.showToast({ title: '网络错误', icon: 'none' });
    } finally {
      this.setData({ isLoadingMore: false });
    }
  },

  // 下拉刷新
  async onRefresh() {
    if (this.data.isRefreshing) return;
    
    this.setData({ isRefreshing: true });
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      await this.loadInitialData();
      // 确保刷新动画至少显示一段时间
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      wx.showToast({ title: '刷新失败', icon: 'none' });
    } finally {
      this.setData({ isRefreshing: false });
      wx.stopPullDownRefresh();
    }
  },
  
  // 切换分类
  switchTab(e) {
    const index = e.currentTarget.dataset.index;
    if (this.data.currentTab === index) return;
    
    this.setData({ currentTab: index });
    this.loadInitialData();
  },
  
  // 下拉刷新
  onPullDownRefresh() {
    this.onRefresh();
  },
  
  // 上拉加载更多
  onReachBottom() {
    this.loadMore();
  },
  
  // 前往搜索页
  goToSearch() {
    wx.navigateTo({ url: '/pages/search/search' });
  },
  
  /**
   * 处理note-card组件的点赞状态变化
   * 同步更新左右列与总列表中的该卡片数据
   */
  onLikeChanged(e) {
    const { note } = e.detail || {};
    if (!note || !note.id) return;
    const updateLocalNote = (list) => list.map(n => 
      n.id === note.id ? { ...n, isLiked: note.isLiked, likeCount: note.likeCount } : n
    );

    this.setData({ 
      leftList: updateLocalNote(this.data.leftList),
      rightList: updateLocalNote(this.data.rightList),
      contentList: updateLocalNote(this.data.contentList)
    });
  }
})