(function () {
  function getImageConfig() {
    const appConfig = window.APP_CONFIG || {};
    return appConfig.image || {
      baseUrl: '/images/',
      rewriteRootRelativePaths: false,
      localPrefixMode: 'filename',
      localPrefixes: ['/mnt/hgfs/', '/mnt/data/'],
      manifest: {},
      keepAbsoluteUrls: true,
      fallbackImageUrl: '/images/no-image.png'
    };
  }

  function normalizeSlash(value) {
    return String(value || '').replaceAll('\\', '/');
  }

  function trimLeadingSlash(value) {
    return String(value || '').replace(/^\/+/, '');
  }

  function trimTrailingSlash(value) {
    return String(value || '').replace(/\/+$/, '');
  }

  function isAbsoluteUrl(value) {
    return /^https?:\/\//i.test(String(value || '').trim());
  }

  function isDataLikeUrl(value) {
    return /^(data:|blob:)/i.test(String(value || '').trim());
  }

  function extractFileName(value) {
    const normalized = normalizeSlash(value).trim();
    if (!normalized) return '';
    const parts = normalized.split('/');
    return parts[parts.length - 1] || '';
  }

  function joinBaseUrl(baseUrl, path) {
    const base = String(baseUrl || '').trim();
    const target = trimLeadingSlash(path);

    if (!base) {
      return target ? `/${target}` : '';
    }

    if (isAbsoluteUrl(base)) {
      return target ? `${trimTrailingSlash(base)}/${target}` : trimTrailingSlash(base);
    }

    return target ? `/${trimTrailingSlash(base).replace(/^\/+/, '')}/${target}`.replace(/\/{2,}/g, '/') : base;
  }

  function getManifestMatch(rawValue, config) {
    const manifest = config.manifest || {};
    if (manifest[rawValue]) {
      return manifest[rawValue];
    }

    const fileName = extractFileName(rawValue);
    if (fileName && manifest[fileName]) {
      return manifest[fileName];
    }

    return '';
  }

  function normalizeManifestValue(value, config) {
    const normalized = String(value || '').trim();
    if (!normalized) return '';

    if (isAbsoluteUrl(normalized) || isDataLikeUrl(normalized) || normalized.startsWith('/')) {
      return normalized;
    }

    return joinBaseUrl(config.baseUrl, normalized);
  }

  function stripKnownPrefix(rawValue, config) {
    const normalized = normalizeSlash(rawValue).trim();
    const prefixes = Array.isArray(config.localPrefixes) ? config.localPrefixes : [];

    for (const prefix of prefixes) {
      const normalizedPrefix = normalizeSlash(prefix).trim();
      if (!normalizedPrefix) continue;
      if (normalized.startsWith(normalizedPrefix)) {
        return normalized.slice(normalizedPrefix.length);
      }
    }

    return '';
  }

  function resolveImageUrl(rawValue) {
    if (rawValue === null || rawValue === undefined) return '';

    const config = getImageConfig();
    const value = normalizeSlash(String(rawValue).trim());

    if (!value) return '';

    const manifestMatch = getManifestMatch(value, config);
    if (manifestMatch) {
      return normalizeManifestValue(manifestMatch, config);
    }

    if (config.keepAbsoluteUrls && isAbsoluteUrl(value)) {
      return value;
    }

    if (isDataLikeUrl(value)) {
      return value;
    }

    if (value.startsWith('/')) {
      if (config.rewriteRootRelativePaths) {
        return joinBaseUrl(config.baseUrl, trimLeadingSlash(value));
      }
      return value;
    }

    const stripped = stripKnownPrefix(value, config);
    if (stripped) {
      if (config.localPrefixMode === 'relative') {
        return joinBaseUrl(config.baseUrl, stripped);
      }

      const fileName = extractFileName(stripped);
      return joinBaseUrl(config.baseUrl, fileName || stripped);
    }

    return joinBaseUrl(config.baseUrl, value);
  }

  function getFallbackImageUrl() {
    const config = getImageConfig();
    return String(config.fallbackImageUrl || '/images/no-image.png').trim();
  }

  window.getImageConfig = getImageConfig;
  window.resolveImageUrl = resolveImageUrl;
  window.getFallbackImageUrl = getFallbackImageUrl;
})();