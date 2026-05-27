(function (window) {
  'use strict';

  if (!window.axios) {
    throw new Error('Axios must be loaded before api-client.js');
  }

  const apiClient = window.axios.create({
    baseURL: '/',
    timeout: 15000,
    headers: {
      Accept: 'application/json',
    },
  });

  function getApiErrorMessage(error, fallback = 'Request failed') {
    const responseData = error?.response?.data;

    if (responseData && typeof responseData === 'object') {
      return responseData.error || responseData.message || fallback;
    }

    if (typeof responseData === 'string' && responseData.trim()) {
      return responseData;
    }

    return error?.message || fallback;
  }

  window.apiClient = apiClient;
  window.getApiErrorMessage = getApiErrorMessage;
})(window);
