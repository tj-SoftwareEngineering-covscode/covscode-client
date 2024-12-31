import {StatusBarItem, window, ProgressLocation} from 'vscode';
import { relative, resolve } from 'path';
import  {ClientUser} from '../entity/clientUser';
import  {StatusBarEditor} from './statusBarEditor';
import  {CursorEditor, UserCursorInfo} from './cursorEditor';
import { PendingPromise } from '../util/pendingPromise';
import { ZipUtil } from '../util/zipUtil';

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

    // 新用户加入仓库
    userJoin(joinedUser: ClientUser, allUsers: ClientUser[]){
        const message = `${joinedUser.getUserId()} 加入了仓库`;
        window.showInformationMessage(message);
        this.statusBarEditor.updateStatusBar(allUsers);
    }

    // 其他用户离开仓库
    userLeave(leftUser: ClientUser, allUsers: ClientUser[]){
        const message = `${leftUser.getUserId()} 离开了仓库`;
        window.showInformationMessage(message);
        this.statusBarEditor.updateStatusBar(allUsers);
    }

    // 更新光标
    updateCursor(docData: Object){
        const data = docData as UserCursorInfo;
        this.cursorEditor.updateCursorInfos(data.user, data.cursorPosition.filePath, data.cursorPosition.position);
        this.cursorEditor.updateCursorDecorators();
    }

    // 移除光标
    removeCursor(user: ClientUser){
        this.cursorEditor.removeCursorInfo(user);
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
} 