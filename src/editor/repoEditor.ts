import {StatusBarItem, window, ProgressLocation, TextDocument} from 'vscode';
import { relative, resolve, dirname, join } from 'path';
import  {ClientUser} from '../entity/clientUser';
import  {StatusBarEditor} from './statusBarEditor';
import  {CursorEditor, UserCursorInfo} from './cursorEditor';
import { FileEditor } from './fileEditor';
import { PendingPromise } from '../util/pendingPromise';
import { ZipUtil } from '../util/zipUtil';
import * as fs from 'fs/promises';

export class RepoEditor{
    private statusBarEditor: StatusBarEditor;

    private cursorEditor: CursorEditor;

    private rootPath: string; // 根路径

    private progressPromise?: PendingPromise;
    
    constructor(statusBarItem: StatusBarItem, rootPath: string){
       this.rootPath = rootPath;
       this.statusBarEditor = new StatusBarEditor(statusBarItem);
       this.cursorEditor = new CursorEditor();
    }

    // 开始初始化仓库
    startInitRepo(){
        this.progressPromise = new PendingPromise();
        window.withProgress(
            { location: ProgressLocation.Notification, title: 'Initializing repository, please wait' },
            () => this.progressPromise!.promise
          );
    }

    // 完成初始化仓库
    finishInitRepo(user: ClientUser, allUsers: ClientUser[]){
        this.progressPromise?.resolve();
        this.statusBarEditor.initStatusBar(user, allUsers);
    }

    // 测试连接后清空Progress
    cleanProgress(){
        this.progressPromise?.resolve();
    }

    // 本地离开仓库
    localLeave(){
        this.statusBarEditor.resetStatusBar();
        this.cursorEditor.resetCursorInfo();
        this.updateCursorDecorators();
    }

    // 新用户加入仓库
    userJoin(joinedUser: ClientUser, allUsers: ClientUser[]){
        const message = `${joinedUser.userId} 加入了仓库`;
        window.showInformationMessage(message);
        this.statusBarEditor.updateStatusBar(allUsers);
    }

    // 其他用户离开仓库
    userLeave(leftUser: ClientUser, allUsers: ClientUser[]){
        const message = `${leftUser.userId} 离开了仓库`;
        window.showInformationMessage(message);
        this.statusBarEditor.updateStatusBar(allUsers);
        this.cursorEditor.removeCursorInfo(leftUser);
        this.updateCursorDecorators();
    }

    // 本地移动光标,直接传入修改的光标信息
    localMoveCursor(data: UserCursorInfo){
        this.cursorEditor.updateCursorInfos(data.user, data.cursorPosition.filePath, data.cursorPosition.position);
    }

    // 其他用户更新光标
    updateCursor(docData: Object){
        const data = docData as UserCursorInfo;
        this.cursorEditor.updateCursorInfos(data.user, data.cursorPosition.filePath, data.cursorPosition.position);
    }

    // 更新光标装饰
    updateCursorDecorators(){
        this.cursorEditor.updateCursorDecorators();
    }


    // 获取相对路径
    getRelativePath(path: string) {
        return relative(this.rootPath, path);
    }

    // 获取绝对路径
    getAbsolutePath(relativePath: string) {
        return resolve(this.rootPath, relativePath);
    }

    // 获取本地工作区解压数据
    async getZipData() {
        return await ZipUtil.zip(this.rootPath);
    }

    // 解压传过来的仓库数据
    async unzipRepoData(data: Buffer) {
        await ZipUtil.unzip(this.rootPath, data);
    }

    // 创建节点
    async nodeCreate(filePath: string, user: ClientUser, isFile: boolean) {
        const absolutePath = this.getAbsolutePath(filePath);
        try {
            if (!isFile) {
                await fs.mkdir(absolutePath, { recursive: true });
            }
            else {
                // 确保父目录存在
                await fs.mkdir(dirname(absolutePath), { recursive: true });
                await fs.writeFile(absolutePath, '');
            }
            window.showInformationMessage(`${user.userId} 创建了 ${isFile ? '文件' : '文件夹'}: ${filePath}`);
        } catch (error: any) {
            window.showErrorMessage(`创建${isFile ? '文件' : '文件夹'}失败: ${error.message}`);
        }
    }

    // 删除节点
    async nodeDelete(path: string, user: ClientUser, isFile: boolean) {
        const absolutePath = this.getAbsolutePath(path);
        try {
            if (isFile) {
                await fs.unlink(absolutePath);
            } else {
                await fs.rm(absolutePath, { recursive: true, force: true });
            }
            window.showInformationMessage(`${user.userId} 删除了 ${isFile ? '文件' : '文件夹'}: ${path}`);
        } catch (error: any) {
            window.showErrorMessage(`删除${isFile ? '文件' : '文件夹'}失败: ${error.message}`);
        }
    }

    // 重命名节点
    async nodeRename(oldPath: string, newName: string, user: ClientUser, isFile: boolean) {
        const absoluteOldPath = this.getAbsolutePath(oldPath);
        const parentDir = dirname(oldPath);
        const absoluteNewPath = join(parentDir, newName);
        
        try {
            await fs.mkdir(dirname(absoluteNewPath), { recursive: true });
            await fs.rename(absoluteOldPath, absoluteNewPath);
            window.showInformationMessage(
                `${user.userId} 将 ${isFile ? '文件' : '文件夹'} 从 ${oldPath} 重命名为 ${newName}`
            );
        } catch (error: any) {
            window.showErrorMessage(`重命名${isFile ? '文件' : '文件夹'}失败: ${error.message}`);
        }
    }

    // 打开文件
    fileOpen(path: string, user: ClientUser){
        window.showInformationMessage(`${user.userId} 打开了 ${path} 文件`);
    }

    // 关闭文件
    fileClose(path: string, user: ClientUser){
        window.showInformationMessage(`${user.userId} 关闭了 ${path} 文件`);
    }
    
    // 创建FileEditor
    createFileEditor(isOpened: boolean, documentOrPath: TextDocument | string){
        if(isOpened){
            return new FileEditor(this, isOpened, documentOrPath as TextDocument);
        }
        else{
            return new FileEditor(this, isOpened, documentOrPath as string);
        } 
    }
} 