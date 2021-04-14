export function loadStylesheet(url: string): Promise<HTMLLinkElement> {
    return new Promise(async (resolve, reject) => {
        const head = document.head;
        const link = document.createElement('link');
        link.type = 'text/css';
        link.rel = 'stylesheet';
        link.onload = () => {
            resolve(link);
        };
        link.onerror = (error: any) => {
            reject(error);
        }
        link.href = url;
        head.appendChild(link);
    });
}
