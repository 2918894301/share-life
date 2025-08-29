/**
 * 个人中心页面 - 类似小红书的用户个人主页
 * 功能：
 * - 显示用户信息和统计数据
 * - 三个标签页：我的笔记、收藏、点赞
 * - 瀑布流展示用户的内容
 * - 下拉刷新和上拉加载更多
 * - 点赞交互功能
 * - 跳转到设置页面
 */

// 引入封装的请求模块
const { get, post } = require('../../utils/request');

Page({
  /**
   * 页面数据定义
   */
  data: {
    statusBarHeight: 0,     // 状态栏高度，用于适配
    currentTab: 0,          // 当前选中的标签页：0-我的笔记 1-收藏 2-点赞
    
    // 用户信息
    userInfo: {
      avatar: '',
      nickname: '用户昵称',
      userId: '',
      bio: '这是个人简介',
      stats: { 
        following: 0,       // 关注数
        followers: 0,       // 粉丝数
        likes: 0           // 获赞数
      }
    },
    
    // 统一的标签页数据管理
    tabs: {
      0: { // 我的笔记
        list: [],
        leftList: [],
        rightList: [],
        page: { current: 1, pageSize: 10, totalPages: 1, hasMore: true },
        loading: false,
        api: '/users/noteList',
        emptyText: '还没有发布笔记'
      },
      1: { // 收藏
        list: [],
        leftList: [],
        rightList: [],
        page: { current: 1, pageSize: 10, totalPages: 1, hasMore: true },
        loading: false,
        api: '/users/collectionList',
        emptyText: '还没有收藏内容'
      },
      2: { // 点赞
        list: [],
        leftList: [],
        rightList: [],
        page: { current: 1, pageSize: 10, totalPages: 1, hasMore: true },
        loading: false,
        api: '/users/likedList',
        emptyText: '还没有点赞内容'
      }
    },
    
    isRefreshing: false         // 是否正在刷新
  },

  // 计算属性：获取当前标签页的数据
  get currentData() {
    return this.data.tabs[this.data.currentTab] || this.data.tabs[0];
  },

  /**
   * 页面加载完成
   */
  onLoad() {
    // 获取系统信息，设置状态栏高度用于适配
    const systemInfo = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: systemInfo.statusBarHeight });
  },

  //每次进入页面都会执行，包括从其他页面返回
  onShow() {
    // 检查登录状态，未登录则跳转到登录页
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    // 页面显示时默认刷新当前标签页数据
    this.loadTabData(0, { reset: true });
  },

  //格式化数据
  mapToCardNote(item, userFallback) {
    const author = item.author || item.user || userFallback || {};
    const cover = item.coverImageUrl || '';
    
    return {
      id: item.id,
      title: item.title || '',
      content: item.title || '',
      type: item.isVideo ? 'video' : 'image', 
      isVideo: !!item.isVideo,               
      coverImageUrl: cover,                  
      likeCount: item.likeCount || 0,         
      commentCount: item.commentCount || 0,  
      createdAt: item.createdAt || '',        
      isLiked: !!item.isLiked,             
      user: {
        id: author.id,
        username: author.username || '',
        nickname: author.nickname || '用户',
        avatar: author.avatar || ''
      }
    };
  },

  // 统一的数据加载方法
  async loadTabData(tabIndex, { reset = false } = {}) {
    const tab = this.data.tabs[tabIndex];
    if (!tab || tab.loading) return;

    const nextPage = reset ? 1 : tab.page.current + 1;
    const queryParams = { page: nextPage, pageSize: tab.page.pageSize };

    this.setData({ [`tabs.${tabIndex}.loading`]: true });

    try {
      const response = await get(tab.api, queryParams, { auth: true, loading: true });
      if (!response || response.status === false) {
        wx.showToast({ title: response?.message || '获取数据失败', icon: 'none' });
        this.setData({ [`tabs.${tabIndex}.loading`]: false });
        return;
      }

      const data = response.data || {};
      const user = data.user || {};
      const notes = Array.isArray(data.notes) ? data.notes : [];
      const pagination = data.pagination || {};
        
      const formattedNotes = notes.map(item => this.mapToCardNote(item, user));

      // 更新用户信息（仅笔记tab且首次或reset时）
      if (tabIndex === 0 && reset) {
        this.setData({
          'userInfo.nickname': user.nickname || '未设置昵称',
          'userInfo.userId': user.id || '',
          'userInfo.bio': user.signature || '还没有简介',
          'userInfo.avatar': user.avatar || '',
          'userInfo.stats.following': (user.stats && user.stats.followCount) || 0,
          'userInfo.stats.followers': (user.stats && user.stats.fansCount) || 0,
          'userInfo.stats.likes': (user.stats && user.stats.likeCollectCount) || 0
        });
        try { wx.setStorageSync('userInfo', user) } catch (_) {}
      }

      const nextList = reset ? formattedNotes : [...tab.list, ...formattedNotes];
      const hasMore = (pagination.current || nextPage) < (pagination.totalPages || nextPage);
      
      // 更新瀑布流数据
      let leftList, rightList;
      if (reset) {
        // 重置时重新分配
        leftList = [];
        rightList = [];
        nextList.forEach((note, index) => {
          if (index % 2 === 0) {
            leftList.push(note);
          } else {
            rightList.push(note);
          }
        });
      } else {
        // 追加时基于现有数据
        leftList = [...tab.leftList];
        rightList = [...tab.rightList];
        formattedNotes.forEach((note, index) => {
          if ((tab.list.length + index) % 2 === 0) {
            leftList.push(note);
          } else {
            rightList.push(note);
          }
        });
      }

      this.setData({
        [`tabs.${tabIndex}.list`]: nextList,
        [`tabs.${tabIndex}.leftList`]: leftList,
        [`tabs.${tabIndex}.rightList`]: rightList,
        [`tabs.${tabIndex}.page.current`]: pagination.current || nextPage,
        [`tabs.${tabIndex}.page.totalPages`]: pagination.totalPages || nextPage,
        [`tabs.${tabIndex}.page.hasMore`]: hasMore
      });
    } catch (error) {
      console.error('获取数据失败:', error);
      wx.showToast({ title: '获取数据失败', icon: 'none' });
    } finally {
      this.setData({ [`tabs.${tabIndex}.loading`]: false });
    }
  },

  // 加载更多数据的统一方法
  loadMore() {
    const { currentTab } = this.data;
    const tab = this.data.tabs[currentTab];
    if (!tab || !tab.page.hasMore || tab.loading) return;
    this.loadTabData(currentTab, { reset: false });
  },

  // 点击笔记
  onTapNote(e) {
    const note = e.currentTarget.dataset.note;
    const isVideo = !!note.videoUrl;
    const url = isVideo
      ? `/pages/video-detail/index?id=${note.id}`
      : `/pages/detail/index?id=${note.id}`;
    wx.navigateTo({ url });
  },

  /**
   * 处理note-card组件的点赞状态变化
   * 同步更新所有标签页中的该笔记数据
   */
  onLikeChanged(e) {
    const { note } = e.detail || {};
    if (!note || !note.id) return;

    // 同步更新所有标签页中的该笔记
    const updateInList = (list) => list.map(n => 
      n.id === note.id ? { ...n, isLiked: note.isLiked, likeCount: note.likeCount } : n
    );

    // 更新所有标签页的数据
    const updatedTabs = {};
    Object.keys(this.data.tabs).forEach(tabIndex => {
      const tab = this.data.tabs[tabIndex];
      updatedTabs[`tabs.${tabIndex}.list`] = updateInList(tab.list);
      updatedTabs[`tabs.${tabIndex}.leftList`] = updateInList(tab.leftList);
      updatedTabs[`tabs.${tabIndex}.rightList`] = updateInList(tab.rightList);
    });

    this.setData(updatedTabs);
  },

  // 切换标签页
  switchTab(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (this.data.currentTab === index) return;
    this.setData({ currentTab: index });

    // 首次进入标签页时加载数据
    const tab = this.data.tabs[index];
    if (tab && tab.list.length === 0) {
      this.loadTabData(index, { reset: true });
    }
  },

  // 下拉刷新（支持所有标签页）
  async onPullDownRefresh() {
    const { currentTab } = this.data;
    
    if (this.data.isRefreshing) return;
    
    this.setData({ isRefreshing: true });
    
    try {
      // 添加延迟让刷新过程更加缓慢优雅
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // 重置当前标签页数据
      this.setData({ 
        [`tabs.${currentTab}.list`]: [],
        [`tabs.${currentTab}.leftList`]: [],
        [`tabs.${currentTab}.rightList`]: [],
        [`tabs.${currentTab}.page.current`]: 1,
        [`tabs.${currentTab}.page.hasMore`]: true
      });
      
      await this.loadTabData(currentTab, { reset: true });
      
      // 确保刷新动画至少显示一段时间
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('下拉刷新失败:', error);
      wx.showToast({ title: '刷新失败', icon: 'none' });
    } finally {
      this.setData({ isRefreshing: false });
      wx.stopPullDownRefresh();
    }
  },

  // 上拉触底
  onReachBottom() {
    this.loadMore();
  },

  // 前往设置页面
  goToSettings() { wx.navigateTo({ url: '/pages/settings/index' }) }
});