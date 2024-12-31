import {StatusBarItem, window, ProgressLocation} from 'vscode';
import  {ClientUser} from '../entity/clientUser';
import  {StatusBarEditor} from './statusBarEditor';
import  {CursorEditor, UserCursorInfo} from './cursorEditor';
import { PendingPromise } from '../util/pendingPromise';

export class RepoEditor{
    private statusBarEditor: StatusBarEditor;

    private cursorEditor: CursorEditor;

    private progressPromise?: PendingPromise;
    
    constructor(statusBarItem: StatusBarItem){
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
} 