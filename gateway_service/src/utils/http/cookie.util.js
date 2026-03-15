function getCookieOptions(maxAgeMs) {
  const isProduction = process.env.NODE_ENV === 'production';
  const secure = process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : isProduction;

  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: maxAgeMs,
    path: '/',
  };
}

function setAuthCookies(res, tokens) {
  res.cookie('accessToken', tokens.accessToken, getCookieOptions(tokens.accessTokenMaxAgeMs));
  res.cookie('refreshToken', tokens.refreshToken, getCookieOptions(tokens.refreshTokenMaxAgeMs));
}

function clearAuthCookies(res) {
  const expired = { ...getCookieOptions(0), maxAge: 0 };
  res.cookie('accessToken', '', expired);
  res.cookie('refreshToken', '', expired);
}

export { clearAuthCookies, setAuthCookies };
