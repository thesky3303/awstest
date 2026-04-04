(function () {
  const BODY3_CSS_PATH = '/css/main/body3.css';

  function ensureBody3Css() {
    const exists = document.querySelector(`link[href="${BODY3_CSS_PATH}"]`);
    if (exists) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = BODY3_CSS_PATH;
    document.head.appendChild(link);
  }

  function ensureMountPoint() {
    let mount = document.getElementById('main-body3');
    if (mount) return mount;

    mount = document.createElement('section');
    mount.id = 'main-body3';

    const body2 = document.getElementById('main-body2');
    if (body2 && body2.parentNode) {
      if (body2.nextSibling) {
        body2.parentNode.insertBefore(mount, body2.nextSibling);
      } else {
        body2.parentNode.appendChild(mount);
      }
    } else {
      document.body.appendChild(mount);
    }

    return mount;
  }

  function createFooter() {
    const wrapper = document.createElement('div');
    wrapper.className = 'main-body3-wrap';

    wrapper.innerHTML = `
      <div class="main-body3-top">
        <div class="main-body3-inner">
          <a href="tel:1544-0714" class="main-body3-call-button">
            <span class="main-body3-call-icon">📞</span>
            <span>대표번호 : 1544-0714</span>
          </a>
        </div>
      </div>

      <div class="main-body3-bottom">
        <div class="main-body3-inner">
          <h3 class="main-body3-title">AWS cloud 803호 2조 team Project</h3>

          <p class="main-body3-info">
            사업자번호: 101-86-50485
            <span class="main-body3-divider">|</span>
            통신판매업신고번호: 제2009-서울종로-1141호
            <span class="main-body3-divider">|</span>
            대표이사: 강재민
          </p>

          <p class="main-body3-info">
            서울특별시 종로구 종로12길 15, 2층/5층/8~10층(관철동 13-13)
            <span class="main-body3-divider">|</span>
            대표전화 : 1544-0714
            <span class="main-body3-divider">|</span>
            강사 : 오창석 강사님
          </p>

          <div class="main-body3-links">
            <a href="#" class="main-body3-link">Terms of Use</a>
            <span class="main-body3-divider">|</span>
            <a href="#" class="main-body3-link">Privacy</a>
          </div>

          <p class="main-body3-copy">
            Hosting by Imweb | Copyright©2022 솔데스크학원 ALL RIGHTS RESERVED
          </p>
        </div>
      </div>
    `;

    return wrapper;
  }

  function mountBody3() {
    ensureBody3Css();

    const mount = ensureMountPoint();
    mount.innerHTML = '';
    mount.appendChild(createFooter());
  }

  window.renderMainBody3 = mountBody3;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountBody3);
  } else {
    mountBody3();
  }
})();