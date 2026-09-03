import { inject, getCurrentInstance } from 'vue';
import { webdavClientKey } from './injection-symbols';

import { getGlobalWebdavClient, type WebdavClient } from './webdav-client';

export function useWebdavClient(): WebdavClient {
    if (getCurrentInstance()) {
        return inject(webdavClientKey)!;
    } else {
        return getGlobalWebdavClient()!;
    }
}