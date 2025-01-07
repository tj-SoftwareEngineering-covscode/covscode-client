import {StatusBarItem, window, ProgressLocation, TextDocument} from 'vscode';
import { relative, resolve, dirname, join } from 'path';
import  {ClientUser} from '../entity/clientUser';
import  {StatusBarEditor} from './statusBarEditor';
import  {CursorEditor, UserCursorInfo} from './cursorEditor';
import { FileEditor } from './fileEditor';
import { PendingPromise } from '../util/pendingPromise';
import { ZipUtil } from '../util/zipUtil';
import * as fs from 'fs/promises';

/**
 * RepoEditor 类负责管理仓库编辑器的状态和操作
 * 包括状态栏显示、光标管理、文件操作等功能
 */
export class RepoEditor{
    // 状态栏编辑器，用于显示仓库状态
    private statusBarEditor: StatusBarEditor;  
    // 光标编辑器，用于管理用户光标
    private cursorEditor: CursorEditor;   
    // 仓库根路径     
    private rootPath: string;       
    // 进度提示的Promise           
    private progressPromise?: PendingPromise;  
    
    constructor(statusBarItem: StatusBarItem, rootPath: string){
       this.rootPath = rootPath;
       this.statusBarEditor = new StatusBarEditor(statusBarItem);
       this.cursorEditor = new CursorEditor();
    }

    /**
     * 开始初始化仓库
     * 显示进度提示，等待仓库初始化完成
     */
    startInitRepo(){
        this.progressPromise = new PendingPromise();
        // 在通知区域显示初始化进度
        window.withProgress(
            { location: ProgressLocation.Notification, title: 'Initializing repository, please wait' },
            () => this.progressPromise!.promise
          );
    }

    /**
     * 完成仓库初始化
     * @param user 当前用户
     * @param allUsers 所有在线用户
     */
    finishInitRepo(user: ClientUser, allUsers: ClientUser[]){
        // 结束进度提示
        this.progressPromise?.resolve();  
        // 初始化状态栏
        this.statusBarEditor.initStatusBar(user, allUsers);  
    }

    /**
     * 测试连接后清空Progress
     * 清除进度提示
     */
    cleanProgress(){
        this.progressPromise?.resolve();
    }

    /**
     * 本地离开仓库
     * 重置状态栏和光标信息
     */
    localLeave(){
        // 重置状态栏
        this.statusBarEditor.resetStatusBar();     
        // 重置光标信息
        this.cursorEditor.resetCursorInfo();       
        // 更新光标装饰器
        this.updateCursorDecorators();             
    }

    /**
     * 新用户加入仓库
     * @param joinedUser 新加入的用户
     * @param allUsers 所有在线用户
     */
    userJoin(joinedUser: ClientUser, allUsers: ClientUser[]){
        // 显示用户加入提示
        const message = `${joinedUser.userId} 加入了仓库`;
        window.showInformationMessage(message);
        // 更新状态栏显示
        this.statusBarEditor.updateStatusBar(allUsers);
    }

    /**
     * 其他用户离开仓库
     * @param leftUser 离开的用户
     * @param allUsers 剩余的在线用户
     */
    userLeave(leftUser: ClientUser, allUsers: ClientUser[]){
        // 显示用户离开提示
        const message = `${leftUser.userId} 离开了仓库`;
        window.showInformationMessage(message);
        // 更新状态栏并移除该用户的光标
        this.statusBarEditor.updateStatusBar(allUsers);
        this.cursorEditor.removeCursorInfo(leftUser);
        this.updateCursorDecorators();
    }

    /**
     * 本地移动光标
     * @param data 包含用户和光标位置信息的数据
     */
    localMoveCursor(data: UserCursorInfo){
        this.cursorEditor.updateCursorInfos(data.user, data.cursorPosition.filePath, data.cursorPosition.position);
    }

    /**
     * 更新其他用户的光标位置
     * @param docData 光标文档数据
     */
    updateCursor(docData: Object){
        const data = docData as UserCursorInfo;
        this.cursorEditor.updateCursorInfos(data.user, data.cursorPosition.filePath, data.cursorPosition.position);
    }

    /**
     * 更新所有光标的装饰器显示
     */
    updateCursorDecorators(){
        this.cursorEditor.updateCursorDecorators();
    }

    /**
     * 获取相对于仓库根目录的路径
     * @param path 绝对路径
     * @returns 相对路径
     */
    getRelativePath(path: string) {
        return relative(this.rootPath, path);
    }

