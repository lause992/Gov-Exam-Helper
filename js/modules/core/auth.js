/* ===== modules/core/auth.js =====
 * 本地账号系统：注册、登录、登出、用户切换。
 * 数据存储在 localStorage，不同用户数据隔离。
 */
(function () {
  'use strict';
  var NS = window.XCAPP = window.XCAPP || {};

  var USERS_KEY = 'xcapp_users';      // { username: { password: hash, created: ts } }
  var SESSION_KEY = 'xcapp_session';  //当前登录用户名

  function hashPwd(pwd) {
    var h = 0;
    for (var i = 0; i < pwd.length; i++) {
      h = ((h << 5) - h + pwd.charCodeAt(i)) | 0;
    }
    return 'h' + Math.abs(h).toString(36);
  }

  function getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; }
    catch (e) { return {}; }
  }

  function saveUsers(u) {
    localStorage.setItem(USERS_KEY, JSON.stringify(u));
  }

  function getSession() {
    return localStorage.getItem(SESSION_KEY) || '';
  }

  function setSession(name) {
    if (name) localStorage.setItem(SESSION_KEY, name);
    else localStorage.removeItem(SESSION_KEY);
  }

  function register(username, password) {
    username = (username || '').trim();
    password = password || '';
    if (!username || username.length < 2) return { ok: false, msg: '用户名至少2个字符' };
    if (password.length < 4) return { ok: false, msg: '密码至少4位' };
    var users = getUsers();
    if (users[username]) return { ok: false, msg: '用户名已存在' };
    users[username] = { password: hashPwd(password), created: Date.now() };
    saveUsers(users);
    setSession(username);
    return { ok: true };
  }

  function login(username, password) {
    username = (username || '').trim();
    password = password || '';
    var users = getUsers();
    var u = users[username];
    if (!u) return { ok: false, msg: '用户不存在' };
    if (u.password !== hashPwd(password)) return { ok: false, msg: '密码错误' };
    setSession(username);
    return { ok: true };
  }

  function logout() {
    setSession('');
  }

  function currentUser() {
    return getSession();
  }

  function isLoggedIn() {
    return !!getSession();
  }

  function listUsers() {
    return Object.keys(getUsers());
  }

  function switchUser(username) {
    setSession(username);
  }

  function deleteUser(username) {
    var users = getUsers();
    if (users[username]) {
      delete users[username];
      saveUsers(users);
      if (getSession() === username) setSession('');
    }
  }

  NS.auth = {
    register: register,
    login: login,
    logout: logout,
    currentUser: currentUser,
    isLoggedIn: isLoggedIn,
    listUsers: listUsers,
    switchUser: switchUser,
    deleteUser: deleteUser
  };
})();
