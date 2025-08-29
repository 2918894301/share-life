
// 引入封装的请求模块
const { post } = require('../../utils/request');

Component({
  /**
   * 组件属性定义
   */
  properties: {
    // 是否显示评论输入框
    show: {
      type: Boolean,
      value: false
    },
    
    // 笔记ID 
    noteId: {
      type: String,
      value: ''
    },
    
    // 回复的评论ID（可选）- 用于回复特定评论
    replyToId: {
      type: String,
      value: ''
    },
    
    // 回复的用户昵称
    replyToNickname: {
      type: String,
      value: ''
    },
    
    // 占位符文本 
    placeholder: {
      type: String,
      value: '说点什么...'
    },
    
    // 主题模式：
    theme: {
      type: String,
      value: 'light'
    },
    
    // 是否有底部操作栏（action-bar），如果有则需要调整位置避免重叠
    hasActionBar: {
      type: Boolean,
      value: false
    }
  },

  /**
   * 组件内部数据
   */
  data: {
    commentText: '',    // 输入的评论内容
    isSubmitting: false // 是否正在提交
  },

  /**
   * 组件方法定义
   */
  methods: {


    //实时更新输入内容并通知父组件
    onInput(e) {
      this.setData({ 
        commentText: e.detail.value 
      });
      this.triggerEvent('input', { value: e.detail.value });
    },

    //点击表情按钮事件
    onEmojiTap() {
      this.triggerEvent('emoji');
      wx.showToast({
        title: '表情功能待开发',
        icon: 'none'
      });
    },

    //点击@按钮事件
    onMentionTap() {
      this.triggerEvent('mention');
      wx.showToast({
        title: '@功能待开发',
        icon: 'none'
      });
    },

    /**
     * 发送评论事件处理
     * 包含输入验证、防重复提交、网络请求等完整流程
     */
    async onSendTap() {
      const { commentText, isSubmitting } = this.data;
      const { noteId, replyToId } = this.properties;

      // 验证输入内容
      if (!commentText.trim()) {
        wx.showToast({
          title: '请输入评论内容',
          icon: 'none'
        });
        return;
      }

      // 防重复提交
      if (isSubmitting) return;

      // 验证必要参数
      if (!noteId) {
        wx.showToast({
          title: '笔记ID不能为空',
          icon: 'none'
        });
        return;
      }

      this.setData({ isSubmitting: true });

      try {
        // 构建请求数据
        const requestData = {
          noteId: noteId,
          content: commentText.trim()
        };

        // 如果是回复评论，添加回复ID
        if (replyToId) {
          requestData.replyToId = replyToId;
        }

        // 发送请求到后端，使用标准的请求配置
        const res = await post('/comments/create', requestData, { 
          auth: true, 
          loading: true,
          loadingText: '发送中...' 
        });

        if (res.status && res.data) {
          // 发送成功，清空输入框
          this.setData({ commentText: '' });
          
          // 通知父组件评论发送成功
          this.triggerEvent('success', {
            comment: res.data,
            isReply: !!replyToId
          });

          wx.showToast({
            title: '发送成功',
            icon: 'success'
          });
        } else {
          throw new Error(res.message || '发送失败');
        }
      } catch (error) {
        console.error('发送评论失败:', error);
        wx.showToast({
          title: error.message || '发送失败',
          icon: 'none'
        });
        
        // 通知父组件发送失败
        this.triggerEvent('error', { error });
      } finally {
        this.setData({ isSubmitting: false });
      }
    },

    /**
     * 取消回复事件
     * 通知父组件取消回复状态
     */
    onCancelReply() {
      this.triggerEvent('cancelReply');
    },


  }
});