    /**
     * 获取绝对路径
     * @param relativePath 相对路径
     * @returns 绝对路径
     */
    getAbsolutePath(relativePath: string) {
        return resolve(this.rootPath, relativePath);
    }

    /**
     * 获取本地工作区的压缩数据
     * @returns 压缩后的数据
     */
    async getZipData() {
        return await ZipUtil.zip(this.rootPath);
    }

    /**
     * 解压并还原仓库数据
     * @param data 压缩的仓库数据
     */
    async unzipRepoData(data: Buffer) {
        await ZipUtil.unzip(this.rootPath, data);
    }

    /**
     * 创建文件或文件夹
     * @param filePath 文件路径
     * @param user 操作的用户
     * @param isFile 是否为文件
     */
    async nodeCreate(filePath: string, user: ClientUser, isFile: boolean) {
        // 将相对路径转换为绝对路径
        const absolutePath = this.getAbsolutePath(filePath);
        
        try {
            if (!isFile) {
                // 如果是文件夹，直接创建文件夹（包括所有必要的父文件夹）
                await fs.mkdir(absolutePath, { recursive: true });
            }
            else {
                // 如果是文件，先确保父目录存在
                await fs.mkdir(dirname(absolutePath), { recursive: true });
                
                // 创建空文件
                await fs.writeFile(absolutePath, '');
            }

            // 显示创建成功的提示信息
            window.showInformationMessage(`${user.userId} 创建了 ${isFile ? '文件' : '文件夹'}: ${filePath}`);
        } catch (error: any) {
            // 显示创建失败的错误信息
            window.showErrorMessage(`创建${isFile ? '文件' : '文件夹'}失败: ${error.message}`);
        }
    }

    /**
     * 删除文件或文件夹
     * @param path 路径
     * @param user 操作的用户
     * @param isFile 是否为文件
     */
    async nodeDelete(path: string, user: ClientUser, isFile: boolean) {
        const absolutePath = this.getAbsolutePath(path);
        try {
            if (isFile) {
                // 删除文件
                await fs.unlink(absolutePath);
            } else {
                // 递归删除文件夹
                await fs.rm(absolutePath, { recursive: true, force: true });
            }
            window.showInformationMessage(`${user.userId} 删除了 ${isFile ? '文件' : '文件夹'}: ${path}`);
        } catch (error: any) {
            window.showErrorMessage(`删除${isFile ? '文件' : '文件夹'}失败: ${error.message}`);
        }
    }

    /**
     * 重命名文件或文件夹
     * @param oldPath 原路径
     * @param newName 新名称
     * @param user 操作的用户
     * @param isFile 是否为文件
     */
    async nodeRename(oldPath: string, newName: string, user: ClientUser, isFile: boolean) {
        const absoluteOldPath = this.getAbsolutePath(oldPath);
        const parentDir = dirname(absoluteOldPath);
        const absoluteNewPath = join(parentDir, newName);
        
        try {
            // 确保目标目录存在
            await fs.mkdir(dirname(absoluteNewPath), { recursive: true });
            // 执行重命名
            await fs.rename(absoluteOldPath, absoluteNewPath);
            window.showInformationMessage(
                `${user.userId} 将 ${isFile ? '文件' : '文件夹'} 从 ${oldPath} 重命名为 ${newName}`
            );
        } catch (error: any) {
            window.showErrorMessage(`重命名${isFile ? '文件' : '文件夹'}失败: ${error.message}`);
        }
    }

    /**
     * 显示文件打开提示
     * @param path 文件路径
     * @param user 操作的用户
     */
    fileOpen(path: string, user: ClientUser){
        window.showInformationMessage(`${user.userId} 打开了 ${path} 文件`);
    }

    /**
     * 显示文件关闭提示
     * @param path 文件路径
     * @param user 操作的用户
     */
    fileClose(path: string, user: ClientUser){
        window.showInformationMessage(`${user.userId} 关闭了 ${path} 文件`);
    }
    
    /**
     * 创建文件编辑器实例
     * @param isOpened 文件是否已打开
     * @param documentOrPath 文档对象或文件路径
     * @returns FileEditor实例
     */
    createFileEditor(isOpened: boolean, documentOrPath: TextDocument | string){
        if(isOpened){
            return new FileEditor(this, isOpened, documentOrPath as TextDocument);
        }
        else{
            return new FileEditor(this, isOpened, documentOrPath as string);
        } 
    }
} 