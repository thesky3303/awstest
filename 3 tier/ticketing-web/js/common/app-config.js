(function () {
  window.APP_CONFIG = window.APP_CONFIG || {};

  const current = window.APP_CONFIG.image || {};

  window.APP_CONFIG.image = {
    /*
      기본 베이스 경로
      - 로컬: '/images/'
      - S3/CloudFront: 'https://cdn.example.com/'
    */
    baseUrl: current.baseUrl || '/images/',

    /*
      true면 '/images/posters/a.jpg' 같은 루트경로도 baseUrl 기준으로 다시 조합
      - 로컬 개발 기본값: false
      - 운영에서 CloudFront로 일괄 전환 시: true
    */
    rewriteRootRelativePaths:
      typeof current.rewriteRootRelativePaths === 'boolean'
        ? current.rewriteRootRelativePaths
        : false,

    /*
      /mnt 같은 로컬 경로 처리 방식
      - 'filename' : 마지막 파일명만 사용
      - 'relative' : prefix 뒤의 상대경로를 그대로 사용
    */
    localPrefixMode: current.localPrefixMode || 'filename',

    /*
      로컬 경로 prefix 목록
      필요하면 여기에 추가
    */
    localPrefixes:
      Array.isArray(current.localPrefixes) && current.localPrefixes.length
        ? current.localPrefixes
        : [
            '/mnt/hgfs/',
            '/mnt/data/'
          ],

    /*
      이미지별 예외 매핑
      key는 "원본값 그대로" 또는 "파일명" 둘 다 가능
      value는 최종 URL 또는 baseUrl 뒤에 붙일 상대경로
    */
    manifest: current.manifest || {},

    keepAbsoluteUrls:
      typeof current.keepAbsoluteUrls === 'boolean'
        ? current.keepAbsoluteUrls
        : true,

    fallbackImageUrl: current.fallbackImageUrl || '/images/no-image.png'
  };
})();