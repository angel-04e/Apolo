/**  Cliente HTTP simple  
 * Wrapper sobre fetch para las llamadas a la API interna.
 */

export const http = {
  async _req(method, url, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `Error ${res.status}`);
    }
    return res.json();
  },
  get:    (url)         => http._req('GET',    url),
  post:   (url, body)   => http._req('POST',   url, body),
  put:    (url, body)   => http._req('PUT',    url, body),
  patch:  (url, body)   => http._req('PATCH',  url, body),
  delete: (url)         => http._req('DELETE', url),
};
