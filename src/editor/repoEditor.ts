import {StatusBarItem, window} from 'vscode';
import  {ClientUser} from '../entity/clientUser';
import  {StatusBarEditor} from './statusBarEditor';

// 用于传递用户信息
export interface UserInfo {
    clientUser: ClientUser;
    allUsers: ClientUser[];
}

export class RepoEditor{
    private statusBarEditor: StatusBarEditor;

    constructor(statusBarItem: StatusBarItem){
       this.statusBarEditor = new StatusBarEditor(statusBarItem);
    }

    // 开始初始化仓库
    startInitRepo(){

    }

    // 完成初始化仓库
    finishInitRepo(userInfo: UserInfo){

        // 初始化状态栏
        this.statusBarEditor.initStatusBar(userInfo);
    }

    // 开始加入仓库
    startJoinRepo(){

    }

    // 完成加入仓库
    finishJoinRepo(userInfo: UserInfo){

        // 初始化状态栏
        this.statusBarEditor.initStatusBar(userInfo);
    }

    // 新用户加入仓库
    userJoin(joinedUser: ClientUser, allUsers: ClientUser[]){
        const message = `${joinedUser.getUserId()} 加入了仓库`;
        window.showInformationMessage(message);
        // 更新状态栏
        this.statusBarEditor.updateStatusBar(allUsers);
    }

    // 其他用户离开仓库
    userLeave(leftUser: ClientUser, allUsers: ClientUser[]){
        const message = `${leftUser.getUserId()} 离开了仓库`;
        window.showInformationMessage(message);
        // 更新状态栏
        this.statusBarEditor.updateStatusBar(allUsers);
    }

    
    
} 