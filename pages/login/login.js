/**
 * 登录页面 - 用户登录功能
 * 功能：
 * - 手机号和密码登录
 * - 表单验证（手机号格式、密码长度、协议同意）
 * - 自动保存用户信息和token
 * - 登录成功后跳转首页
 */

// 引入封装的请求模块
const { post } = require('../../utils/request');

Page({
  data: {
    phone: '',       
    password: '',    
    isAgree: false,   
    canLogin: false   
  },
  
  onLoad() {},

  onPhoneInput(e) {
    const phone = e.detail.value
    this.setData({ phone })
    this.checkCanLogin() 
  },

  onPasswordInput(e) {
    const password = e.detail.value
    this.setData({ password })
    this.checkCanLogin()  
  },

  toggleAgreement() {
    const isAgree = !this.data.isAgree
    this.setData({ isAgree })
    this.checkCanLogin()  
  },

  //手机号11位 + 密码至少6位 + 同意协议
  checkCanLogin() {
    const { phone, password, isAgree } = this.data
    const canLogin = phone.length === 11 && password.length >= 6 && isAgree
    this.setData({ canLogin })
  },

  // 处理用户登录
  async handleLogin() {
    // 检查登录条件是否满足
    if (!this.data.canLogin) return
    const { phone, password } = this.data
    try {
      // 显示登录中的加载提示
      wx.showLoading({ title: '登录中...', mask: true })
      
      // 发送登录请求（无需token鉴权）
      const res = await post('/auth/login', { 
        login: phone,     
        password          
      }, { 
        auth: false,      
        modal: true, 
        loading: false 
      })
      wx.hideLoading()

      if (res && res.status) {
        const userData = res.data || {}
        
        // 保存用户基本信息到本地存储
        if (userData.user) {
          try { 
            wx.setStorageSync('userInfo', userData.user)    // 完整用户信息
            wx.setStorageSync('userId', userData.user.id)   // 用户ID
            wx.setStorageSync('userPhone', userData.user.phone) // 用户手机号
          } catch (error) {
            console.warn('保存用户信息失败:', error)
          }
        }
        // 保存登录token，用于后续API鉴权
        if (userData.token) {
          try { 
            wx.setStorageSync('token', userData.token) 
          } catch (error) {
            console.warn('保存token失败:', error)
          }
        }

        // 显示登录成功提示
        wx.showToast({ 
          title: res.message || '登录成功', 
          icon: 'success' 
        })
        // 延迟跳转
        setTimeout(() => {
          wx.switchTab({ url: '/pages/index/index' })
        }, 800)
      }
    } catch (error) {
      wx.hideLoading()
      console.error('登录请求失败:', error)
    }
  },
  //不需要注册和重置密码，使用手机号和验证码登录
  goToRegister() { 
    // wx.navigateTo({ url: '/pages/register/register' }) 
  },
  goToResetPassword() { 
    // wx.navigateTo({ url: '/pages/reset-password/reset-password' }) 
  }
})