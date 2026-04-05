(function () {
  const BODY_JS_PATH = '/js/main/body.js';
  const BODY2_JS_PATH = '/js/main/body2.js';

  function ensureMainBody() {
    let mainBody = document.getElementById('main-body');

    if (!mainBody) {
      mainBody = document.createElement('div');
      mainBody.id = 'main-body';
      document.body.appendChild(mainBody);
    }

    mainBody.innerHTML = '';
    mainBody.style.display = '';
    return mainBody;
  }

  function removeSection(id) {
    const node = document.getElementById(id);
    if (node) node.remove();
  }

  async function renderHomePage() {
    ensureMainBody();
    removeSection('main-body2');

    if (typeof window.appEnsureScript === 'function') {
      await window.appEnsureScript(BODY_JS_PATH);
      await window.appEnsureScript(BODY2_JS_PATH);
    }

    if (typeof window.renderMainBody === 'function') {
      await window.renderMainBody();
    }

    if (typeof window.renderMainBody2 === 'function') {
      await window.renderMainBody2();
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  window.renderHomePage = renderHomePage;
})();
