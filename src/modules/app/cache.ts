
export async function clearShareCache() {
    const { Directory, Filesystem } = await import('@capacitor/filesystem');
    const cachePath = 'share';
    try {
        await Filesystem.rmdir({
            path: cachePath,
            directory: Directory.Cache,
            recursive: true,
        });
    } catch {
        return;
    }
    await Filesystem.mkdir({
        path: cachePath,
        directory: Directory.Cache,
        recursive: true,
    });
}
