/**
 * 首页页面 - 类似小红书的信息流主页
 * 功能：
 * - 瀑布流展示笔记列表
 * - 分类筛选切换
 * - 下拉刷新和上拉加载更多
 * - 支持"我的发布"模式查看个人笔记
 * - 点赞交互功能
 * - 搜索和发布导航
 */

// 引入封装的请求模块
const { get, post } = require('../../utils/request');

Page({
  /**
   * 页面数据定义
   */
  data: {
    statusBarHeight: 0,     // 状态栏高度，用于适配不同设备
    navHeight: 44,          // 导航栏高度
    
    // 分类数据 - 从服务器动态获取，默认包含推荐
    categories: [
      { id: 0, name: '推荐' },
      { id: 1, name: '旅行' },
      { id: 2, name: '美食' },
      { id: 3, name: '时尚' },
      { id: 4, name: '健身' }
    ],
    
    currentTab: 0,          // 当前选中的分类索引
    
    // 笔记数据 - 瀑布流布局
    contentList: [],        // 完整的笔记列表
    leftList: [],          // 左列笔记（瀑布流）
    rightList: [],         // 右列笔记（瀑布流）
    
    // 分页参数
    pageNum: 1,            
    pageSize: 10,         
    hasMore: true,        
    
    // 加载状态
    isRefreshing: false,   // 是否正在刷新
    isLoadingMore: false   // 是否正在加载更多
  },
  
  /**
   * 页面加载时的初始化处理
   */
  onLoad() {
    // 获取系统信息，适配不同设备的状态栏和导航栏高度
    const systemInfo = wx.getSystemInfoSync();
    const navHeight = 44; // 导航栏固定高度
    
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      navHeight: systemInfo.statusBarHeight + navHeight
    });
    
    // 加载分类数据和初始内容
    this.loadCategories();
    this.loadInitialData(); // 加载公共信息流
  },
  
  /**
   * 加载分类数据
   * 从服务器获取所有可用的内容分类，并在首位添加"推荐"分类
   */
  async loadCategories() {
    try {
      // 请求分类数据（无需登录鉴权）
      const res = await get('/categories', {}, { auth: false });
      
      if (res.status) {
        // 构建分类列表，推荐分类固定在第一位
        const categories = [{ id: 0, name: '推荐' }];
        
        // 添加服务器返回的分类数据
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
        title: note.title || note.content || '',    // 标题，支持内容作为标题
        content: note.content || '',                // 内容
        isVideo: !!note.isVideo,                   // 是否为视频笔记
        
        // 作者信息标准化
        user: {
          id: note.author?.id || '',
          username: note.author?.username || '',
          nickname: note.author?.nickname || '匿名用户',
          avatar: note.author?.avatar || ''
        },
        
        // 统计数据
        likeCount: note.likeCount || 0,           // 点赞数
        commentCount: note.commentCount || 0,     // 评论数
        collectCount: note.collectCount || 0,     // 收藏数
        viewCount: note.viewCount || 0,           // 查看数
        
        // 媒体资源
        images: note.images || [],                // 图片列表
        coverImageUrl: note.coverImageUrl || '' , // 封面图
        
        // 其他信息
        createdAt: note.createdAt || '',          // 创建时间
        isLiked: !!note.isLiked                   // 当前用户是否已点赞
      };
    });
  },
  // 更新瀑布流数据
  updateWaterfallData(notes) {
    const leftList = [...this.data.leftList];
    const rightList = [...this.data.rightList];
    notes.forEach((note, index) => {
      if (index % 2 === 0) leftList.push(note);
      else rightList.push(note);
    });
    return { leftList, rightList };
  },

  // 组装公共流分页查询参数
  buildListParams(page) {
    const params = { page, pageSize: this.data.pageSize };
    if (this.data.currentTab > 0) {
      const category = this.data.categories[this.data.currentTab];
      if (category && category.id) params.categoryId = category.id;
    }
    // 如果登录，传 userId 以返回是否已点赞
    const userId = wx.getStorageSync('userId');
    if (userId) params.userId = userId;
    return params;
  },

  // 加载初始数据（公共流，page:1）
  async loadInitialData() {
    try {
      // 重置数据
      this.setData({
        contentList: [],
        leftList: [],
        rightList: [],
        pageNum: 1,
        hasMore: true
      });
      
      // 请求数据（无需鉴权），推荐页不传 categoryId
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

  // 加载更多数据（公共流）
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
          // 没有更多数据了
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
      // 添加延迟让刷新过程
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
  
  // 下拉刷新（scroll-view 的 refresher）
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
  


  // 点赞/取消点赞（来自 note-card 的事件）
  /**
   * 处理note-card组件的点赞状态变化
   * 同步更新左右列与总列表中的该卡片数据
   */
  onLikeChanged(e) {
    const { note } = e.detail || {};
    if (!note || !note.id) return;

    // 同步更新左右列与总列表中的该卡片
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