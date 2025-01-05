import AdmZip from 'adm-zip';

export class ZipUtil {
    static async zip(rootPath: string): Promise<Buffer> {
        const zip = new AdmZip();
        
        // 添加整个目录到zip，使用过滤函数排除不需要的目录
        await zip.addLocalFolderPromise(rootPath, {});
        
        return zip.toBufferPromise();
    }

    static async unzip(targetPath: string, data: Buffer) {
        const zip = new AdmZip(data);

        zip.extractAllTo(targetPath, true);
    }
}