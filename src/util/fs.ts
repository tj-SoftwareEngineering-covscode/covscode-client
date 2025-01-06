
import { access, readdir, stat, rm } from 'fs/promises';

export function pathExists(path: string) {
  return access(path)
    .then(() => true)
    .catch(() => false);
}

export function isDir(path: string) {
  return stat(path)
    .then(stats => stats.isDirectory())
    .catch(() => undefined);
}

export function isDirEmpty(path: string) {
  return readdir(path).then(files => files.length === 0);
}

/**
 * 清空文件夹,包括文件夹和文件
 * @param path 
 * @returns 
 */
export function emptyDir(path: string) {
  return readdir(path, { withFileTypes: true }).then(async files => {
    for (const file of files) {
      const filePath = `${path}/${file.name}`;
      if (file.isDirectory()) {
        await emptyDir(filePath);  // First recursively empty the directory
        await rm(filePath, { recursive: true });  // Then remove the directory itself
      } else {
        await rm(filePath);  // Remove the file
      }
    }
  });
}
