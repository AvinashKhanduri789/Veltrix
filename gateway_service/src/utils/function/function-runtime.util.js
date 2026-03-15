import path from 'node:path';

const FUNCTION_RUNTIME_MAP = {
  python: 'python-3.10',
  node: 'node-20',
  go: 'go-1.22',
};

const FUNCTION_IMAGE_MAP = {
  python: 'veltrix-python:3.10',
  node: 'veltrix-node:20',
  go: 'veltrix-go:1.22',
};

const FUNCTION_EXTENSION_MAP = {
  python: '.py',
  node: '.js',
  go: '.go',
};

function getRuntimeVersion(language) {
  return FUNCTION_RUNTIME_MAP[language] || null;
}

function getContainerImageTag(language) {
  return FUNCTION_IMAGE_MAP[language] || null;
}

function getExpectedExtension(language) {
  return FUNCTION_EXTENSION_MAP[language] || null;
}

function hasValidExtensionForLanguage(fileName, language) {
  const expectedExtension = getExpectedExtension(language);
  if (!expectedExtension) {
    return false;
  }

  return path.extname(String(fileName || '')).toLowerCase() === expectedExtension;
}

export { getContainerImageTag, getExpectedExtension, getRuntimeVersion, hasValidExtensionForLanguage };
