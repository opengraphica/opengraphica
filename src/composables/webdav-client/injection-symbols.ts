import type { InjectionKey, Ref } from 'vue';

import type { WebdavClient } from './webdav-client';

export const webdavClientKey = Symbol('Webdav Client Injection Key') as InjectionKey<WebdavClient>;
